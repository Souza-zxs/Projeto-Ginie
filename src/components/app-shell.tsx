import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { contrastForegroundHslTriplet, hexToHslTriplet } from "@/lib/branding/color";
import { SidebarNav } from "@/components/sidebar-nav";

const DEFAULT_ORG_NAME = "DAR+ Serviços | Formação";
const DEFAULT_LOGO_SRC = "/brand/logo-fill.png";

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
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-slate-950 lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-800/80 px-6">
          {/* Chip claro por trás do logo: garante contraste mesmo com logos
              escuros enviados por organizações white-label sobre o fundo escuro. */}
          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo vem de storage externo (Supabase), varia por organização */}
            <img src={logoSrc} alt={displayName} className="h-6 w-auto max-w-[130px] object-contain" />
          </div>
          <div className="sr-only">
            <p>{displayName}</p>
            <p>WhatsApp, IA e CRM</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>

        {/* Trama de pontos artesanal, mesma linguagem visual do login */}
        <div
          aria-hidden
          className="h-16 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(hsl(var(--primary) / 0.6) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            maskImage: "linear-gradient(to top, black, transparent)"
          }}
        />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {getInitials(userEmail)}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-950">{userEmail ?? "Usuario"}</p>
              <p className="text-xs text-muted-foreground">Sessão protegida por Supabase Auth</p>
            </div>
          </div>
          {showSignOut ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-muted"
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

function getInitials(email?: string | null) {
  if (!email) {
    return "U";
  }

  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[.\-_]/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}
