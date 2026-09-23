"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";

const SEEN_KEY = "ginie:inbox-seen-at";
const POLL_MS = 10_000;

function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

function writeSeen(value: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, value);
  } catch {
    // Sem localStorage o ponto só some ao abrir o Inbox; não quebra nada.
  }
}

/**
 * Link do Inbox no menu, com ponto vermelho quando chegou mensagem de contacto depois da
 * última vez que o Inbox esteve aberto neste navegador. O "visto" fica no navegador (não no
 * banco), então cada pessoa da equipa tem o seu próprio ponto.
 */
export function InboxNavLink() {
  const pathname = usePathname();
  const [hasNew, setHasNew] = useState(false);
  const onInbox = pathname.startsWith("/inbox");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch("/api/inbox/latest", { cache: "no-store" });

        if (!response.ok || cancelled) {
          return;
        }

        const { latestInboundAt } = (await response.json()) as { latestInboundAt: string | null };

        if (!latestInboundAt) {
          return;
        }

        const seen = readSeen();

        // Primeiro uso neste navegador: o histórico existente não conta como novidade.
        if (onInbox || !seen) {
          writeSeen(latestInboundAt);
          setHasNew(false);
          return;
        }

        setHasNew(new Date(latestInboundAt).getTime() > new Date(seen).getTime());
      } catch {
        // Falha de rede: mantém o estado atual e tenta no próximo ciclo.
      }
    };

    void check();
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [onInbox]);

  return (
    <Link
      href="/inbox"
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-muted hover:text-slate-950"
    >
      <Inbox className="h-4 w-4" />
      Inbox
      {hasNew && !onInbox ? (
        <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" role="status">
          <span className="sr-only">Novas mensagens</span>
        </span>
      ) : null}
    </Link>
  );
}
