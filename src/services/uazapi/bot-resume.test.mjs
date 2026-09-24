import test from "node:test";
import assert from "node:assert/strict";
import { BOT_RESUME_AFTER_MS, shouldResumeBot } from "./bot-resume.ts";

const now = new Date("2026-09-24T12:00:00Z");
const ago = (ms) => new Date(now.getTime() - ms).toISOString();

test("bot pausado volta depois de 24h sem mensagens", () => {
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(BOT_RESUME_AFTER_MS), now }), true);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(BOT_RESUME_AFTER_MS + 1), now }), true);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(3 * BOT_RESUME_AFTER_MS), now }), true);
});

test("antes de 24h continua pausado, e a resposta manual reinicia a contagem", () => {
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(BOT_RESUME_AFTER_MS - 1), now }), false);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(60 * 1000), now }), false);

  // Equipa respondeu às 09:00 de ontem (27h antes) e de novo há 2h: só a mais recente conta.
  const lastMessageAt = ago(2 * 60 * 60 * 1000);

  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt, now }), false);
});

test("bot ativo, sem histórico ou data inválida: não há o que retomar", () => {
  assert.equal(shouldResumeBot({ botActive: true, lastMessageAt: ago(3 * BOT_RESUME_AFTER_MS), now }), false);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: null, now }), false);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: undefined, now }), false);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: "lixo", now }), false);
});
