import type { TimeWindow } from "@/lib/aggregate";

const OPTIONS: TimeWindow[] = ["1h", "24h"];

export function WindowToggle({ value, onChange }: { value: TimeWindow; onChange: (w: TimeWindow) => void }) {
  return (
    <div role="group" aria-label="Time window" className="inline-flex rounded-lg bg-zinc-800 p-0.5 text-xs">
      {OPTIONS.map((w) => (
        <button
          key={w}
          type="button"
          aria-pressed={value === w}
          onClick={() => onChange(w)}
          className={`rounded-md px-3 py-1 font-medium transition-colors ${
            value === w ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
