import { normalizeHeliusTx } from "./helius-normalize";
import { PythPriceFeed } from "./pyth";
import type { ActivityQuery, ActivitySource, Swap } from "./types";

/** Well-known SOL/USDC pools. Override with SOLANA_POOL_ADDRESSES. */
export const DEFAULT_POOLS = [
  "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2", // Raydium AMM v4 SOL-USDC
  "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE", // Orca Whirlpool SOL-USDC
];

const REFRESH_MS = 5_000;
const RETENTION_MS = 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 100;

export interface HeliusSourceOptions {
  apiKey: string;
  pools?: string[];
  apiBase?: string;
  fetchImpl?: typeof fetch;
  priceFeed?: PythPriceFeed;
  clock?: () => number;
}

/**
 * Live source backed by the Helius Enhanced Transactions API.
 *
 * Each refresh pulls the latest SWAP transactions touching the configured
 * pools and merges them into an in-memory buffer keyed by signature. The
 * buffer accumulates history while the server runs, which is what lets the
 * 1h/24h windows fill up beyond a single API page. A real deployment would
 * replace this with a persistent indexer (see README).
 */
export class HeliusSource implements ActivitySource {
  readonly mode = "live" as const;
  private readonly buffer = new Map<string, Swap>();
  private lastRefresh = 0;
  private inFlight: Promise<void> | null = null;
  private readonly pools: string[];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly priceFeed: PythPriceFeed;
  private readonly clock: () => number;

  constructor(private readonly opts: HeliusSourceOptions) {
    this.pools = opts.pools?.length ? opts.pools : DEFAULT_POOLS;
    this.apiBase = opts.apiBase ?? "https://api.helius.xyz";
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.priceFeed = opts.priceFeed ?? new PythPriceFeed(this.fetchImpl);
    this.clock = opts.clock ?? Date.now;
  }

  getSolPrice(): Promise<number> {
    return this.priceFeed.getSolPrice(this.clock());
  }

  async getSwaps({ since, now }: ActivityQuery): Promise<Swap[]> {
    await this.refresh();
    const out: Swap[] = [];
    for (const swap of this.buffer.values()) {
      if (swap.timestamp >= since && swap.timestamp <= now) out.push(swap);
    }
    return out.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async refresh(): Promise<void> {
    const now = this.clock();
    if (now - this.lastRefresh < REFRESH_MS) return;
    // Collapse concurrent requests (feed, leaderboard, volume) into one fetch.
    this.inFlight ??= this.doRefresh(now).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doRefresh(now: number): Promise<void> {
    const solPrice = await this.priceFeed.getSolPrice(now);
    const pages = await Promise.all(this.pools.map((pool) => this.fetchPool(pool)));
    for (const raw of pages.flat()) {
      const swap = normalizeHeliusTx(raw, solPrice);
      if (swap) this.buffer.set(swap.signature, swap);
    }
    for (const [sig, swap] of this.buffer) {
      if (now - swap.timestamp > RETENTION_MS) this.buffer.delete(sig);
    }
    this.lastRefresh = now;
  }

  private async fetchPool(pool: string): Promise<unknown[]> {
    const url = `${this.apiBase}/v0/addresses/${pool}/transactions?api-key=${this.opts.apiKey}&type=SWAP&limit=${PAGE_LIMIT}`;
    const res = await this.fetchImpl(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Helius responded ${res.status} for pool ${pool}`);
    const body: unknown = await res.json();
    return Array.isArray(body) ? body : [];
  }
}
