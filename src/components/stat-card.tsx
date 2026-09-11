import type { LucideIcon } from "lucide-react";

const tones = {
  default: { bar: "bg-slate-300", icon: "text-slate-500" },
  success: { bar: "bg-emerald-500", icon: "text-emerald-600" },
  warning: { bar: "bg-amber-500", icon: "text-amber-600" }
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default"
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  const t = tones[tone];

  return (
    <article className="group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} />
      <div className="flex items-center gap-2 pl-2 text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${t.icon}`} />
        <p className="truncate text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-3 pl-2 font-display text-3xl tabular-nums text-slate-950">{value}</p>
    </article>
  );
}
