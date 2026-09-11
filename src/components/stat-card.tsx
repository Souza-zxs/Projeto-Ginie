import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  default: { bar: "bg-slate-300", icon: "text-slate-500" },
  success: { bar: "bg-emerald-500", icon: "text-emerald-600" },
  warning: { bar: "bg-amber-500", icon: "text-amber-600" }
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  size = "default"
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
  size?: "default" | "lg";
}) {
  const t = tones[tone];
  const isLg = size === "lg";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        isLg ? "p-6" : "p-5"
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", t.bar)} />
      <div className={cn("flex items-center gap-2 pl-2 text-muted-foreground", isLg && "text-sm")}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", t.icon)} />
        <p className="truncate text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p
        className={cn(
          "pl-2 font-display tabular-nums text-slate-950",
          isLg ? "mt-4 text-5xl" : "mt-3 text-3xl"
        )}
      >
        {value}
      </p>
    </article>
  );
}
