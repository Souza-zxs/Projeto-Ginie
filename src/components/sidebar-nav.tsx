"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  BarChart3,
  Bot,
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Plug,
  Settings,
  Smartphone,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: Route; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

// Agrupado por intenção de uso em vez de uma lista plana de 13 itens iguais —
// dá pra "ler" a estrutura do produto só olhando os rótulos das seções.
const groups: NavGroup[] = [
  {
    label: "Atendimento",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/crm", label: "CRM", icon: BarChart3 }
    ]
  },
  {
    label: "Divulgação",
    items: [
      { href: "/campaigns", label: "Campanhas", icon: Megaphone },
      { href: "/appointments" as Route, label: "Agenda", icon: CalendarDays },
      { href: "/reminders" as Route, label: "Lembretes", icon: Bell }
    ]
  },
  {
    label: "Equipe & IA",
    items: [
      { href: "/brokers", label: "Equipe", icon: Users },
      { href: "/settings/agents" as Route, label: "Agentes IA", icon: Bot }
    ]
  },
  {
    label: "Configurações",
    items: [
      { href: "/settings/organization" as Route, label: "Organização", icon: Building2 },
      { href: "/settings/whatsapp" as Route, label: "WhatsApp", icon: Smartphone },
      { href: "/settings/integrations" as Route, label: "Integrações", icon: Plug },
      { href: "/settings/logs" as Route, label: "Logs", icon: ClipboardList },
      { href: "/settings", label: "Geral", icon: Settings }
    ]
  }
];

export function SidebarNav() {
  const pathname = usePathname();

  const activeHref = groups
    .flatMap((group) => group.items)
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname?.startsWith(`${href}/`))
    // rota mais específica vence (ex.: /settings/agents bate antes de /settings)
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="space-y-6 p-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === activeHref;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-slate-800/80 text-white"
                      : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary transition-opacity",
                      active ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active ? "text-primary" : "text-slate-500 group-hover:text-primary"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
