import type { Swap } from "@/lib/sources/types";

let counter = 0;

/** Build a valid Swap with sensible defaults; override what the test cares about. */
export function makeSwap(overrides: Partial<Swap> = {}): Swap {
  counter += 1;
  return {
    signature: `sig-${counter}`,
    timestamp: 1_700_000_000_000 + counter * 1_000,
    wallet: "WalletA",
    venue: "Jupiter",
    side: "buy",
    amountSol: 1,
    usdValue: 180,
    ...overrides,
  };
}
