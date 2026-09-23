import test from "node:test";
import assert from "node:assert/strict";
import { describeUazapiPayloadShape, parseUazapiWebhook, redactUazapiPayload } from "./webhook-payload.ts";

// Exemplo copiado de docs.uazapi.com/webhook/messages.
const docExample = {
  EventType: "messages",
  owner: "5511999999999",
  token: "INSTANCE_TOKEN",
  BaseUrl: "https://seu-servidor.example",
  instanceName: "Atendimento",
  message: {
    id: "5511999999999:MSG_EXEMPLO",
    messageid: "MSG_EXEMPLO",
    chatid: "5511888888888@s.whatsapp.net",
    sender: "5511888888888@s.whatsapp.net",
    senderName: "Contato de exemplo",
    fromMe: false,
    isGroup: false,
    messageType: "Conversation",
    text: "Olá, preciso de ajuda.",
    messageTimestamp: 1788868800000
  }
};

const withMessage = (overrides) => ({ ...docExample, message: { ...docExample.message, ...overrides } });

test("lê o exemplo oficial da documentação", () => {
  assert.deepEqual(parseUazapiWebhook(docExample), {
    kind: "message",
    rawPhone: "5511888888888",
    text: "Olá, preciso de ajuda.",
    externalMessageId: "MSG_EXEMPLO",
    instanceToken: "INSTANCE_TOKEN",
    instanceName: "Atendimento",
    senderName: "Contato de exemplo",
    hauzappClienteId: null
  });
});

test("número de Portugal", () => {
  const parsed = parseUazapiWebhook(withMessage({ chatid: "351912345678@s.whatsapp.net" }));

  assert.equal(parsed.kind, "message");
  assert.equal(parsed.rawPhone, "351912345678");
});

test("ignora outros eventos (status, conexão)", () => {
  assert.deepEqual(parseUazapiWebhook({ ...docExample, EventType: "messages_update" }), {
    kind: "ignored",
    reason: "ignored_event_messages_update"
  });
  assert.equal(parseUazapiWebhook({ ...docExample, EventType: "connection" }).kind, "ignored");
});

test("ignora mensagem enviada pelo próprio número", () => {
  assert.equal(parseUazapiWebhook(withMessage({ fromMe: true })).reason, "ignored_own_message");
});

test("ignora mensagem enviada pela própria API (a resposta do agente)", () => {
  assert.equal(parseUazapiWebhook(withMessage({ wasSentByApi: true })).reason, "ignored_api_message");
});

test("ignora grupo", () => {
  assert.equal(
    parseUazapiWebhook(withMessage({ isGroup: true, chatid: "120363000000000000@g.us" })).reason,
    "ignored_group_message"
  );
});

test("sender em @lid não é telefone: usa o chatid", () => {
  const parsed = parseUazapiWebhook(withMessage({ sender: "123456789012345@lid" }));

  assert.equal(parsed.rawPhone, "5511888888888");
});

test("sem telefone utilizável, ignora", () => {
  const parsed = parseUazapiWebhook(withMessage({ chatid: "123@lid", sender: "456@lid" }));

  assert.deepEqual(parsed, { kind: "ignored", reason: "phone_not_found" });
});

test("mídia sem legenda (texto vazio) é ignorada", () => {
  assert.equal(parseUazapiWebhook(withMessage({ text: "", messageType: "AudioMessage" })).reason, "empty_text");
});

test("sem messageid, usa o id como identificador", () => {
  assert.equal(parseUazapiWebhook(withMessage({ messageid: undefined })).externalMessageId, "5511999999999:MSG_EXEMPLO");
});

test("o token da instância nunca vai para o que é gravado", () => {
  const redacted = redactUazapiPayload(docExample);

  assert.equal(redacted.token, "[removido]");
  assert.ok(!JSON.stringify(redacted).includes("INSTANCE_TOKEN"));
  assert.equal(redacted.message.text, "Olá, preciso de ajuda.");
  assert.equal(docExample.token, "INSTANCE_TOKEN"); // não altera o original
});

test("o retrato para diagnóstico não leva telefone, texto nem token", () => {
  const shape = describeUazapiPayloadShape(docExample, "teste");
  const serialized = JSON.stringify(shape);

  assert.equal(shape.EventType, "messages");
  assert.equal(shape.chatid, "@s.whatsapp.net");
  assert.equal(shape.hasText, true);
  assert.ok(shape.messageKeys.includes("messageid"));
  for (const secret of ["5511888888888", "5511999999999", "Olá, preciso de ajuda", "INSTANCE_TOKEN", "Contato de exemplo"]) {
    assert.ok(!serialized.includes(secret), `vazou: ${secret}`);
  }
});

test("payload sem token continua sem token", () => {
  assert.ok(!("token" in redactUazapiPayload({ event: "messages" })));
});

test("formato antigo { event, instance, data } continua aceito", () => {
  const parsed = parseUazapiWebhook({
    event: "messages",
    instance: "linha-1",
    data: [{ chatid: "5583999999999@s.whatsapp.net", text: "oi" }]
  });

  assert.equal(parsed.kind, "message");
  assert.equal(parsed.rawPhone, "5583999999999");
  assert.equal(parsed.instanceName, "linha-1");
  assert.equal(parsed.externalMessageId, null);
});
