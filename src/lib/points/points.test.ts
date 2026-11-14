import { describe, expect, it } from "vitest";
import { makeSwap } from "@/test/fixtures";
import { DEFAULT_RULES, detectWashTrades, pointsForTrade, scoreWallets, tierFor } from ".";

const T0 = 1_700_000_000_000;

describe("pointsForTrade", () => {
  it("awards 1 point per usdPerPoint, floored", () => {
    expect(pointsForTrade(250)).toBe(2);
    expect(pointsForTrade(99.99)).toBe(0);
  });

  it("ignores dust trades below the minimum", () => {
    expect(pointsForTrade(DEFAULT_RULES.minTradeUsd - 0.01, { ...DEFAULT_RULES, usdPerPoint: 1 })).toBe(0);
  });

  it("caps points per trade", () => {
    expect(pointsForTrade(1_000_000)).toBe(DEFAULT_RULES.maxPointsPerTrade);
  });
});

describe("tierFor", () => {
  it.each([
    [0, "Bronze"],
    [499, "Bronze"],
    [500, "Silver"],
    [2_499, "Silver"],
    [2_500, "Gold"],
  ])("%i points -> %s", (points, tier) => {
    expect(tierFor(points)).toBe(tier);
  });
});

describe("detectWashTrades", () => {
  it("flags a quick buy/sell round trip of similar size", () => {
    const buy = makeSwap({ side: "buy", usdValue: 1_000, timestamp: T0 });
    const sell = makeSwap({ side: "sell", usdValue: 1_010, timestamp: T0 + 30_000 });
    expect(detectWashTrades([buy, sell])).toEqual(new Set([buy.signature, sell.signature]));
  });

  it("does not flag round trips outside the time window", () => {
    const buy = makeSwap({ side: "buy", usdValue: 1_000, timestamp: T0 });
    const sell = makeSwap({ side: "sell", usdValue: 1_000, timestamp: T0 + DEFAULT_RULES.washWindowMs + 1 });
    expect(detectWashTrades([buy, sell]).size).toBe(0);
  });

  it("does not flag opposite trades of clearly different size", () => {
    const buy = makeSwap({ side: "buy", usdValue: 1_000, timestamp: T0 });
    const sell = makeSwap({ side: "sell", usdValue: 1_500, timestamp: T0 + 1_000 });
    expect(detectWashTrades([buy, sell]).size).toBe(0);
  });

  it("does not flag same-side trades or trades from different wallets", () => {
    const a = makeSwap({ wallet: "A", side: "buy", usdValue: 1_000, timestamp: T0 });
    const b = makeSwap({ wallet: "A", side: "buy", usdValue: 1_000, timestamp: T0 + 1_000 });
    const c = makeSwap({ wallet: "B", side: "sell", usdValue: 1_000, timestamp: T0 + 2_000 });
    expect(detectWashTrades([a, b, c]).size).toBe(0);
  });

  it("matches each trade at most once", () => {
    const buy = makeSwap({ side: "buy", usdValue: 1_000, timestamp: T0 });
    const sell1 = makeSwap({ side: "sell", usdValue: 1_000, timestamp: T0 + 1_000 });
    const sell2 = makeSwap({ side: "sell", usdValue: 1_000, timestamp: T0 + 2_000 });
    const flagged = detectWashTrades([sell2, buy, sell1]);
    expect(flagged).toEqual(new Set([buy.signature, sell1.signature]));
  });
});

describe("scoreWallets", () => {
  it("sums points and eligible volume per wallet and assigns a tier", () => {
    const swaps = [
      makeSwap({ wallet: "A", usdValue: 5_000 }), // 50 pts
      makeSwap({ wallet: "A", usdValue: 50_000 }), // capped at 100 pts
      makeSwap({ wallet: "B", usdValue: 5 }), // dust
    ];
    const scores = scoreWallets(swaps);
    expect(scores.get("A")).toEqual({ points: 150, tier: "Bronze", eligibleVolumeUsd: 55_000, flaggedTrades: 0 });
    expect(scores.get("B")).toEqual({ points: 0, tier: "Bronze", eligibleVolumeUsd: 0, flaggedTrades: 0 });
  });

  it("gives wash trades no points and counts them as flagged", () => {
    const swaps = [
      makeSwap({ wallet: "W", side: "buy", usdValue: 10_000, timestamp: T0 }),
      makeSwap({ wallet: "W", side: "sell", usdValue: 10_000, timestamp: T0 + 1_000 }),
      makeSwap({ wallet: "W", side: "buy", usdValue: 1_000, timestamp: T0 + 600_000 }),
    ];
    expect(scoreWallets(swaps).get("W")).toMatchObject({ points: 10, flaggedTrades: 2, eligibleVolumeUsd: 1_000 });
  });

  it("counts duplicate signatures once", () => {
    const s = makeSwap({ wallet: "A", usdValue: 1_000 });
    expect(scoreWallets([s, { ...s }]).get("A")?.points).toBe(10);
  });

  it("reaches Gold with enough capped trades", () => {
    const swaps = Array.from({ length: 25 }, (_, i) =>
      makeSwap({ wallet: "G", side: "buy", usdValue: 20_000, timestamp: T0 + i * 3_600_000 }),
    );
    expect(scoreWallets(swaps).get("G")).toMatchObject({ points: 2_500, tier: "Gold" });
  });
});
