import { z } from "zod";

/** Pyth SOL/USD price feed id (same on every Pyth-supported chain). */
export const PYTH_SOL_USD_FEED = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const HERMES_URL = "https://hermes.pyth.network/v2/updates/price/latest";
const CACHE_MS = 10_000;

const hermesResponseSchema = z.object({
  parsed: z
    .array(
      z.object({
        id: z.string(),
        price: z.object({
          price: z.string(),
          expo: z.number().int(),
          publish_time: z.number(),
        }),
      }),
    )
    .min(1),
});

export function parseHermesPrice(body: unknown): number {
  const { parsed } = hermesResponseSchema.parse(body);
  const { price, expo } = parsed[0]!.price;
  const value = Number(price) * 10 ** expo;
  if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid Pyth price");
  return value;
}

/** SOL/USD from Pyth Hermes with a short in-memory cache. */
export class PythPriceFeed {
  private cached: { value: number; at: number } | null = null;

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async getSolPrice(now = Date.now()): Promise<number> {
    if (this.cached && now - this.cached.at < CACHE_MS) return this.cached.value;
    try {
      const url = `${HERMES_URL}?ids[]=${PYTH_SOL_USD_FEED}&parsed=true`;
      const res = await this.fetchImpl(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Hermes responded ${res.status}`);
      const value = parseHermesPrice(await res.json());
      this.cached = { value, at: now };
      return value;
    } catch (err) {
      // A stale price is better than no price for display purposes.
      if (this.cached) return this.cached.value;
      throw err;
    }
  }
}
