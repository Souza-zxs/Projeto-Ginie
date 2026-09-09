import Link from "next/link";
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
  LogOut,
  Megaphone,
  Plug,
  Settings,
  Smartphone,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { contrastForegroundHslTriplet, hexToHslTriplet } from "@/lib/branding/color";

const DEFAULT_ORG_NAME = "DAR+ Serviços | Formação";
const DEFAULT_LOGO_SRC = "/brand/logo-fill.png";

const navigation: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/crm", label: "CRM", icon: BarChart3 },
  { href: "/appointments" as Route, label: "Agenda", icon: CalendarDays },
  { href: "/reminders" as Route, label: "Lembretes", icon: Bell },
  { href: "/brokers", label: "Equipe", icon: Users },
  { href: "/settings/agents" as Route, label: "Agentes IA", icon: Bot },
  { href: "/settings/organization" as Route, label: "Organização", icon: Building2 },
  { href: "/settings/whatsapp" as Route, label: "WhatsApp", icon: Smartphone },
  { href: "/settings/integrations" as Route, label: "Integrações", icon: Plug },
  { href: "/settings/logs" as Route, label: "Logs", icon: ClipboardList },
  { href: "/settings", label: "Configuracoes", icon: Settings }
];

export function AppShell({
  children,
  userEmail,
  showSignOut = true,
  orgName,
  orgLogoUrl,
  primaryColor
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  showSignOut?: boolean;
  orgName?: string | null;
  orgLogoUrl?: string | null;
  primaryColor?: string | null;
}) {
  const displayName = orgName?.trim() || DEFAULT_ORG_NAME;
  const logoSrc = orgLogoUrl || DEFAULT_LOGO_SRC;

  // Sobrescreve --primary/--primary-foreground do globals.css só quando a
  // organização escolheu uma cor; caso contrário mantém o padrão do produto.
  const primaryHsl = primaryColor ? hexToHslTriplet(primaryColor) : null;
  const brandStyle = primaryHsl
    ? ({
        "--primary": primaryHsl,
        "--primary-foreground": contrastForegroundHslTriplet(primaryColor as string)
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen bg-background" style={brandStyle}>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo vem de storage externo (Supabase), varia por organização */}
          <img src={logoSrc} alt={displayName} className="h-9 w-auto max-w-[150px] object-contain" />
          <div className="sr-only">
            <p>{displayName}</p>
            <p className="text-xs text-muted-foreground">WhatsApp, IA e CRM</p>
          </div>
        </div>
        <nav className="space-y-1 p-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-muted hover:text-slate-950"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-6 backdrop-blur">
          <div>
            <p className="text-sm font-medium text-slate-950">{userEmail ?? "Usuario"}</p>
            <p className="text-xs text-muted-foreground">Sessao protegida por Supabase Auth</p>
          </div>
          {showSignOut ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          ) : null}
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
