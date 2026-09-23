// Leitura do webhook de mensagens da Uazapi. Sem imports de propósito, para ser
// testável sem o Next (ver webhook-payload.test.mjs).
//
// Formato real (docs.uazapi.com/webhook/messages):
// { EventType: "messages", owner, token, BaseUrl, instanceName,
//   message: { id, messageid, chatid, sender, senderName, fromMe, isGroup,
//              wasSentByApi, messageType, text, messageTimestamp } }
//
// O código antigo esperava { event, instance, data } — formato que a API não envia.
// Ele continua aceito como fallback para não quebrar integrações de teste antigas.

export type UazapiMessage = {
  id?: string;
  messageid?: string;
  chatid?: string;
  sender?: string;
  senderName?: string;
  text?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  wasSentByApi?: boolean;
  messageType?: string;
  /** ID do item tocado numa lista/botão interativo (ex.: "2"). */
  buttonOrListid?: string;
  /** Em resposta de lista, traz o `title` (rótulo) do item tocado; em texto comum é string. */
  content?: unknown;
  hauzapp_cliente_id?: string;
  clienteID?: string;
  clienteId?: string;
};

export type UazapiWebhookPayload = {
  EventType?: string;
  token?: string;
  instanceName?: string;
  owner?: string;
  message?: UazapiMessage | string;
  event?: string;
  instance?: string;
  data?: UazapiMessage | UazapiMessage[];
  phone?: string;
  from?: string;
  text?: string;
  hauzapp_cliente_id?: string;
  clienteID?: string;
  clienteId?: string;
};

export type ParsedUazapiWebhook =
  | { kind: "ignored"; reason: string }
  | {
      kind: "message";
      /** Dígitos do telefone como vieram (antes do "@"); normalizar com normalizePhone. */
      rawPhone: string;
      text: string;
      /** ID do item escolhido numa lista/botão; null em mensagem de texto normal. */
      choiceId: string | null;
      /** ID da mensagem no WhatsApp, usado para descartar reenvios do mesmo webhook. */
      externalMessageId: string | null;
      /** Token da instância que recebeu: identifica o número sem configuração manual. */
      instanceToken: string | null;
      instanceName: string | null;
      senderName: string | null;
      hauzappClienteId: string | null;
    };

/**
 * Cópia do payload sem o `token` da instância, para gravar em logs, mensagens e
 * contatos. O token é a credencial que envia mensagens pelo número: não pode
 * ficar visível na tela de Logs nem em tabelas que a equipe consulta.
 */
export function redactUazapiPayload(payload: UazapiWebhookPayload): UazapiWebhookPayload {
  const { token, ...rest } = payload;

  return token ? { ...rest, token: "[removido]" } : rest;
}

/**
 * Retrato do payload para diagnóstico: nomes dos campos, tipos e sinais (fromMe, grupo,
 * tipo do JID), mas nunca telefone, texto da mensagem ou token. Usado para registrar
 * mensagens descartadas sem expor dados pessoais nos logs.
 */
export function describeUazapiPayloadShape(payload: unknown, reason: string) {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const message = root.message && typeof root.message === "object" ? (root.message as Record<string, unknown>) : null;
  const jidKind = (value: unknown) =>
    typeof value === "string" && value.includes("@") ? `@${value.split("@").pop()}` : typeof value;
  const eventValue = (value: unknown) => (typeof value === "string" ? value.slice(0, 40) : typeof value);

  return {
    reason,
    EventType: eventValue(root.EventType),
    event: eventValue(root.event),
    rootKeys: Object.keys(root),
    messageType: typeof root.message,
    messageKeys: message ? Object.keys(message) : [],
    chatid: jidKind(message?.chatid),
    sender: jidKind(message?.sender),
    fromMe: message?.fromMe ?? null,
    isGroup: message?.isGroup ?? null,
    wasSentByApi: message?.wasSentByApi ?? null,
    msgType: typeof message?.messageType === "string" ? message.messageType : null,
    hasText: typeof message?.text === "string" && message.text.trim().length > 0
  };
}

function extractMessage(payload: UazapiWebhookPayload): UazapiMessage | null {
  if (payload.message && typeof payload.message === "object") {
    return payload.message;
  }

  if (Array.isArray(payload.data)) {
    return payload.data[0] ?? null;
  }

  return payload.data ?? null;
}

function jidDigits(jid: string | undefined) {
  if (!jid || jid.endsWith("@g.us") || jid.endsWith("@lid")) {
    return "";
  }

  return jid.split("@")[0].replace(/\D/g, "");
}

export function parseUazapiWebhook(payload: UazapiWebhookPayload): ParsedUazapiWebhook {
  const eventType = payload.EventType ?? payload.event;

  if (eventType && eventType !== "messages") {
    return { kind: "ignored", reason: `ignored_event_${eventType}` };
  }

  const message = extractMessage(payload);

  if (message?.fromMe) {
    return { kind: "ignored", reason: "ignored_own_message" };
  }

  if (message?.isGroup) {
    return { kind: "ignored", reason: "ignored_group_message" };
  }

  if (message?.wasSentByApi) {
    return { kind: "ignored", reason: "ignored_api_message" };
  }

  // Em conversa individual o chatid é o JID do contato; o sender pode vir como @lid
  // (identificador interno do WhatsApp, sem telefone), por isso chatid tem prioridade.
  const rawPhone =
    jidDigits(message?.chatid) ||
    jidDigits(message?.sender) ||
    String(payload.phone ?? payload.from ?? "").replace(/\D/g, "");

  if (!rawPhone) {
    return { kind: "ignored", reason: "phone_not_found" };
  }

  const legacyText = typeof payload.message === "string" ? payload.message : "";
  const choiceId = typeof message?.buttonOrListid === "string" && message.buttonOrListid.trim() ? message.buttonOrListid.trim() : null;
  const contentObject = message?.content && typeof message.content === "object" ? (message.content as { title?: unknown }) : null;
  const choiceTitle = choiceId && typeof contentObject?.title === "string" ? contentObject.title.trim() : "";
  // Em resposta de lista o texto vem vazio: o rótulo tocado (ou, sem ele, o id) faz de texto.
  const text = (message?.text ?? payload.text ?? legacyText ?? "").trim() || choiceTitle || (choiceId ?? "");

  if (!text) {
    return { kind: "ignored", reason: "empty_text" };
  }

  return {
    kind: "message",
    rawPhone,
    text,
    choiceId,
    externalMessageId: message?.messageid || message?.id || null,
    instanceToken: payload.token || null,
    instanceName: payload.instanceName || payload.instance || null,
    senderName: message?.senderName || null,
    hauzappClienteId:
      message?.hauzapp_cliente_id ||
      message?.clienteID ||
      message?.clienteId ||
      payload.hauzapp_cliente_id ||
      payload.clienteID ||
      payload.clienteId ||
      null
  };
}
