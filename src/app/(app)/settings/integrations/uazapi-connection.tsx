"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2, Power, QrCode, Smartphone } from "lucide-react";
import { Badge } from "@/components/badge";
import type { UazapiConnectionState } from "@/services/uazapi/connection-state";
import {
  disconnectUazapiAction,
  getUazapiConnectionAction,
  startUazapiConnectionAction,
  type UazapiConnectionResult
} from "./uazapi-connection-actions";

// A Uazapi pede para não consultar o status em excesso: só enquanto o QR/código está na
// tela, a cada 4 s, e para ao conectar ou depois de 2 minutos.
const POLL_INTERVAL_MS = 4_000;
const POLL_LIMIT_MS = 120_000;

type Busy = "loading" | "connecting" | "disconnecting" | null;

const STATE_LABEL: Record<UazapiConnectionState["state"], string> = {
  connected: "Conectado",
  connecting: "Aguardando leitura",
  disconnected: "Desconectado",
  unknown: "Status desconhecido"
};

const buttonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";

export function UazapiConnection({ integrationId, name }: { integrationId: string; name: string }) {
  const [connection, setConnection] = useState<UazapiConnectionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>("loading");
  const [polling, setPolling] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pairingMode, setPairingMode] = useState(false);
  const [phone, setPhone] = useState("");

  function apply(result: UazapiConnectionResult) {
    if (result.ok) {
      setConnection(result.connection);
      setError(null);
    } else {
      setError(result.error);
    }
  }

  useEffect(() => {
    let active = true;

    getUazapiConnectionAction(integrationId).then((result) => {
      if (!active) return;
      apply(result);
      setBusy(null);
    });

    return () => {
      active = false;
    };
  }, [integrationId]);

  useEffect(() => {
    if (!polling) return;

    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        clearInterval(timer);
        setPolling(false);
        setExpired(true);
        return;
      }

      const result = await getUazapiConnectionAction(integrationId);
      if (!result.ok) return;

      const next = result.connection;

      if (next.state === "connected") {
        clearInterval(timer);
        setPolling(false);
        setConnection(next);
        return;
      }

      // O status nem sempre devolve o QR: mantém o que está na tela, e troca quando vier um novo.
      setConnection((previous) => ({
        ...next,
        state: "connecting",
        qrcode: next.qrcode ?? previous?.qrcode ?? null,
        paircode: next.paircode ?? previous?.paircode ?? null
      }));
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [polling, integrationId]);

  async function connect(withPhone?: string) {
    setBusy("connecting");
    setExpired(false);
    const result = await startUazapiConnectionAction(integrationId, withPhone);
    apply(result);
    setBusy(null);

    if (result.ok && result.connection.state !== "connected") {
      setPolling(true);
    }
  }

  async function disconnect() {
    const confirmed = window.confirm(
      `Desconectar "${name}"? O agente para de responder por este número até ele ser conectado de novo.`
    );
    if (!confirmed) return;

    setBusy("disconnecting");
    setPolling(false);
    apply(await disconnectUazapiAction(integrationId));
    setBusy(null);
  }

  const state = connection?.state ?? "unknown";
  const isConnected = state === "connected";
  const showCodes = polling && !isConnected;

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-950">{name}</p>
        <span aria-live="polite">
          {busy === "loading" ? (
            <Badge tone="muted">Verificando…</Badge>
          ) : (
            <Badge tone={isConnected ? "success" : state === "connecting" ? "warning" : "muted"}>
              {STATE_LABEL[state]}
            </Badge>
          )}
        </span>
      </div>

      {isConnected && (connection?.profileName || connection?.phone) ? (
        <p className="text-sm text-muted-foreground">
          {[connection.profileName, connection.phone ? `+${connection.phone}` : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {showCodes && connection?.qrcode ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Image
            src={connection.qrcode}
            alt={`QR code para conectar o WhatsApp da conexão ${name}`}
            width={220}
            height={220}
            unoptimized
            className="h-[220px] w-[220px] shrink-0 rounded-md border bg-white p-2"
          />
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Abra o WhatsApp no celular deste número.</li>
            <li>Toque em Configurações (ou ⋮) → Aparelhos conectados.</li>
            <li>Toque em Conectar um aparelho e aponte a câmera para o código.</li>
          </ol>
        </div>
      ) : null}

      {showCodes && connection?.paircode ? (
        <div className="space-y-2">
          <p className="font-mono text-2xl font-semibold tracking-[0.2em] text-slate-950">{connection.paircode}</p>
          <p className="text-sm text-slate-700">
            No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho →{" "}
            <b>Conectar com número de telefone</b>, e digite este código.
          </p>
        </div>
      ) : null}

      {showCodes && !connection?.qrcode && !connection?.paircode ? (
        <p className="text-sm text-muted-foreground">
          A Uazapi não devolveu QR code nem código. Tente gerar de novo em alguns segundos.
        </p>
      ) : null}

      {expired && !isConnected ? (
        <p className="text-sm text-muted-foreground">O código expirou sem ser lido. Gere outro para tentar de novo.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isConnected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy !== null}
            className={`${buttonClass} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
          >
            {busy === "disconnecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            Desconectar
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => connect()}
              disabled={busy !== null}
              className={`${buttonClass} bg-primary text-primary-foreground hover:opacity-90`}
            >
              {busy === "connecting" && !pairingMode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {showCodes || expired ? "Gerar novo QR code" : "Conectar com QR code"}
            </button>
            <button
              type="button"
              onClick={() => setPairingMode((value) => !value)}
              disabled={busy !== null}
              className={`${buttonClass} border bg-white text-slate-700 hover:bg-muted`}
            >
              <Smartphone className="h-4 w-4" />
              Usar código de pareamento
            </button>
          </>
        )}
      </div>

      {pairingMode && !isConnected ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            connect(phone);
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-950">Número deste WhatsApp, com código do país</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              placeholder="351912345678"
              className="h-11 w-56 rounded-md border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <button
            type="submit"
            disabled={busy !== null || !phone.trim()}
            className={`${buttonClass} bg-primary text-primary-foreground hover:opacity-90`}
          >
            {busy === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Gerar código
          </button>
        </form>
      ) : null}
    </div>
  );
}
