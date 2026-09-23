// Leitura da resposta de /instance/connect e /instance/status da Uazapi.
// Sem imports de propósito, para ser testável sem o Next (connection-state.test.mjs).
//
// A documentação pública não detalha o formato exato da resposta, então aceita as
// variações prováveis: campos na raiz ou dentro de `instance`, e `status` como texto
// ("connected") ou como objeto ({ connected, loggedIn, jid }).

export type UazapiConnectionState = {
  state: "connected" | "connecting" | "disconnected" | "unknown";
  /** Status como veio da API, para diagnóstico. */
  rawStatus: string | null;
  /** QR code pronto para <img src>, sempre como data URI. */
  qrcode: string | null;
  /** Código de pareamento (alternativa ao QR). */
  paircode: string | null;
  profileName: string | null;
  /** Número conectado, só dígitos, quando a API informa o JID. */
  phone: string | null;
};

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function firstString(sources: Array<Json | null>, keys: string[]) {
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function firstBoolean(sources: Array<Json | null>, key: string) {
  for (const source of sources) {
    const value = source?.[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function toDataUri(qrcode: string | null) {
  if (!qrcode) return null;
  return qrcode.startsWith("data:") ? qrcode : `data:image/png;base64,${qrcode}`;
}

function phoneFromJid(jid: string | null) {
  if (!jid) return null;
  const digits = jid.split(/[:@]/)[0].replace(/\D/g, "");
  return digits || null;
}

export function parseUazapiConnection(json: unknown): UazapiConnectionState {
  const root = asObject(json);
  const instance = asObject(root?.instance);
  const statusObject = asObject(root?.status);
  const sources = [instance, statusObject, root];

  const rawStatus =
    firstString([instance], ["status", "state"]) ??
    (typeof root?.status === "string" ? root.status : null) ??
    firstString([root], ["state"]);
  const connected = firstBoolean(sources, "connected");
  const loggedIn = firstBoolean(sources, "loggedIn");
  const qrcode = toDataUri(firstString(sources, ["qrcode", "qr", "base64"]));
  const paircode = firstString(sources, ["paircode", "pairingCode", "pairCode"]);

  // Durante a leitura do QR o socket pode estar "connected" sem sessão: só conta como
  // conectado quando está logado (ou quando a API diz o status "connected" por extenso).
  const isConnected =
    rawStatus === "connected" || rawStatus === "open" || (connected === true && loggedIn !== false);

  const state: UazapiConnectionState["state"] = isConnected
    ? "connected"
    : rawStatus === "connecting" || qrcode || paircode
      ? "connecting"
      : rawStatus === "disconnected" || rawStatus === "close" || connected === false || loggedIn === false
        ? "disconnected"
        : "unknown";

  return {
    state,
    rawStatus,
    qrcode: isConnected ? null : qrcode,
    paircode: isConnected ? null : paircode,
    // Sem "name": em `instance` ele é o nome da instância ("linha1"), não o do perfil.
    profileName: firstString(sources, ["profileName", "pushName"]),
    phone: phoneFromJid(firstString(sources, ["jid", "owner", "wid"]))
  };
}
