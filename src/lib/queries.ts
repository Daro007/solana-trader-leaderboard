"use client";

import { useQuery } from "@tanstack/react-query";
import type { TimeWindow } from "@/lib/aggregate";
import type { ActivityResponse, LeaderboardResponse, VolumeResponse } from "@/lib/api-types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

export const POLL_MS = { activity: 3_000, aggregates: 10_000 } as const;

export function useActivity() {
  return useQuery({
    queryKey: ["activity"],
    queryFn: () => getJson<ActivityResponse>("/api/activity?limit=30"),
    refetchInterval: POLL_MS.activity,
  });
}

export function useLeaderboard(window: TimeWindow) {
  return useQuery({
    queryKey: ["leaderboard", window],
    queryFn: () => getJson<LeaderboardResponse>(`/api/leaderboard?window=${window}`),
    refetchInterval: POLL_MS.aggregates,
    placeholderData: (prev) => prev,
  });
}

export function useVolume(window: TimeWindow) {
  return useQuery({
    queryKey: ["volume", window],
    queryFn: () => getJson<VolumeResponse>(`/api/volume?window=${window}`),
    refetchInterval: POLL_MS.aggregates,
    placeholderData: (prev) => prev,
  });
}
