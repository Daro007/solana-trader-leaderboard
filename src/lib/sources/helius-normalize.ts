import { z } from "zod";
import { swapSchema, type Swap, type Venue } from "./types";

/**
 * Normalization of Helius Enhanced Transactions (`type: "SWAP"`) into our
 * `Swap` type. Only the fields we need are modelled; everything else passes
 * through untouched. Unparseable or non-SOL swaps are dropped (return null)
 * rather than throwing, so one odd transaction never breaks the feed.
 */

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const STABLE_MINTS: ReadonlySet<string> = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);
const LAMPORTS_PER_SOL = 1_000_000_000;
/** Ignore net SOL changes smaller than this (fees, rent dust). */
const MIN_SOL_DELTA = 0.0001;

const nativeAmountSchema = z.object({
  account: z.string(),
  amount: z.union([z.string(), z.number()]),
});

const tokenAmountSchema = z.object({
  userAccount: z.string(),
  mint: z.string(),
  rawTokenAmount: z.object({
    tokenAmount: z.union([z.string(), z.number()]),
    decimals: z.number().int().nonnegative(),
  }),
});

const tokenTransferSchema = z.object({
  fromUserAccount: z.string().nullish(),
  toUserAccount: z.string().nullish(),
  mint: z.string(),
  tokenAmount: z.number(),
});

export const heliusTxSchema = z
  .object({
    signature: z.string(),
    timestamp: z.number(),
    feePayer: z.string(),
    source: z.string().optional(),
    type: z.string().optional(),
    transactionError: z.unknown().optional(),
    tokenTransfers: z.array(tokenTransferSchema).optional().default([]),
    events: z
      .object({
        swap: z
          .object({
            nativeInput: nativeAmountSchema.nullish(),
            nativeOutput: nativeAmountSchema.nullish(),
            tokenInputs: z.array(tokenAmountSchema).optional().default([]),
            tokenOutputs: z.array(tokenAmountSchema).optional().default([]),
          })
          .nullish(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type HeliusTx = z.infer<typeof heliusTxSchema>;

/** A leg of the swap from the wallet's perspective. */
interface Leg {
  mint: string;
  amount: number;
  /** "in" = wallet paid this, "out" = wallet received this. */
  direction: "in" | "out";
}

export function mapVenue(source: string | undefined): Venue {
  const s = (source ?? "").toUpperCase();
  if (s.includes("JUPITER")) return "Jupiter";
  if (s.includes("RAYDIUM")) return "Raydium";
  if (s.includes("ORCA") || s.includes("WHIRLPOOL")) return "Orca";
  if (s.includes("METEORA")) return "Meteora";
  return "Other";
}

function legsFromSwapEvent(tx: HeliusTx): Leg[] | null {
  const ev = tx.events?.swap;
  if (!ev) return null;
  const legs: Leg[] = [];
  if (ev.nativeInput) {
    legs.push({ mint: WSOL_MINT, amount: Number(ev.nativeInput.amount) / LAMPORTS_PER_SOL, direction: "in" });
  }
  if (ev.nativeOutput) {
    legs.push({ mint: WSOL_MINT, amount: Number(ev.nativeOutput.amount) / LAMPORTS_PER_SOL, direction: "out" });
  }
  for (const t of ev.tokenInputs) {
    legs.push({
      mint: t.mint,
      amount: Number(t.rawTokenAmount.tokenAmount) / 10 ** t.rawTokenAmount.decimals,
      direction: "in",
    });
  }
  for (const t of ev.tokenOutputs) {
    legs.push({
      mint: t.mint,
      amount: Number(t.rawTokenAmount.tokenAmount) / 10 ** t.rawTokenAmount.decimals,
      direction: "out",
    });
  }
  return legs.length > 0 ? legs : null;
}

function legsFromTokenTransfers(tx: HeliusTx): Leg[] {
  const legs: Leg[] = [];
  for (const t of tx.tokenTransfers) {
    if (t.fromUserAccount === tx.feePayer) legs.push({ mint: t.mint, amount: t.tokenAmount, direction: "in" });
    if (t.toUserAccount === tx.feePayer) legs.push({ mint: t.mint, amount: t.tokenAmount, direction: "out" });
  }
  return legs;
}

function sum(legs: Leg[], predicate: (leg: Leg) => boolean): number {
  return legs.filter(predicate).reduce((acc, leg) => acc + leg.amount, 0);
}

export function normalizeHeliusTx(raw: unknown, solPrice: number): Swap | null {
  const parsed = heliusTxSchema.safeParse(raw);
  if (!parsed.success) return null;
  const tx = parsed.data;
  if (tx.transactionError) return null;

  const legs = legsFromSwapEvent(tx) ?? legsFromTokenTransfers(tx);
  const isSol = (l: Leg) => l.mint === WSOL_MINT;
  const solNet =
    sum(legs, (l) => isSol(l) && l.direction === "out") - sum(legs, (l) => isSol(l) && l.direction === "in");
  if (!Number.isFinite(solNet) || Math.abs(solNet) < MIN_SOL_DELTA) return null;

  const side = solNet > 0 ? "buy" : "sell";
  const amountSol = Math.abs(solNet);
  // Prefer the stablecoin leg (exact USD) over SOL * reference price.
  const stableDirection = side === "buy" ? "in" : "out";
  const stableUsd = sum(legs, (l) => STABLE_MINTS.has(l.mint) && l.direction === stableDirection);
  const usdValue = stableUsd > 0 ? stableUsd : amountSol * solPrice;

  const result = swapSchema.safeParse({
    signature: tx.signature,
    timestamp: Math.round(tx.timestamp * 1000),
    wallet: tx.feePayer,
    venue: mapVenue(tx.source),
    side,
    amountSol: Math.round(amountSol * 1e6) / 1e6,
    usdValue: Math.round(usdValue * 100) / 100,
  });
  return result.success ? result.data : null;
}
