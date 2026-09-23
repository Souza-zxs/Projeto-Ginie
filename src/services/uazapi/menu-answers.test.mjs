import test from "node:test";
import assert from "node:assert/strict";
import { detectMenuProgress, detectMenuTopic, extractMenuAnswers } from "./menu-answers.ts";

const bot = (step, content = "pergunta") => ({ direction: "outbound", content, menu_step: step });
const client = (content) => ({ direction: "inbound", content, menu_step: null });

const supportFlow = [
  client("Olá"),
  bot("menu"),
  client("Apoio domiciliário"),
  bot("awaiting_1"),
  client("Pai ou mãe"),
  bot("awaiting_1_type"),
  client("Higiene pessoal"),
  bot("awaiting_1_urgency"),
  client("O quanto antes"),
  bot("awaiting_1_zone"),
  client("👍"),
  bot("awaiting_1_zone_retry"),
  client("Lisboa"),
  bot("done"),
  bot("done")
];

test("associa cada resposta à pergunta feita antes dela", () => {
  assert.deepEqual(extractMenuAnswers(supportFlow), [
    { question: "Opção do menu", answer: "Apoio domiciliário" },
    { question: "Apoio para quem", answer: "Pai ou mãe" },
    { question: "Tipo de apoio", answer: "Higiene pessoal" },
    { question: "Urgência", answer: "O quanto antes" },
    { question: "Localidade", answer: "👍" },
    { question: "Localidade", answer: "Lisboa" }
  ]);
});

test("a primeira mensagem (antes do menu) não é resposta", () => {
  assert.deepEqual(extractMenuAnswers([client("Olá"), bot("menu")]), []);
});

test("mensagem manual da equipa não altera a pergunta pendente", () => {
  const messages = [bot("awaiting_1_zone"), { direction: "outbound", content: "Olá, sou da equipa", menu_step: null }, client("Porto")];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Localidade", answer: "Porto" }]);
});

test("mensagens depois do encaminhamento ficam à parte", () => {
  const messages = [...supportFlow, client("Ainda aí?")];
  const answers = extractMenuAnswers(messages);

  assert.deepEqual(answers.at(-1), { question: "Depois do encaminhamento", answer: "Ainda aí?" });
});

test("identifica o assunto pelo caminho do menu", () => {
  assert.equal(detectMenuTopic(supportFlow), "support");
  assert.equal(detectMenuTopic([client("olá"), bot("menu"), client("2"), bot("awaiting_2")]), "training");
  assert.equal(detectMenuTopic([bot("menu"), client("3"), bot("awaiting_3")]), "recruitment");
  assert.equal(detectMenuTopic([client("olá"), bot("menu"), client("4"), bot("done")]), "other");
  assert.equal(detectMenuTopic([client("olá"), bot("menu")]), null);
});

test("progresso: em andamento, encaminhado ou sem menu", () => {
  assert.equal(detectMenuProgress(supportFlow), "handed_off");
  assert.equal(detectMenuProgress(supportFlow.slice(0, 6)), "in_progress");
  assert.equal(detectMenuProgress([client("oi"), { direction: "outbound", content: "x", menu_step: null }]), "no_menu");
});
