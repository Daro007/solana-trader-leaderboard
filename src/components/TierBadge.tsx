import type { TierName } from "@/lib/points";

const STYLES: Record<TierName, string> = {
  Gold: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  Silver: "bg-slate-300/15 text-slate-200 ring-slate-300/40",
  Bronze: "bg-orange-700/20 text-orange-300 ring-orange-600/40",
};

export function TierBadge({ tier }: { tier: TierName }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[tier]}`}>
      {tier}
    </span>
  );
}
