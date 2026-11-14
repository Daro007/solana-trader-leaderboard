import { describe, expect, it } from "vitest";
import { createActivitySource } from ".";

describe("createActivitySource", () => {
  it("uses mock data without a key", () => {
    expect(createActivitySource({}).mode).toBe("mock");
    expect(createActivitySource({ HELIUS_API_KEY: "  " }).mode).toBe("mock");
  });

  it("uses Helius when a key is set", () => {
    expect(createActivitySource({ HELIUS_API_KEY: "abc" }).mode).toBe("live");
  });

  it("lets DATA_MODE=mock force mock mode", () => {
    expect(createActivitySource({ HELIUS_API_KEY: "abc", DATA_MODE: "mock" }).mode).toBe("mock");
  });
});
