import { WINDOWS } from "@/lib/aggregate";
import type { ActivityResponse } from "@/lib/api-types";
import { jsonOrError } from "@/lib/http";
import { getActivitySource } from "@/lib/sources";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;

export function GET(request: Request) {
  return jsonOrError<ActivityResponse>(async () => {
    const params = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit")) || 30, 1), MAX_LIMIT);
    const source = getActivitySource();
    const now = Date.now();
    const [swaps, solPrice] = await Promise.all([
      source.getSwaps({ since: now - WINDOWS["1h"], now }),
      source.getSolPrice(),
    ]);
    return { mode: source.mode, updatedAt: now, solPrice, swaps: swaps.slice(0, limit) };
  });
}
