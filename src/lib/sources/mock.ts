import type { ActivityQuery, ActivitySource, Swap, Venue } from "./types";

/**
 * Deterministic, offline data source.
 *
 * Time is split into fixed slots. Each slot is seeded from its index, so the
 * swaps that "happened" in a slot are always the same regardless of when you
 * ask. That gives a feed that advances in real time while tests (which pass a
 * fixed `now`) stay fully reproducible.
 */

export const SLOT_MS = 15_000;
const BASE_SOL_PRICE = 180;
const WALLET_COUNT = 40;
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Weighted venue mix, roughly mirroring real SOL/USDC flow. */
const VENUE_WEIGHTS: ReadonlyArray<[Venue, number]> = [
  ["Jupiter", 0.45],
  ["Raydium", 0.25],
  ["Orca", 0.2],
  ["Meteora", 0.1],
];

/** mulberry32: tiny, fast, good-enough seeded PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBase58(rand: () => number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += BASE58[Math.floor(rand() * BASE58.length)];
  return out;
}

/** Fixed set of fake wallets. The first ones trade much more (power law). */
export const MOCK_WALLETS: readonly string[] = (() => {
  const rand = mulberry32(42);
  return Array.from({ length: WALLET_COUNT }, () => randomBase58(rand, 44));
})();

/** Wallets that wash-trade (buy and immediately sell the same size). */
export const WASH_WALLETS: ReadonlySet<string> = new Set([MOCK_WALLETS[3]!, MOCK_WALLETS[7]!]);

function pickVenue(r: number): Venue {
  let acc = 0;
  for (const [venue, weight] of VENUE_WEIGHTS) {
    acc += weight;
    if (r < acc) return venue;
  }
  return "Jupiter";
}

/** Slowly drifting deterministic price so USD values look plausible. */
export function mockSolPrice(timestamp: number): number {
  const hours = timestamp / 3_600_000;
  return Math.round((BASE_SOL_PRICE + 6 * Math.sin(hours / 3) + 2 * Math.sin(hours * 1.7)) * 100) / 100;
}

function swapsForSlot(slot: number): Swap[] {
  const rand = mulberry32(Math.imul(slot | 0, 0x9e3779b1));
  const count = Math.floor(rand() * 4); // 0-3 swaps per slot
  const swaps: Swap[] = [];

  for (let i = 0; i < count; i++) {
    // Power-law-ish wallet choice: low indices are the whales.
    const walletIndex = Math.min(WALLET_COUNT - 1, Math.floor(WALLET_COUNT * rand() ** 2.2));
    const wallet = MOCK_WALLETS[walletIndex]!;
    const timestamp = slot * SLOT_MS + Math.floor(rand() * (SLOT_MS - 2_000));
    const price = mockSolPrice(timestamp);
    // Log-uniform size between ~0.05 and ~500 SOL.
    const amountSol = Math.round(10 ** (rand() * 4 - 1.3) * 1000) / 1000;
    const side = rand() < 0.5 ? "buy" : "sell";
    const venue = pickVenue(rand());
    const signature = randomBase58(rand, 88);

    swaps.push({
      signature,
      timestamp,
      wallet,
      venue,
      side,
      amountSol,
      usdValue: Math.round(amountSol * price * 100) / 100,
    });

    // Wash traders mirror their trade a second later with the same size.
    if (WASH_WALLETS.has(wallet)) {
      swaps.push({
        signature: randomBase58(rand, 88),
        timestamp: timestamp + 1_000,
        wallet,
        venue,
        side: side === "buy" ? "sell" : "buy",
        amountSol,
        usdValue: Math.round(amountSol * price * 100) / 100,
      });
    }
  }
  return swaps;
}

export function generateMockSwaps({ since, now }: ActivityQuery): Swap[] {
  const out: Swap[] = [];
  const first = Math.floor(since / SLOT_MS);
  const last = Math.floor(now / SLOT_MS);
  for (let slot = last; slot >= first; slot--) {
    for (const swap of swapsForSlot(slot)) {
      if (swap.timestamp >= since && swap.timestamp <= now) out.push(swap);
    }
  }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

export class MockSource implements ActivitySource {
  readonly mode = "mock" as const;

  constructor(private readonly clock: () => number = Date.now) {}

  async getSwaps(query: ActivityQuery): Promise<Swap[]> {
    return generateMockSwaps(query);
  }

  async getSolPrice(): Promise<number> {
    return mockSolPrice(this.clock());
  }
}
