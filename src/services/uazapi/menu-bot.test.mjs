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

    assert.deepEqual(decision, { replies: [MENU_WELCOME], nextStep: "menu", handoff: false });
  }
});

test("escolha válida responde a pergunta da opção e aguarda detalhes", () => {
  for (const choice of [1, 2, 3, 4]) {
    const decision = decideMenuReply({ lastStep: "menu", text: String(choice), night: false });

    assert.deepEqual(decision.replies, [OPTION_REPLIES[choice]]);
    assert.equal(decision.nextStep, `awaiting_${choice}`);
    assert.equal(decision.handoff, false);
  }
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

test("depois dos detalhes passa para a equipa; à noite usa a mensagem de fora de horário", () => {
  const day = decideMenuReply({ lastStep: "awaiting_1", text: "Lisboa, higiene", night: false });
  const night = decideMenuReply({ lastStep: "awaiting_1", text: "Lisboa, higiene", night: true });

  assert.deepEqual(day, { replies: [HANDOFF_DAY], nextStep: "done", handoff: true });
  assert.deepEqual(night, { replies: [HANDOFF_NIGHT], nextStep: "done", handoff: true });
});

test("candidatura envia o formulário quando o link existe", () => {
  const url = "https://exemplo.pt/candidatura";
  const withForm = decideMenuReply({ lastStep: "awaiting_3", text: "Ana, Porto, 2 anos", night: false, recruitmentFormUrl: url });
  const withoutForm = decideMenuReply({ lastStep: "awaiting_3", text: "Ana, Porto, 2 anos", night: false });
  const otherOption = decideMenuReply({ lastStep: "awaiting_4", text: "assunto", night: false, recruitmentFormUrl: url });

  assert.equal(withForm.replies.length, 2);
  assert.ok(withForm.replies[0].includes(url));
  assert.deepEqual(withoutForm.replies, [HANDOFF_DAY]);
  assert.deepEqual(otherOption.replies, [HANDOFF_DAY]);
});

test("readMenuStep só aceita etapas conhecidas", () => {
  assert.equal(readMenuStep("awaiting_2"), "awaiting_2");
  assert.equal(readMenuStep("x"), null);
  assert.equal(readMenuStep(undefined), null);
});
