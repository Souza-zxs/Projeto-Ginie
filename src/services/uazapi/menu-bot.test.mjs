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

test("apoio domiciliário: para quem, tipo, urgência, localidade e só então a equipa", () => {
  const type = decideMenuReply({ lastStep: "awaiting_1", text: "Pai ou mãe", choiceId: "w2", night: false });

  assert.equal(type.nextStep, "awaiting_1_type");
  assert.equal(type.handoff, false);
  assert.ok(type.list.choices.length >= 4);

  const urgency = decideMenuReply({ lastStep: "awaiting_1_type", text: "Higiene pessoal", choiceId: "h1", night: false });

  assert.equal(urgency.nextStep, "awaiting_1_urgency");
  assert.equal(urgency.handoff, false);
  assert.ok(urgency.list.choices.some((row) => row.includes("|u1|")));

  const zone = decideMenuReply({ lastStep: "awaiting_1_urgency", text: "O quanto antes", choiceId: "u1", night: false });

  assert.equal(zone.nextStep, "awaiting_1_zone");
  assert.equal(zone.handoff, false);
  assert.equal(zone.list, undefined);
  assert.match(zone.replies[0], /localidade/);

  const done = decideMenuReply({ lastStep: "awaiting_1_zone", text: "Lisboa, Benfica", night: false });

  assert.deepEqual(done, { replies: [HANDOFF_DAY], nextStep: "done", handoff: true });
});

test("localidade sem palavras (emoji, número) é pedida de novo; na segunda falha vai para a equipa", () => {
  for (const text of ["👍", "123", "??", "a", ""]) {
    const again = decideMenuReply({ lastStep: "awaiting_1_zone", text, night: false });

    assert.equal(again.nextStep, "awaiting_1_zone_retry", text);
    assert.equal(again.handoff, false);
    assert.match(again.replies[0], /localidade/);
  }

  const ok = decideMenuReply({ lastStep: "awaiting_1_zone_retry", text: "Porto", night: false });
  const giveUp = decideMenuReply({ lastStep: "awaiting_1_zone_retry", text: "👍", night: false });

  assert.equal(ok.handoff, true);
  assert.equal(giveUp.handoff, true);
});

test("nome e zona da candidatura também são pedidos de novo quando vêm sem palavras", () => {
  const again = decideMenuReply({ lastStep: "awaiting_3_details", text: "😀", night: false, recruitmentFormUrl: "https://x.pt" });

  assert.equal(again.nextStep, "awaiting_3_details_retry");
  assert.equal(again.handoff, false);

  const done = decideMenuReply({ lastStep: "awaiting_3_details_retry", text: "Ana, Porto", night: false, recruitmentFormUrl: "https://x.pt" });

  assert.equal(done.handoff, true);
  assert.ok(done.replies[0].includes("https://x.pt"));
});

test("toda lista tem a linha Outro, e escolhê-la vai direto para o atendimento manual", () => {
  const lists = [
    decideMenuReply({ lastStep: "menu", text: "1", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_1", text: "x", choiceId: "w1", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_1_type", text: "x", choiceId: "h1", night: false }).list,
    decideMenuReply({ lastStep: "menu", text: "2", night: false }).list,
    decideMenuReply({ lastStep: "menu", text: "3", night: false }).list
  ];

  for (const list of lists) {
    assert.ok(list.choices.some((row) => row.startsWith("Outro|other|")), list.text);
    assert.ok(list.choices.length <= 10, "WhatsApp aceita no máximo 10 linhas");
  }

  for (const step of ["awaiting_1", "awaiting_1_type", "awaiting_1_urgency", "awaiting_2", "awaiting_3"]) {
    const tapped = decideMenuReply({ lastStep: step, text: "Outro", choiceId: "other", night: false, recruitmentFormUrl: "https://x.pt" });
    const typed = decideMenuReply({ lastStep: step, text: "outro", night: true });

    assert.deepEqual(tapped, { replies: [HANDOFF_DAY], nextStep: "done", handoff: true }, step);
    assert.deepEqual(typed, { replies: [HANDOFF_NIGHT], nextStep: "done", handoff: true }, step);
  }
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
  assert.equal(readMenuStep("awaiting_1_type"), "awaiting_1_type");
  assert.equal(readMenuStep("awaiting_1_urgency"), "awaiting_1_urgency");
  assert.equal(readMenuStep("awaiting_3_details_retry"), "awaiting_3_details_retry");
  assert.equal(readMenuStep("awaiting_4"), null);
  assert.equal(readMenuStep("x"), null);
  assert.equal(readMenuStep(undefined), null);
});
