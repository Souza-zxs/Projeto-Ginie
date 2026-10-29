import test from "node:test";
import assert from "node:assert/strict";
import { hasUazapiChatHistory } from "./chat-history-shape.ts";

test("array na raiz", () => {
  assert.equal(hasUazapiChatHistory([{ id: "1" }]), true);
  assert.equal(hasUazapiChatHistory([]), false);
});

test("array dentro de data/messages/chats", () => {
  assert.equal(hasUazapiChatHistory({ data: [{ id: "1" }] }), true);
  assert.equal(hasUazapiChatHistory({ messages: [{ id: "1" }] }), true);
  assert.equal(hasUazapiChatHistory({ chats: [{ id: "1" }] }), true);
  assert.equal(hasUazapiChatHistory({ data: [] }), false);
});

test("pagination.total", () => {
  assert.equal(hasUazapiChatHistory({ pagination: { total: 3 } }), true);
  assert.equal(hasUazapiChatHistory({ pagination: { total: 0 } }), false);
  assert.equal(hasUazapiChatHistory({ pagination: { total: "3" } }), false); // não é número: não confia
});

test("formato desconhecido ou vazio conta como sem histórico (falha aberta)", () => {
  for (const payload of [{}, { error: "not found" }, null, undefined, "texto", 42, { data: "não é array" }]) {
    assert.equal(hasUazapiChatHistory(payload), false, JSON.stringify(payload));
  }
});
