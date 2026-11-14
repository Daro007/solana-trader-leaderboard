import { WINDOWS, parseWindow, volumeByVenue } from "@/lib/aggregate";
import type { VolumeResponse } from "@/lib/api-types";
import { jsonOrError } from "@/lib/http";
import { getActivitySource } from "@/lib/sources";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return jsonOrError<VolumeResponse>(async () => {
    const timeWindow = parseWindow(new URL(request.url).searchParams.get("window"));
    const source = getActivitySource();
    const now = Date.now();
    const swaps = await source.getSwaps({ since: now - WINDOWS[timeWindow], now });
    return { mode: source.mode, updatedAt: now, window: timeWindow, venues: volumeByVenue(swaps) };
  });
}
