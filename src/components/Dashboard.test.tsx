// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { WINDOWS, buildLeaderboard, summarize, volumeByVenue } from "@/lib/aggregate";
import type { ActivityResponse, LeaderboardResponse, VolumeResponse } from "@/lib/api-types";
import { generateMockSwaps, mockSolPrice } from "@/lib/sources/mock";
import { Dashboard } from "./Dashboard";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

/** Serve the real aggregation over mock data, exactly like the API routes do. */
function fakeApi(url: string): unknown {
  const swaps = generateMockSwaps({ since: NOW - WINDOWS["1h"], now: NOW });
  const base = { mode: "mock" as const, updatedAt: NOW };
  if (url.startsWith("/api/activity")) {
    return { ...base, solPrice: mockSolPrice(NOW), swaps: swaps.slice(0, 30) } satisfies ActivityResponse;
  }
  if (url.startsWith("/api/leaderboard")) {
    return {
      ...base,
      window: "1h",
      summary: summarize(swaps),
      entries: buildLeaderboard(swaps),
    } satisfies LeaderboardResponse;
  }
  return { ...base, window: "1h", venues: volumeByVenue(swaps) } satisfies VolumeResponse;
}

beforeAll(() => {
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => vi.unstubAllGlobals());

describe("Dashboard (smoke)", () => {
  it("renders the feed, leaderboard with tiers, and volume panel from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => new Response(JSON.stringify(fakeApi(url)), { status: 200 })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });

    render(
      <QueryClientProvider client={client}>
        <Dashboard />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Mock data")).toBeInTheDocument();

    const feed = await screen.findByRole("list", { name: "Recent swaps" });
    expect(within(feed).getAllByRole("listitem")).toHaveLength(30);

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(10);
    expect(within(table).getAllByText(/^(Gold|Silver|Bronze)$/).length).toBe(rows.length - 1);
    // The mock wash traders are visibly flagged.
    expect(within(table).getAllByText(/flagged$/).length).toBeGreaterThan(0);

    expect(await screen.findByText(/Volume by venue/)).toBeInTheDocument();
  });
});
