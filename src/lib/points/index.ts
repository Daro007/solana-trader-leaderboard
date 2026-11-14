import type { Swap } from "@/lib/sources/types";

/**
 * Points & VIP tiers. Pure functions only: same swaps in, same scores out.
 *
 * Anti-gaming rules (applied in this order):
 *  1. Duplicate signatures are counted once.
 *  2. Wash / self-trade round trips are excluded: a buy and a sell by the same
 *     wallet within `washWindowMs` whose USD sizes are within
 *     `washSizeTolerance` of each other earn nothing (both legs).
 *  3. Dust trades below `minTradeUsd` earn nothing.
 *  4. Each trade earns at most `maxPointsPerTrade`, so one giant trade can't
 *     buy a tier on its own.
 */

export interface PointsRules {
  usdPerPoint: number;
  minTradeUsd: number;
  maxPointsPerTrade: number;
  washWindowMs: number;
  washSizeTolerance: number;
}

export const DEFAULT_RULES: PointsRules = {
  usdPerPoint: 100,
  minTradeUsd: 10,
  maxPointsPerTrade: 100,
  washWindowMs: 5 * 60_000,
  washSizeTolerance: 0.02,
};

export type TierName = "Gold" | "Silver" | "Bronze";

/** Ordered from highest to lowest. */
export const TIERS: ReadonlyArray<{ name: TierName; minPoints: number }> = [
  { name: "Gold", minPoints: 2_500 },
  { name: "Silver", minPoints: 500 },
  { name: "Bronze", minPoints: 0 },
];

export function tierFor(points: number): TierName {
  return TIERS.find((t) => points >= t.minPoints)?.name ?? "Bronze";
}

export function pointsForTrade(usdValue: number, rules: PointsRules = DEFAULT_RULES): number {
  if (usdValue < rules.minTradeUsd) return 0;
  return Math.min(Math.floor(usdValue / rules.usdPerPoint), rules.maxPointsPerTrade);
}

function dedupe(swaps: readonly Swap[]): Swap[] {
  const seen = new Set<string>();
  return swaps.filter((s) => (seen.has(s.signature) ? false : (seen.add(s.signature), true)));
}

function isWashPair(a: Swap, b: Swap, rules: PointsRules): boolean {
  if (a.side === b.side) return false;
  const larger = Math.max(a.usdValue, b.usdValue);
  if (larger === 0) return true;
  return Math.abs(a.usdValue - b.usdValue) / larger <= rules.washSizeTolerance;
}

/**
 * Returns signatures of swaps that form wash-like round trips. Matching is
 * greedy in time order: each swap pairs with the earliest unmatched
 * opposite-side swap of similar size inside the window.
 */
export function detectWashTrades(swaps: readonly Swap[], rules: PointsRules = DEFAULT_RULES): Set<string> {
  const byWallet = new Map<string, Swap[]>();
  for (const s of dedupe(swaps)) {
    const list = byWallet.get(s.wallet);
    if (list) list.push(s);
    else byWallet.set(s.wallet, [s]);
  }

  const flagged = new Set<string>();
  for (const list of byWallet.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      if (flagged.has(a.signature)) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (b.timestamp - a.timestamp > rules.washWindowMs) break;
        if (!flagged.has(b.signature) && isWashPair(a, b, rules)) {
          flagged.add(a.signature);
          flagged.add(b.signature);
          break;
        }
      }
    }
  }
  return flagged;
}

export interface WalletScore {
  points: number;
  tier: TierName;
  /** Volume that counted toward points (after anti-gaming filters). */
  eligibleVolumeUsd: number;
  /** Trades excluded as wash / self-trades. */
  flaggedTrades: number;
}

export function scoreWallets(swaps: readonly Swap[], rules: PointsRules = DEFAULT_RULES): Map<string, WalletScore> {
  const flagged = detectWashTrades(swaps, rules);
  const scores = new Map<string, WalletScore>();

  for (const s of dedupe(swaps)) {
    const score = scores.get(s.wallet) ?? { points: 0, tier: "Bronze", eligibleVolumeUsd: 0, flaggedTrades: 0 };
    if (flagged.has(s.signature)) {
      score.flaggedTrades += 1;
    } else {
      const pts = pointsForTrade(s.usdValue, rules);
      score.points += pts;
      if (pts > 0) score.eligibleVolumeUsd += s.usdValue;
    }
    scores.set(s.wallet, score);
  }

  for (const score of scores.values()) score.tier = tierFor(score.points);
  return scores;
}
