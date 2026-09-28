import test from "node:test";
import assert from "node:assert/strict";
import { BOT_RESUME_AFTER_MS, shouldResumeBot } from "./bot-resume.ts";

const now = new Date("2026-09-24T12:00:00Z");
const ago = (ms) => new Date(now.getTime() - ms).toISOString();

test("bot pausado por ele mesmo volta depois de 24h sem mensagens", () => {
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(BOT_RESUME_AFTER_MS), lastOutboundWasBot: true, now }), true);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(BOT_RESUME_AFTER_MS + 1), lastOutboundWasBot: true, now }), true);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(3 * BOT_RESUME_AFTER_MS), lastOutboundWasBot: true, now }), true);
});

test("antes de 24h continua pausado", () => {
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(BOT_RESUME_AFTER_MS - 1), lastOutboundWasBot: true, now }), false);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(60 * 1000), lastOutboundWasBot: true, now }), false);
});

test("quando quem pausou foi uma pessoa (telefone ou Inbox), nunca volta sozinho, mesmo depois de muito tempo", () => {
  for (const ms of [BOT_RESUME_AFTER_MS, 3 * BOT_RESUME_AFTER_MS, 10 * BOT_RESUME_AFTER_MS]) {
    assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: ago(ms), lastOutboundWasBot: false, now }), false);
  }
});

test("bot ativo, sem histórico ou data inválida: não há o que retomar", () => {
  assert.equal(shouldResumeBot({ botActive: true, lastMessageAt: ago(3 * BOT_RESUME_AFTER_MS), lastOutboundWasBot: true, now }), false);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: null, lastOutboundWasBot: true, now }), false);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: undefined, lastOutboundWasBot: true, now }), false);
  assert.equal(shouldResumeBot({ botActive: false, lastMessageAt: "lixo", lastOutboundWasBot: true, now }), false);
});
