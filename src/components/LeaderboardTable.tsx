import type { LeaderboardEntry } from "@/lib/aggregate";
import { formatNumber, formatUsd, shortAddress } from "@/lib/format";
import { TierBadge } from "./TierBadge";

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500 uppercase">
          <tr>
            <th className="px-4 py-2 font-medium">#</th>
            <th className="px-4 py-2 font-medium">Wallet</th>
            <th className="px-4 py-2 text-right font-medium">Volume</th>
            <th className="px-4 py-2 text-right font-medium">Trades</th>
            <th className="px-4 py-2 text-right font-medium">Points</th>
            <th className="px-4 py-2 font-medium">Tier</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {entries.map((e) => (
            <tr key={e.wallet} className="hover:bg-zinc-800/40">
              <td className="px-4 py-2 text-zinc-500 tabular-nums">{e.rank}</td>
              <td className="px-4 py-2 font-mono text-zinc-300" title={e.wallet}>
                {shortAddress(e.wallet)}
                {e.flaggedTrades > 0 && (
                  <span
                    className="ml-2 rounded bg-rose-500/15 px-1.5 py-0.5 font-sans text-[10px] text-rose-300"
                    title={`${e.flaggedTrades} trades excluded from points as wash / self-trades`}
                  >
                    {e.flaggedTrades} flagged
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{formatUsd(e.volumeUsd)}</td>
              <td className="px-4 py-2 text-right text-zinc-400 tabular-nums">{formatNumber(e.trades)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatNumber(e.points)}</td>
              <td className="px-4 py-2">
                <TierBadge tier={e.tier} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
