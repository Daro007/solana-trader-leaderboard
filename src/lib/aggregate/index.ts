import { scoreWallets, type PointsRules, type TierName } from "@/lib/points";
import { VENUES, type Swap, type Venue } from "@/lib/sources/types";

export const WINDOWS = { "1h": 60 * 60 * 1000, "24h": 24 * 60 * 60 * 1000 } as const;
export type TimeWindow = keyof typeof WINDOWS;

export function parseWindow(value: string | null | undefined): TimeWindow {
  return value === "24h" ? "24h" : "1h";
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  volumeUsd: number;
  trades: number;
  points: number;
  tier: TierName;
  flaggedTrades: number;
}

export interface VenueVolume {
  venue: Venue;
  volumeUsd: number;
  trades: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Rank wallets by raw USD volume. Points/tier come from the anti-gaming
 * scorer, so a wash trader can rank high on volume but still sit in Bronze.
 */
export function buildLeaderboard(swaps: readonly Swap[], limit = 20, rules?: PointsRules): LeaderboardEntry[] {
  const totals = new Map<string, { volumeUsd: number; trades: number }>();
  const seen = new Set<string>();
  for (const s of swaps) {
    if (seen.has(s.signature)) continue;
    seen.add(s.signature);
    const t = totals.get(s.wallet) ?? { volumeUsd: 0, trades: 0 };
    t.volumeUsd += s.usdValue;
    t.trades += 1;
    totals.set(s.wallet, t);
  }

  const scores = scoreWallets(swaps, rules);
  return [...totals.entries()]
    .sort(([wa, a], [wb, b]) => b.volumeUsd - a.volumeUsd || wa.localeCompare(wb))
    .slice(0, limit)
    .map(([wallet, t], i) => {
      const score = scores.get(wallet)!;
      return {
        rank: i + 1,
        wallet,
        volumeUsd: round2(t.volumeUsd),
        trades: t.trades,
        points: score.points,
        tier: score.tier,
        flaggedTrades: score.flaggedTrades,
      };
    });
}

/** Volume per venue, always including every venue (zero if no trades). */
export function volumeByVenue(swaps: readonly Swap[]): VenueVolume[] {
  const totals = new Map<Venue, VenueVolume>(VENUES.map((venue) => [venue, { venue, volumeUsd: 0, trades: 0 }]));
  for (const s of swaps) {
    const v = totals.get(s.venue)!;
    v.volumeUsd += s.usdValue;
    v.trades += 1;
  }
  return [...totals.values()]
    .map((v) => ({ ...v, volumeUsd: round2(v.volumeUsd) }))
    .sort((a, b) => b.volumeUsd - a.volumeUsd || a.venue.localeCompare(b.venue));
}

export interface Summary {
  volumeUsd: number;
  trades: number;
  uniqueWallets: number;
}

export function summarize(swaps: readonly Swap[]): Summary {
  return {
    volumeUsd: round2(swaps.reduce((acc, s) => acc + s.usdValue, 0)),
    trades: swaps.length,
    uniqueWallets: new Set(swaps.map((s) => s.wallet)).size,
  };
}
