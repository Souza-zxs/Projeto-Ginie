import test from "node:test";
import assert from "node:assert/strict";
import { GUARDRAIL_FALLBACK_REPLY, applyConversationGuardrails, enforceReplyGuardrails, stripRepeatedGreeting, toEuropeanPortuguese } from "./reply-guardrails.ts";

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

test("parentesco: pessoa disse avó e a resposta traz avô -> bloqueia", () => {
  const r = enforceReplyGuardrails("Percebi, é para a sua avó e avô. Em que zona vivem?", "É para a minha avó");
  assert.equal(r.reply, GUARDRAIL_FALLBACK_REPLY);
  assert.equal(r.reason, "parentesco_inventado");
});

test("parentesco: resposta que repete só o que a pessoa disse passa", () => {
  const r = enforceReplyGuardrails("Percebi, é para a sua avó. Em que zona vive?", "É para a minha avó");
  assert.equal(r.reason, null);
});

test("parentesco: a pessoa falou nos dois ou em plural -> passa", () => {
  assert.equal(enforceReplyGuardrails("Para o avô e a avó, certo?", "avô e avó").reason, null);
  assert.equal(enforceReplyGuardrails("Para o avô e a avó, certo?", "são os meus avós").reason, null);
  assert.equal(enforceReplyGuardrails("Para o avô?", "para o meu avo").reason, null);
});

test("cumprimento repetido é removido quando já houve um", () => {
  assert.equal(stripRepeatedGreeting("Boa tarde, João. Em que zona vive?", ["Boa tarde! Como posso ajudar?"]), "Em que zona vive?");
  assert.equal(stripRepeatedGreeting("Boa tarde. Obrigado pela informação.", ["Olá"]), "Obrigado pela informação.");
  assert.equal(stripRepeatedGreeting("Boa tarde, obrigado pela informação.", ["Boa tarde"]), "Obrigado pela informação.");
});

test("primeiro cumprimento é mantido", () => {
  assert.equal(stripRepeatedGreeting("Boa tarde, João. Em que posso ajudar?", []), "Boa tarde, João. Em que posso ajudar?");
  assert.equal(stripRepeatedGreeting("Boa tarde.", ["Boa tarde"]), "Boa tarde.");
});

test("applyConversationGuardrails junta as duas regras", () => {
  const msgs = [
    { direction: "outbound", content: "Boa tarde! Em que posso ajudar?" },
    { direction: "inbound", content: "É para a minha avó" }
  ];
  assert.equal(applyConversationGuardrails("Boa tarde. Qual a zona onde vive a sua avó?", msgs).reply, "Qual a zona onde vive a sua avó?");
  assert.equal(applyConversationGuardrails("Boa tarde. Vivem o avô e a avó aí?", msgs).reason, "parentesco_inventado");
});

test("pt-PT: gerúndio vira 'a + infinitivo'", () => {
  assert.equal(toEuropeanPortuguese("Estou verificando e estamos fazendo o possível."), "Estou a verificar e estamos a fazer o possível.");
  assert.equal(toEuropeanPortuguese("Ela está indo ao médico?"), "Ela está a ir ao médico?");
});

test("pt-PT: 'você' sai e o léxico do Brasil é trocado", () => {
  assert.equal(toEuropeanPortuguese("Você pode deixar o seu celular? O nosso time fala com você."), "Pode deixar o seu telemóvel? A nossa equipa fala consigo.");
  assert.equal(toEuropeanPortuguese("Qual o seu endereço e contato?"), "Qual a sua morada e contacto?");
});

test("pt-PT: texto já correto não muda", () => {
  const ok = "Boa tarde. Estou a verificar a morada e o contacto da equipa.";
  assert.equal(toEuropeanPortuguese(ok), ok);
});

test("pt-PT: 'vamos agendar' passa a 'vamos marcar' e é bloqueado", () => {
  assert.equal(enforceReplyGuardrails("Vamos agendar uma visita amanhã.").reason, "confirmacao_agendamento");
});
