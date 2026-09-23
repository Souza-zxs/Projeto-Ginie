import test from "node:test";
import assert from "node:assert/strict";
import { GUARDRAIL_FALLBACK_REPLY, enforceReplyGuardrails } from "./reply-guardrails.ts";

test("bloqueia a frase real que o modelo escreveu (caso observado em produção)", () => {
  const result = enforceReplyGuardrails(
    "Boa tarde, João. Vamos marcar uma consulta. Em que horário preferem o início?"
  );

  assert.equal(result.reply, GUARDRAIL_FALLBACK_REPLY);
  assert.equal(result.reason, "confirmacao_agendamento");
});

test("bloqueia variações de confirmação de agendamento", () => {
  for (const text of [
    "Fica confirmado para amanhã às 10h.",
    "Confirmo a visita para sexta-feira.",
    "Posso marcar a visita para si na quinta.",
    "A sua visita ficou marcada."
  ]) {
    assert.equal(enforceReplyGuardrails(text).reason, "confirmacao_agendamento", text);
  }
});

test("bloqueia oferta de desconto", () => {
  assert.equal(
    enforceReplyGuardrails("Posso lhe dar um desconto de 10% nesse pacote.").reason,
    "oferta_desconto"
  );
});

test("bloqueia preço fechado", () => {
  assert.equal(
    enforceReplyGuardrails("O orçamento fica em torno de 250€ por semana.").reason,
    "preco_fechado"
  );
});

test("bloqueia conselho médico direto", () => {
  assert.equal(
    enforceReplyGuardrails("O senhor deve tomar a medicação de manhã e à noite.").reason,
    "conselho_medico"
  );
});

test("não mexe em respostas normais", () => {
  const normal = "Boa tarde. Para o podermos ajudar melhor, em que zona vive?";
  assert.deepEqual(enforceReplyGuardrails(normal), { reply: normal, reason: null });
});

test("não bloqueia menção a 'visita' sem confirmar nada", () => {
  const text = "Podemos propor uma visita avaliativa; a nossa equipa entra em contacto para combinar.";
  assert.deepEqual(enforceReplyGuardrails(text), { reply: text, reason: null });
});

test("não bloqueia falar de preço em geral, só quando fecha um valor", () => {
  const text = "O valor é personalizado conforme as horas de apoio.";
  assert.deepEqual(enforceReplyGuardrails(text), { reply: text, reason: null });
});
