"use client";

import { formatUsd, shortAddress, timeAgo } from "@/lib/format";
import { useActivity } from "@/lib/queries";
import { Panel, PanelStatus } from "./Panel";

export function ActivityFeed() {
  const { data, isPending, isError } = useActivity();

  return (
    <Panel title="Live activity" action={<span className="text-xs text-zinc-500">SOL / USD swaps</span>}>
      {isPending ? (
        <PanelStatus>Loading swaps…</PanelStatus>
      ) : isError ? (
        <PanelStatus>Could not load activity.</PanelStatus>
      ) : data.swaps.length === 0 ? (
        <PanelStatus>No swaps in the last hour yet.</PanelStatus>
      ) : (
        <ul className="max-h-[560px] divide-y divide-zinc-800/70 overflow-y-auto" aria-label="Recent swaps">
          {data.swaps.map((s) => (
            <li key={s.signature} className="grid grid-cols-[1fr_auto] gap-x-3 px-4 py-2 text-sm">
              <span className="font-mono text-zinc-300" title={s.wallet}>
                {shortAddress(s.wallet)}
              </span>
              <span className={`text-right font-medium ${s.side === "buy" ? "text-emerald-400" : "text-rose-400"}`}>
                {s.side === "buy" ? "Buy" : "Sell"} {formatUsd(s.usdValue)}
              </span>
              <span className="text-xs text-zinc-500">{s.venue}</span>
              <span className="text-right text-xs text-zinc-500">
                {s.amountSol.toFixed(2)} SOL · {timeAgo(s.timestamp, data.updatedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
