"use client";

import { useState } from "react";
import type { TimeWindow } from "@/lib/aggregate";
import { formatNumber, formatUsd } from "@/lib/format";
import { DEFAULT_RULES, TIERS } from "@/lib/points";
import { useActivity, useLeaderboard } from "@/lib/queries";
import { ActivityFeed } from "./ActivityFeed";
import { Leaderboard } from "./Leaderboard";
import { TierBadge } from "./TierBadge";
import { VolumeChart } from "./VolumeChart";
import { WindowToggle } from "./WindowToggle";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <p className="text-xs text-zinc-500 uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function Dashboard() {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("1h");
  const activity = useActivity();
  const leaderboard = useLeaderboard(timeWindow);
  const summary = leaderboard.data?.summary;
  const mode = activity.data?.mode ?? leaderboard.data?.mode;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solana Trader Leaderboard</h1>
          <p className="text-sm text-zinc-400">SOL/USD swaps across Jupiter, Raydium, Orca and Meteora.</p>
        </div>
        <div className="flex items-center gap-3">
          {mode && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                mode === "live"
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40"
                  : "bg-sky-500/15 text-sky-300 ring-sky-500/40"
              }`}
            >
              {mode === "live" ? "Live · Helius" : "Mock data"}
            </span>
          )}
          <WindowToggle value={timeWindow} onChange={setTimeWindow} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="SOL price" value={activity.data ? formatUsd(activity.data.solPrice) : "—"} />
        <Stat label={`Volume ${timeWindow}`} value={summary ? formatUsd(summary.volumeUsd) : "—"} />
        <Stat label={`Trades ${timeWindow}`} value={summary ? formatNumber(summary.trades) : "—"} />
        <Stat label="Active wallets" value={summary ? formatNumber(summary.uniqueWallets) : "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Leaderboard timeWindow={timeWindow} />
          <VolumeChart timeWindow={timeWindow} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <ActivityFeed />
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-zinc-300 uppercase">Points & tiers</h2>
            <p>
              1 point per ${DEFAULT_RULES.usdPerPoint} of eligible volume, capped at {DEFAULT_RULES.maxPointsPerTrade}{" "}
              points per trade. Trades under ${DEFAULT_RULES.minTradeUsd} and wash-like round trips (opposite side, size
              within {DEFAULT_RULES.washSizeTolerance * 100}%, within {DEFAULT_RULES.washWindowMs / 60_000} min) earn
              nothing.
            </p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {TIERS.map((t) => (
                <li key={t.name} className="flex items-center gap-1.5">
                  <TierBadge tier={t.name} />
                  <span className="text-xs">≥ {formatNumber(t.minPoints)} pts</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
