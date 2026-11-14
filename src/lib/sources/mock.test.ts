import { describe, expect, it } from "vitest";
import { detectWashTrades } from "@/lib/points";
import { MOCK_WALLETS, MockSource, SLOT_MS, WASH_WALLETS, generateMockSwaps, mockSolPrice } from "./mock";
import { swapSchema } from "./types";

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const HOUR = 3_600_000;

describe("generateMockSwaps", () => {
  const swaps = generateMockSwaps({ since: NOW - HOUR, now: NOW });

  it("is deterministic for the same window", () => {
    expect(generateMockSwaps({ since: NOW - HOUR, now: NOW })).toEqual(swaps);
  });

  it("produces a realistic amount of valid swaps", () => {
    expect(swaps.length).toBeGreaterThan(100);
    for (const s of swaps) expect(swapSchema.safeParse(s).success).toBe(true);
  });

  it("returns swaps inside the window, newest first", () => {
    for (const s of swaps) {
      expect(s.timestamp).toBeGreaterThanOrEqual(NOW - HOUR);
      expect(s.timestamp).toBeLessThanOrEqual(NOW);
    }
    const timestamps = swaps.map((s) => s.timestamp);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("is stable as time advances: older slots never change", () => {
    const later = generateMockSwaps({ since: NOW - HOUR, now: NOW + 10 * SLOT_MS });
    const overlap = later.filter((s) => s.timestamp <= NOW);
    expect(overlap).toEqual(swaps);
  });

  it("has unique signatures and only known wallets", () => {
    expect(new Set(swaps.map((s) => s.signature)).size).toBe(swaps.length);
    const known = new Set(MOCK_WALLETS);
    for (const s of swaps) expect(known.has(s.wallet)).toBe(true);
  });

  it("includes wash traders that the points engine catches", () => {
    const flagged = detectWashTrades(swaps);
    const washSwaps = swaps.filter((s) => WASH_WALLETS.has(s.wallet));
    expect(washSwaps.length).toBeGreaterThan(0);
    for (const s of washSwaps) expect(flagged.has(s.signature)).toBe(true);
  });
});

describe("MockSource", () => {
  it("reports mock mode and a plausible SOL price", async () => {
    const source = new MockSource(() => NOW);
    expect(source.mode).toBe("mock");
    const price = await source.getSolPrice();
    expect(price).toBe(mockSolPrice(NOW));
    expect(price).toBeGreaterThan(150);
    expect(price).toBeLessThan(210);
  });
});
