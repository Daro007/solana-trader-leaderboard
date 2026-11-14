import type { LeaderboardEntry, Summary, TimeWindow, VenueVolume } from "@/lib/aggregate";
import type { DataMode, Swap } from "@/lib/sources/types";

/** Response shapes shared by the route handlers and the client. */

interface Envelope {
  mode: DataMode;
  updatedAt: number;
}

export interface ActivityResponse extends Envelope {
  solPrice: number;
  swaps: Swap[];
}

export interface LeaderboardResponse extends Envelope {
  window: TimeWindow;
  summary: Summary;
  entries: LeaderboardEntry[];
}

export interface VolumeResponse extends Envelope {
  window: TimeWindow;
  venues: VenueVolume[];
}
