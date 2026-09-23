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
  const text = (message?.text ?? payload.text ?? legacyText ?? "").trim();

  if (!text) {
    return { kind: "ignored", reason: "empty_text" };
  }

  return {
    kind: "message",
    rawPhone,
    text,
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
