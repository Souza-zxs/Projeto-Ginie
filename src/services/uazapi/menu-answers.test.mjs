import test from "node:test";
import assert from "node:assert/strict";
import { MENU_CHOICE_ROWS } from "./menu-bot.ts";
import { detectMenuProgress, detectMenuTopic, displayAnswer, extractMenuAnswers } from "./menu-answers.ts";

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

test("códigos de lista viram rótulos (respostas antigas gravadas como u2, h5...)", () => {
  const messages = [
    bot("awaiting_1_urgency"), client("u2"),
    bot("awaiting_1_type"), client("h5"),
    bot("awaiting_1"), client("w1"),
    bot("menu"), client("2")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [
    { question: "Urgência", answer: "Próximas semanas" },
    { question: "Tipo de apoio", answer: "Apoio doméstico" },
    { question: "Apoio para quem", answer: "Para mim" },
    { question: "Opção do menu", answer: "Formação" }
  ]);
});

test("texto livre não é alterado", () => {
  assert.equal(displayAnswer("Localidade", "Lisboa"), "Lisboa");
  assert.equal(displayAnswer("Curso", "pode enviar"), "pode enviar");
  assert.equal(displayAnswer("Localidade", "h5 fica em Faro"), "h5 fica em Faro");
});

test("o mapa de rótulos cobre todas as linhas das listas do bot", () => {
  for (const row of MENU_CHOICE_ROWS) {
    const [label, id] = row.split("|");
    const question = /^[1-4]$/.test(id) ? "Opção do menu" : "Outra";

    if (/^[1-4]$/.test(id)) {
      // Menu principal: o rótulo da lista pode ser mais curto, mas tem de existir uma tradução.
      assert.notEqual(displayAnswer(question, id), id, row);
    } else {
      assert.equal(displayAnswer(question, id), label, row);
    }
  }
});
