import { describe, expect, it, vi } from "vitest";
import { HeliusSource } from "./helius";
import { WSOL_MINT } from "./helius-normalize";
import { PythPriceFeed } from "./pyth";

const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const NOW = 1_700_000_000_000;

function heliusSwap(signature: string, timestampMs: number, sol = 1) {
  return {
    signature,
    timestamp: timestampMs / 1000,
    feePayer: WALLET,
    source: "JUPITER",
    tokenTransfers: [{ fromUserAccount: WALLET, toUserAccount: "pool", mint: WSOL_MINT, tokenAmount: sol }],
  };
}

function setup(pages: unknown[][], clock = { now: NOW }) {
  let call = 0;
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    expect(String(url)).toContain("api-key=test-key");
    const body = pages[Math.min(call++, pages.length - 1)];
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const priceFeed = { getSolPrice: vi.fn(async () => 150) } as unknown as PythPriceFeed;
  const source = new HeliusSource({
    apiKey: "test-key",
    pools: ["poolA"],
    fetchImpl: fetchImpl as unknown as typeof fetch,
    priceFeed,
    clock: () => clock.now,
  });
  return { source, fetchImpl, clock };
}

describe("HeliusSource", () => {
  it("fetches, normalizes and filters swaps by window", async () => {
    const { source } = setup([[heliusSwap("a", NOW - 1_000), heliusSwap("b", NOW - 7_200_000), { junk: true }]]);
    const swaps = await source.getSwaps({ since: NOW - 3_600_000, now: NOW });
    expect(swaps.map((s) => s.signature)).toEqual(["a"]);
    expect(swaps[0]).toMatchObject({ side: "sell", amountSol: 1, usdValue: 150, venue: "Jupiter" });
  });

  it("accumulates history across refreshes and dedupes by signature", async () => {
    const { source, clock } = setup([
      [heliusSwap("a", NOW - 2_000)],
      [heliusSwap("a", NOW - 2_000), heliusSwap("b", NOW + 1_000)],
    ]);
    await source.getSwaps({ since: 0, now: NOW });
    clock.now = NOW + 10_000;
    const swaps = await source.getSwaps({ since: 0, now: clock.now });
    expect(swaps.map((s) => s.signature)).toEqual(["b", "a"]);
  });

  it("throttles refreshes and collapses concurrent requests", async () => {
    const { source, fetchImpl } = setup([[heliusSwap("a", NOW)]]);
    await Promise.all([1, 2, 3].map(() => source.getSwaps({ since: 0, now: NOW })));
    await source.getSwaps({ since: 0, now: NOW });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("prunes swaps older than 24h", async () => {
    const { source, clock } = setup([[heliusSwap("old", NOW)], []]);
    await source.getSwaps({ since: 0, now: NOW });
    clock.now = NOW + 25 * 3_600_000;
    expect(await source.getSwaps({ since: 0, now: clock.now })).toEqual([]);
  });

  it("surfaces upstream errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 429 }));
    const source = new HeliusSource({
      apiKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      priceFeed: { getSolPrice: async () => 150 } as unknown as PythPriceFeed,
    });
    await expect(source.getSwaps({ since: 0, now: Date.now() })).rejects.toThrow(/429/);
  });
});
