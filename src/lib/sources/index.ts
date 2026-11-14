import { HeliusSource } from "./helius";
import { MockSource } from "./mock";
import type { ActivitySource } from "./types";

export * from "./types";

type Env = Record<string, string | undefined>;

/** Pick the data source from env. Mock unless a key is set and not forced off. */
export function createActivitySource(env: Env = process.env): ActivitySource {
  const apiKey = env.HELIUS_API_KEY?.trim();
  if (!apiKey || env.DATA_MODE === "mock") return new MockSource();
  const pools = env.SOLANA_POOL_ADDRESSES?.split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return new HeliusSource({ apiKey, pools, apiBase: env.HELIUS_API_BASE });
}

// One instance per server process so the live buffer survives across requests.
let singleton: ActivitySource | null = null;
export function getActivitySource(): ActivitySource {
  singleton ??= createActivitySource();
  return singleton;
}
