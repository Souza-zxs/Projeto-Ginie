// Chamadas de gestão da instância na Uazapi (conectar, status, desconectar, webhook).
// Rodam só no servidor: o token da instância nunca deve chegar ao navegador.
import { parseUazapiConnection } from "@/services/uazapi/connection-state";

export type UazapiCredentials = { baseUrl: string; token: string };

async function callUazapi(credentials: UazapiCredentials, method: "GET" | "POST", path: string, body?: unknown) {
  const response = await fetch(`${credentials.baseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      token: credentials.token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000)
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const detail = [payload.error, payload.message].find((value) => typeof value === "string");
    throw new Error(`Uazapi respondeu HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  return payload;
}

export async function getUazapiConnection(credentials: UazapiCredentials) {
  return parseUazapiConnection(await callUazapi(credentials, "GET", "/instance/status"));
}

/** Sem `phone` a Uazapi gera QR code; com `phone` (código do país + número) gera código de pareamento. */
export async function connectUazapiInstance(credentials: UazapiCredentials, phone?: string | null) {
  return parseUazapiConnection(
    await callUazapi(credentials, "POST", "/instance/connect", phone ? { phone } : {})
  );
}

export async function disconnectUazapiInstance(credentials: UazapiCredentials) {
  await callUazapi(credentials, "POST", "/instance/disconnect", {});
}

/**
 * Aponta o webhook da instância para o sistema, só com o evento de mensagens e sem
 * as mensagens que o próprio sistema envia (evita o agente responder a si mesmo).
 * `addUrlEvents` desligado: senão a Uazapi acrescenta "/messages" à URL e dá 404.
 */
export async function configureUazapiWebhook(credentials: UazapiCredentials, url: string) {
  await callUazapi(credentials, "POST", "/webhook", {
    enabled: true,
    url,
    events: ["messages"],
    excludeMessages: ["wasSentByApi"],
    addUrlEvents: false,
    addUrlTypesMessages: false
  });
}
