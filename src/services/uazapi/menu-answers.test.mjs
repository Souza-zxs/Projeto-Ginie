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

test("ao voltar, a resposta anterior deixa de valer e só a nova conta", () => {
  const messages = [
    bot("menu"), client("Apoio domiciliário"),
    bot("awaiting_1"), client("Pai ou mãe"),
    bot("awaiting_1_type"), client("Higiene pessoal"),
    bot("awaiting_1_urgency"), client("← Voltar"),
    bot("awaiting_1_type"), client("Companhia"),
    bot("awaiting_1_urgency"), client("O quanto antes"),
    bot("awaiting_1_zone")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [
    { question: "Opção do menu", answer: "Apoio domiciliário" },
    { question: "Apoio para quem", answer: "Pai ou mãe" },
    { question: "Tipo de apoio", answer: "Companhia" },
    { question: "Urgência", answer: "O quanto antes" }
  ]);
});

test("voltar digitado, e voltar a partir da localidade (com nova tentativa no meio)", () => {
  const messages = [
    bot("awaiting_1_urgency"), client("u1"),
    bot("awaiting_1_zone"), client("👍"),
    bot("awaiting_1_zone_retry"), client("voltar"),
    bot("awaiting_1_urgency"), client("u3"),
    bot("awaiting_1_zone")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Urgência", answer: "Só a informar-me" }]);
});

test("voltar do primeiro nível volta ao menu e o assunto recomeça", () => {
  const messages = [
    client("olá"), bot("menu"),
    client("Formação"), bot("awaiting_2"),
    client("← Voltar"), bot("menu"),
    client("Candidatura"), bot("awaiting_3")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Opção do menu", answer: "Candidatura" }]);
  assert.equal(detectMenuTopic(messages), "recruitment");
  assert.equal(detectMenuTopic(messages.slice(0, 6)), null);
});

test("digitar 'voltar' onde não há como voltar é só texto", () => {
  const messages = [bot("menu"), client("voltar")];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Opção do menu", answer: "voltar" }]);
});

test("confirmação: 'sim' mantém a localidade e não vira resposta própria", () => {
  const messages = [
    bot("awaiting_1_zone"), client("Lisboa"),
    bot("awaiting_1_confirm"), client("Sim, está certo"),
    bot("done")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Localidade", answer: "Lisboa" }]);
});

test("confirmação: 'corrigir' descarta a localidade; escrever outra confirma a nova", () => {
  const corrected = [
    bot("awaiting_1_zone"), client("Lisbo"),
    bot("awaiting_1_confirm"), client("Corrigir"),
    bot("awaiting_1_zone"), client("Lisboa"),
    bot("awaiting_1_confirm"), client("Sim"),
    bot("done")
  ];

  assert.deepEqual(extractMenuAnswers(corrected), [{ question: "Localidade", answer: "Lisboa" }]);

  const typedNew = [
    bot("awaiting_1_zone"), client("Lisbo"),
    bot("awaiting_1_confirm"), client("Porto"),
    bot("awaiting_1_confirm"), client("Sim"),
    bot("done")
  ];

  assert.deepEqual(extractMenuAnswers(typedNew), [{ question: "Localidade", answer: "Porto" }]);
});

test("confirmação: voltar descarta a urgência e a localidade", () => {
  const messages = [
    bot("awaiting_1_urgency"), client("u1"),
    bot("awaiting_1_zone"), client("Lisboa"),
    bot("awaiting_1_confirm"), client("← Voltar"),
    bot("awaiting_1_urgency")
  ];

  assert.deepEqual(extractMenuAnswers(messages), []);
});

test("confirmação do nome e zona da candidatura", () => {
  const messages = [
    bot("awaiting_3_details"), client("Ana"),
    bot("awaiting_3_confirm"), client("Corrigir"),
    bot("awaiting_3_details"), client("Ana Costa, Porto"),
    bot("awaiting_3_confirm"), client("Sim"),
    bot("done")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Nome e zona", answer: "Ana Costa, Porto" }]);
});
