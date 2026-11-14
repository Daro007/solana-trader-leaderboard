import { describe, expect, it } from "vitest";
import { makeSwap } from "@/test/fixtures";
import { buildLeaderboard, parseWindow, summarize, volumeByVenue } from ".";

describe("parseWindow", () => {
  it("defaults to 1h for anything unexpected", () => {
    expect(parseWindow("24h")).toBe("24h");
    expect(parseWindow("1h")).toBe("1h");
    expect(parseWindow("7d")).toBe("1h");
    expect(parseWindow(null)).toBe("1h");
  });
});

describe("buildLeaderboard", () => {
  const swaps = [
    makeSwap({ wallet: "A", usdValue: 100 }),
    makeSwap({ wallet: "B", usdValue: 500 }),
    makeSwap({ wallet: "A", usdValue: 300 }),
    makeSwap({ wallet: "C", usdValue: 50 }),
  ];

  it("ranks wallets by total USD volume with trade counts", () => {
    const board = buildLeaderboard(swaps);
    expect(board.map((e) => [e.rank, e.wallet, e.volumeUsd, e.trades])).toEqual([
      [1, "B", 500, 1],
      [2, "A", 400, 2],
      [3, "C", 50, 1],
    ]);
  });

  it("respects the limit", () => {
    expect(buildLeaderboard(swaps, 2)).toHaveLength(2);
  });

  it("breaks volume ties deterministically by wallet", () => {
    const board = buildLeaderboard([makeSwap({ wallet: "Z", usdValue: 10 }), makeSwap({ wallet: "Y", usdValue: 10 })]);
    expect(board.map((e) => e.wallet)).toEqual(["Y", "Z"]);
  });

  it("keeps wash volume in the ranking but not in points", () => {
    const wash = [
      makeSwap({ wallet: "W", side: "buy", usdValue: 50_000, timestamp: 1 }),
      makeSwap({ wallet: "W", side: "sell", usdValue: 50_000, timestamp: 2 }),
    ];
    const [top] = buildLeaderboard([...wash, makeSwap({ wallet: "H", usdValue: 1_000 })]);
    expect(top).toMatchObject({ wallet: "W", volumeUsd: 100_000, points: 0, flaggedTrades: 2, tier: "Bronze" });
  });

  it("ignores duplicate signatures", () => {
    const s = makeSwap({ wallet: "A", usdValue: 100 });
    expect(buildLeaderboard([s, { ...s }])[0]).toMatchObject({ volumeUsd: 100, trades: 1 });
  });

  it("returns an empty board for no swaps", () => {
    expect(buildLeaderboard([])).toEqual([]);
  });
});

describe("volumeByVenue", () => {
  it("totals volume per venue, includes empty venues, sorted desc", () => {
    const result = volumeByVenue([
      makeSwap({ venue: "Orca", usdValue: 10 }),
      makeSwap({ venue: "Raydium", usdValue: 30 }),
      makeSwap({ venue: "Orca", usdValue: 25.555 }),
    ]);
    expect(result[0]).toEqual({ venue: "Orca", volumeUsd: 35.56, trades: 2 });
    expect(result[1]).toEqual({ venue: "Raydium", volumeUsd: 30, trades: 1 });
    expect(result.map((v) => v.venue).sort()).toEqual(["Jupiter", "Meteora", "Orca", "Other", "Raydium"]);
  });
});

describe("summarize", () => {
  it("counts volume, trades and unique wallets", () => {
    expect(
      summarize([
        makeSwap({ wallet: "A", usdValue: 1 }),
        makeSwap({ wallet: "A", usdValue: 2 }),
        makeSwap({ wallet: "B", usdValue: 3 }),
      ]),
    ).toEqual({ volumeUsd: 6, trades: 3, uniqueWallets: 2 });
  });
});
