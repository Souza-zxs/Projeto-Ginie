import test from "node:test";
import assert from "node:assert/strict";
import { parseUazapiConnection } from "./connection-state.ts";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test("aguardando leitura: QR dentro de instance, socket conectado mas sem login", () => {
  const parsed = parseUazapiConnection({
    connected: true,
    loggedIn: false,
    jid: null,
    instance: { name: "linha1", status: "connecting", qrcode: `data:image/png;base64,${PNG}`, paircode: "" }
  });

  assert.equal(parsed.state, "connecting");
  assert.equal(parsed.qrcode, `data:image/png;base64,${PNG}`);
  assert.equal(parsed.paircode, null);
  assert.equal(parsed.profileName, null); // "linha1" é a instância, não o perfil
});

test("QR em base64 puro vira data URI", () => {
  assert.equal(parseUazapiConnection({ qrcode: PNG }).qrcode, `data:image/png;base64,${PNG}`);
});

test("código de pareamento", () => {
  const parsed = parseUazapiConnection({ instance: { status: "connecting", paircode: "ABCD-1234" } });

  assert.equal(parsed.state, "connecting");
  assert.equal(parsed.paircode, "ABCD-1234");
});

test("conectado: status em objeto com jid", () => {
  const parsed = parseUazapiConnection({
    instance: { status: "connected", profileName: "DAR+ Atendimento", qrcode: "" },
    status: { connected: true, loggedIn: true, jid: "351912345678:12@s.whatsapp.net" }
  });

  assert.equal(parsed.state, "connected");
  assert.equal(parsed.profileName, "DAR+ Atendimento");
  assert.equal(parsed.phone, "351912345678");
  assert.equal(parsed.qrcode, null);
});

test("conectado: status como texto na raiz", () => {
  assert.equal(parseUazapiConnection({ status: "connected" }).state, "connected");
});

test("conectado mesmo se a API ainda devolver um QR antigo: o QR é descartado", () => {
  const parsed = parseUazapiConnection({ connected: true, loggedIn: true, qrcode: PNG });

  assert.equal(parsed.state, "connected");
  assert.equal(parsed.qrcode, null);
});

test("desconectado", () => {
  assert.equal(parseUazapiConnection({ instance: { status: "disconnected" } }).state, "disconnected");
  assert.equal(parseUazapiConnection({ connected: false, loggedIn: false }).state, "disconnected");
});

test("resposta vazia ou estranha não quebra", () => {
  for (const value of [null, undefined, "texto", [], {}]) {
    assert.equal(parseUazapiConnection(value).state, "unknown");
  }
});
