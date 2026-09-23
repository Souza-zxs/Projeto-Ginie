import test from "node:test";
import assert from "node:assert/strict";
import {
  HANDOFF_DAY,
  HANDOFF_NIGHT,
  MENU_WELCOME,
  OPTION_REPLIES,
  decideMenuReply,
  parseMenuChoice,
  readMenuStep
} from "./menu-bot.ts";

test("reconhece a escolha em várias formas", () => {
  for (const text of ["1", " 2 ", "3.", "4!", "1️⃣", "2️⃣", "opção 3", "Opcao 4", "a 2", "nº 1", "número 3"]) {
    assert.notEqual(parseMenuChoice(text), null, text);
  }
  assert.equal(parseMenuChoice("1️⃣"), 1);
  assert.equal(parseMenuChoice("opção 3"), 3);
  assert.equal(parseMenuChoice("número 4."), 4);
});

test("não confunde texto livre com escolha", () => {
  for (const text of ["", "olá", "5", "0", "12", "quero a 1 e a 2", "tenho 3 filhos", "1 2"]) {
    assert.equal(parseMenuChoice(text), null, text);
  }
});

test("primeiro contacto (ou estado desconhecido) envia o menu", () => {
  for (const lastStep of [null, "done", readMenuStep("lixo")]) {
    const decision = decideMenuReply({ lastStep, text: "olá", night: false });

    assert.deepEqual(decision.replies, [MENU_WELCOME]);
    assert.equal(decision.nextStep, "menu");
    assert.equal(decision.handoff, false);
    assert.equal(decision.list.choices.length, 4);
    assert.match(decision.list.choices[1], /\|2\|/);
  }
});

test("opções 1, 2 e 3 abrem uma lista de escolha e aguardam a resposta", () => {
  for (const choice of [1, 2, 3]) {
    const decision = decideMenuReply({ lastStep: "menu", text: String(choice), night: false });

    assert.deepEqual(decision.replies, [OPTION_REPLIES[choice]]);
    assert.equal(decision.nextStep, `awaiting_${choice}`);
    assert.equal(decision.handoff, false);
    assert.ok(decision.list.choices.length >= 4);
    assert.ok(decision.list.choices.every((row) => row.split("|")[0].length <= 24), "título de linha até 24 caracteres");
    assert.ok(decision.list.choices.every((row) => (row.split("|")[2] ?? "").length <= 72), "descrição até 72 caracteres");
  }
});

test("opção 4 (outro assunto) vai direto para a equipa", () => {
  const day = decideMenuReply({ lastStep: "menu", text: "4", night: false });
  const night = decideMenuReply({ lastStep: "menu", text: "Outro assunto", choiceId: "4", night: true });

  assert.deepEqual(day, { replies: [HANDOFF_DAY], nextStep: "done", handoff: true });
  assert.deepEqual(night, { replies: [HANDOFF_NIGHT], nextStep: "done", handoff: true });
});

test("toque na lista (choiceId) vale mais que o texto do rótulo", () => {
  const decision = decideMenuReply({ lastStep: "menu", text: "Formação", choiceId: "2", night: false });

  assert.equal(decision.nextStep, "awaiting_2");
});

test("apoio domiciliário: escolhe o tipo, informa a zona e passa para a equipa", () => {
  const zone = decideMenuReply({ lastStep: "awaiting_1", text: "Higiene pessoal", choiceId: "h1", night: false });

  assert.equal(zone.nextStep, "awaiting_1_zone");
  assert.equal(zone.handoff, false);
  assert.equal(zone.list, undefined);

  const done = decideMenuReply({ lastStep: "awaiting_1_zone", text: "Lisboa, Benfica", night: false });

  assert.deepEqual(done, { replies: [HANDOFF_DAY], nextStep: "done", handoff: true });
});

test("formação: escolher um curso cita o nome e passa para a equipa", () => {
  const picked = decideMenuReply({ lastStep: "awaiting_2", text: "Técnico de Geriatria", choiceId: "c1", night: false });

  assert.equal(picked.handoff, true);
  assert.equal(picked.replies[0], "Obrigada pelo interesse em Técnico de Geriatria!");
  assert.equal(picked.replies[1], HANDOFF_DAY);

  const typed = decideMenuReply({ lastStep: "awaiting_2", text: "quero o de geriatria", night: false });

  assert.deepEqual(typed.replies, [HANDOFF_DAY]);
});

test("opção 2 lista os cursos sem preços", () => {
  const text = OPTION_REPLIES[2];

  assert.match(text, /Técnico de Geriatria/);
  assert.match(text, /Prevenção do Burnout/);
  assert.doesNotMatch(text, /€/);
});

test("resposta inválida repete o menu uma vez e depois passa para a equipa", () => {
  const first = decideMenuReply({ lastStep: "menu", text: "bom dia, queria saber preços", night: false });

  assert.equal(first.nextStep, "menu_retry");
  assert.equal(first.handoff, false);
  assert.match(first.replies[0], /1️⃣/);

  const second = decideMenuReply({ lastStep: "menu_retry", text: "ainda não percebi", night: false });

  assert.equal(second.handoff, true);
  assert.deepEqual(second.replies, [HANDOFF_DAY]);

  const recovered = decideMenuReply({ lastStep: "menu_retry", text: "2", night: false });

  assert.equal(recovered.nextStep, "awaiting_2");
});
test("candidatura: experiência, nome e zona; depois o formulário e a equipa (à noite, aviso noturno)", () => {
  const url = "https://exemplo.pt/candidatura";
  const details = decideMenuReply({ lastStep: "awaiting_3", text: "Tenho experiência", choiceId: "e1", night: false, recruitmentFormUrl: url });

  assert.equal(details.nextStep, "awaiting_3_details");
  assert.equal(details.handoff, false);

  const withForm = decideMenuReply({ lastStep: "awaiting_3_details", text: "Ana, Porto", night: false, recruitmentFormUrl: url });
  const withoutForm = decideMenuReply({ lastStep: "awaiting_3_details", text: "Ana, Porto", night: false });
  const atNight = decideMenuReply({ lastStep: "awaiting_3_details", text: "Ana, Porto", night: true, recruitmentFormUrl: url });

  assert.equal(withForm.replies.length, 2);
  assert.ok(withForm.replies[0].includes(url));
  assert.equal(withForm.replies[1], HANDOFF_DAY);
  assert.deepEqual(withoutForm.replies, [HANDOFF_DAY]);
  assert.equal(atNight.replies[1], HANDOFF_NIGHT);
  assert.equal(atNight.handoff, true);
});

test("readMenuStep só aceita etapas conhecidas", () => {
  assert.equal(readMenuStep("awaiting_1_zone"), "awaiting_1_zone");
  assert.equal(readMenuStep("awaiting_4"), null);
  assert.equal(readMenuStep("x"), null);
  assert.equal(readMenuStep(undefined), null);
});
