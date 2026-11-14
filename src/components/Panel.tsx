import type { ReactNode } from "react";

export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-300 uppercase">{title}</h2>
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function PanelStatus({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-zinc-500">{children}</p>;
}
