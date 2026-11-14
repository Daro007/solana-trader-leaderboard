"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeWindow } from "@/lib/aggregate";
import { formatUsd } from "@/lib/format";
import { useVolume } from "@/lib/queries";
import { Panel, PanelStatus } from "./Panel";

export function VolumeChart({ timeWindow }: { timeWindow: TimeWindow }) {
  const { data, isPending, isError } = useVolume(timeWindow);
  // "Other" is noise unless something actually landed there.
  const venues = data?.venues.filter((v) => v.venue !== "Other" || v.volumeUsd > 0) ?? [];

  return (
    <Panel title={`Volume by venue · ${timeWindow}`}>
      {isPending ? (
        <PanelStatus>Loading volume…</PanelStatus>
      ) : isError ? (
        <PanelStatus>Could not load volume.</PanelStatus>
      ) : (
        <div className="h-64 px-2 py-4" aria-label="Volume by venue chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={venues} margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="venue" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#71717a"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(v: number) => formatUsd(v, true)}
              />
              <Tooltip
                cursor={{ fill: "#27272a" }}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelStyle={{ color: "#e4e4e7" }}
                formatter={(v: number) => [formatUsd(v), "Volume"]}
              />
              <Bar dataKey="volumeUsd" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
