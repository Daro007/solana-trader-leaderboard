import { describe, expect, it } from "vitest";
import { formatUsd, shortAddress, timeAgo } from "./format";

describe("format helpers", () => {
  it("shortens addresses", () => {
    expect(shortAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe("7xKX…gAsU");
    expect(shortAddress("short")).toBe("short");
  });

  it("formats USD compactly for large values", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(2_500_000)).toBe("$2.5M");
  });

  it("formats relative time", () => {
    expect(timeAgo(0, 5_000)).toBe("5s ago");
    expect(timeAgo(0, 125_000)).toBe("2m ago");
    expect(timeAgo(0, 7_200_000)).toBe("2h ago");
  });
});
