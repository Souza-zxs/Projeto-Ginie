import test from "node:test";
import assert from "node:assert/strict";
import { requiresHuman, wantsScheduling, handoffNote, composeHandoffReply } from "./human-handoff.ts";

test("pede explicitamente uma pessoa -> encaminha", () => {
  assert.equal(requiresHuman("Quero falar com uma pessoa"), true);
  assert.equal(requiresHuman("posso falar com a equipa?"), true);
  assert.equal(requiresHuman("preciso de um atendente"), true);
  assert.equal(requiresHuman("ligue-me por favor"), true);
});

test("assunto que só um humano resolve -> encaminha", () => {
  assert.equal(requiresHuman("A cuidadora não apareceu ontem!"), true);
  assert.equal(requiresHuman("A minha mãe caiu hoje"), true);
  assert.equal(requiresHuman("Conseguem desconto?"), true);
  assert.equal(requiresHuman("quero cancelar o contrato"), true);
});

test("conversa normal -> o bot continua", () => {
  assert.equal(requiresHuman("preciso de uma cuidadora para a minha avó"), false);
  assert.equal(requiresHuman("voce pode conversar comigo normalmente?"), false);
  assert.equal(requiresHuman("Em Cascais"), false);
  assert.equal(requiresHuman(""), false);
});

test("agendamento é só pela equipa", () => {
  assert.equal(requiresHuman("queria horario amanhã a tarde"), true);
  assert.equal(requiresHuman("podem marcar uma visita?"), true);
  assert.equal(requiresHuman("quero agendar para hoje ainda"), true);
  assert.equal(wantsScheduling("qual horario disponivel para amanhã?"), true);
  assert.match(handoffNote("quero agendar a visita"), /melhor dia e hora/);
  assert.match(handoffNote("quero falar com uma pessoa"), /passar a sua conversa/);
  assert.equal(wantsScheduling("preciso de uma cuidadora para a minha avó"), false);
});

test("encaminhamento por agendamento usa uma frase única, sem prometer horários", () => {
  const r = composeHandoffReply("queria marcar uma visita amanhã à tarde", "Vou ver os horários que temos disponíveis.");
  assert.match(r, /pedir à nossa equipa/);
  assert.doesNotMatch(r, /horários que temos/);
  assert.equal(composeHandoffReply("quero falar com uma pessoa", "Claro, passo já à equipa."), "Claro, passo já à equipa.");
  assert.match(composeHandoffReply("quero falar com uma pessoa", "Claro."), /passar a sua conversa/);
});
