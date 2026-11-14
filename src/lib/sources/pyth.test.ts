import { describe, expect, it, vi } from "vitest";
import { PythPriceFeed, parseHermesPrice } from "./pyth";

const hermesBody = (price: string, expo = -8) => ({
  parsed: [{ id: "ef0d", price: { price, conf: "1", expo, publish_time: 1_700_000_000 } }],
});

describe("parseHermesPrice", () => {
  it("applies the exponent", () => {
    expect(parseHermesPrice(hermesBody("18012345678"))).toBeCloseTo(180.12345678);
  });

  it("rejects malformed or non-positive prices", () => {
    expect(() => parseHermesPrice({ parsed: [] })).toThrow();
    expect(() => parseHermesPrice(hermesBody("0"))).toThrow();
  });
});

describe("PythPriceFeed", () => {
  it("caches for a short time and falls back to the last good price on errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(hermesBody("17500000000")), { status: 200 }))
      .mockResolvedValueOnce(new Response("down", { status: 503 }));
    const feed = new PythPriceFeed(fetchImpl as unknown as typeof fetch);

    expect(await feed.getSolPrice(0)).toBeCloseTo(175);
    expect(await feed.getSolPrice(5_000)).toBeCloseTo(175); // cached
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await feed.getSolPrice(60_000)).toBeCloseTo(175); // stale fallback
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws when there is no price at all", async () => {
    const feed = new PythPriceFeed((async () => new Response("down", { status: 503 })) as unknown as typeof fetch);
    await expect(feed.getSolPrice(0)).rejects.toThrow(/503/);
  });
});
