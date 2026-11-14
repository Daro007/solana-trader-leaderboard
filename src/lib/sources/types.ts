import { z } from "zod";

export const VENUES = ["Jupiter", "Raydium", "Orca", "Meteora", "Other"] as const;
export const venueSchema = z.enum(VENUES);
export type Venue = z.infer<typeof venueSchema>;

/**
 * A single normalized swap. Every data source (live or mock) must produce this
 * shape; everything downstream (aggregation, points, UI) only knows about it.
 *
 * `side` is expressed from the trader's point of view relative to SOL:
 * "buy" = the wallet received SOL, "sell" = the wallet sent SOL.
 */
export const swapSchema = z.object({
  signature: z.string().min(1),
  /** Unix epoch, milliseconds. */
  timestamp: z.number().int().positive(),
  wallet: z.string().min(1),
  venue: venueSchema,
  side: z.enum(["buy", "sell"]),
  /** Amount of SOL bought or sold. */
  amountSol: z.number().nonnegative(),
  /** Notional size in USD at execution time. */
  usdValue: z.number().nonnegative(),
});
export type Swap = z.infer<typeof swapSchema>;

export interface ActivityQuery {
  /** Only return swaps with timestamp >= since (ms). */
  since: number;
  /** Reference "now" (ms). Injected so sources are testable. */
  now: number;
}

export type DataMode = "mock" | "live";

export interface ActivitySource {
  readonly mode: DataMode;
  /** Swaps in [since, now], newest first. */
  getSwaps(query: ActivityQuery): Promise<Swap[]>;
  /** Current SOL/USD reference price. */
  getSolPrice(): Promise<number>;
}
