"use client";

import type { TimeWindow } from "@/lib/aggregate";
import { useLeaderboard } from "@/lib/queries";
import { LeaderboardTable } from "./LeaderboardTable";
import { Panel, PanelStatus } from "./Panel";

export function Leaderboard({ timeWindow }: { timeWindow: TimeWindow }) {
  const { data, isPending, isError } = useLeaderboard(timeWindow);

  return (
    <Panel title={`Top traders · ${timeWindow}`}>
      {isPending ? (
        <PanelStatus>Loading leaderboard…</PanelStatus>
      ) : isError ? (
        <PanelStatus>Could not load leaderboard.</PanelStatus>
      ) : data.entries.length === 0 ? (
        <PanelStatus>No traders in this timeWindow yet.</PanelStatus>
      ) : (
        <LeaderboardTable entries={data.entries} />
      )}
    </Panel>
  );
}
