import { describe, expect, it } from "vitest";
import { STABLE_MINTS, WSOL_MINT, mapVenue, normalizeHeliusTx } from "./helius-normalize";

const USDC = [...STABLE_MINTS][0]!;
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const SOL_PRICE = 200;

function tx(overrides: Record<string, unknown> = {}) {
  return {
    signature: "5h3sig",
    timestamp: 1_700_000_000,
    feePayer: WALLET,
    source: "JUPITER",
    type: "SWAP",
    tokenTransfers: [],
    ...overrides,
  };
}

const usdcAmount = (ui: number) => ({ tokenAmount: String(Math.round(ui * 1e6)), decimals: 6 });

describe("normalizeHeliusTx", () => {
  it("normalizes a SOL -> USDC swap event as a sell valued by the USDC leg", () => {
    const raw = tx({
      events: {
        swap: {
          nativeInput: { account: WALLET, amount: "2500000000" },
          tokenOutputs: [{ userAccount: WALLET, mint: USDC, rawTokenAmount: usdcAmount(498.75) }],
        },
      },
    });
    expect(normalizeHeliusTx(raw, SOL_PRICE)).toEqual({
      signature: "5h3sig",
      timestamp: 1_700_000_000_000,
      wallet: WALLET,
      venue: "Jupiter",
      side: "sell",
      amountSol: 2.5,
      usdValue: 498.75,
    });
  });

  it("normalizes a USDC -> wSOL token swap as a buy", () => {
    const raw = tx({
      source: "RAYDIUM",
      events: {
        swap: {
          tokenInputs: [{ userAccount: WALLET, mint: USDC, rawTokenAmount: usdcAmount(1000) }],
          tokenOutputs: [
            { userAccount: WALLET, mint: WSOL_MINT, rawTokenAmount: { tokenAmount: "5000000000", decimals: 9 } },
          ],
        },
      },
    });
    expect(normalizeHeliusTx(raw, SOL_PRICE)).toMatchObject({
      side: "buy",
      amountSol: 5,
      usdValue: 1000,
      venue: "Raydium",
    });
  });

  it("falls back to token transfers when there is no swap event", () => {
    const raw = tx({
      source: "ORCA",
      tokenTransfers: [
        { fromUserAccount: WALLET, toUserAccount: "pool", mint: WSOL_MINT, tokenAmount: 1.5 },
        { fromUserAccount: "pool", toUserAccount: WALLET, mint: USDC, tokenAmount: 300 },
      ],
    });
    expect(normalizeHeliusTx(raw, SOL_PRICE)).toMatchObject({
      side: "sell",
      amountSol: 1.5,
      usdValue: 300,
      venue: "Orca",
    });
  });

  it("values non-stable swaps with the reference SOL price", () => {
    const raw = tx({
      events: {
        swap: {
          nativeInput: { account: WALLET, amount: 1_000_000_000 },
          tokenOutputs: [{ userAccount: WALLET, mint: BONK, rawTokenAmount: { tokenAmount: "1", decimals: 5 } }],
        },
      },
    });
    expect(normalizeHeliusTx(raw, SOL_PRICE)).toMatchObject({ side: "sell", amountSol: 1, usdValue: 200 });
  });

  it("drops swaps that don't touch SOL", () => {
    const raw = tx({
      events: {
        swap: {
          tokenInputs: [{ userAccount: WALLET, mint: USDC, rawTokenAmount: usdcAmount(10) }],
          tokenOutputs: [{ userAccount: WALLET, mint: BONK, rawTokenAmount: { tokenAmount: "1", decimals: 5 } }],
        },
      },
    });
    expect(normalizeHeliusTx(raw, SOL_PRICE)).toBeNull();
  });

  it("drops failed transactions and malformed payloads", () => {
    const failed = tx({
      transactionError: { InstructionError: [0, "Custom"] },
      events: { swap: { nativeInput: { account: WALLET, amount: "1000000000" } } },
    });
    expect(normalizeHeliusTx(failed, SOL_PRICE)).toBeNull();
    expect(normalizeHeliusTx({ foo: "bar" }, SOL_PRICE)).toBeNull();
    expect(normalizeHeliusTx(null, SOL_PRICE)).toBeNull();
  });
});

describe("mapVenue", () => {
  it.each([
    ["JUPITER", "Jupiter"],
    ["RAYDIUM_CLMM", "Raydium"],
    ["ORCA", "Orca"],
    ["METEORA_DLMM", "Meteora"],
    ["PHOENIX", "Other"],
    [undefined, "Other"],
  ])("%s -> %s", (source, venue) => {
    expect(mapVenue(source)).toBe(venue);
  });
});
