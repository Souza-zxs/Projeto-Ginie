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

test("apoio domiciliário: para quem, tipo, urgência, localidade, confirmação e só então a equipa", () => {
  const type = decideMenuReply({ lastStep: "awaiting_1", text: "Pai ou mãe", choiceId: "w2", night: false });

  assert.equal(type.nextStep, "awaiting_1_type");
  assert.equal(type.handoff, false);
  assert.ok(type.list.choices.length >= 4);

  const urgency = decideMenuReply({ lastStep: "awaiting_1_type", text: "Higiene pessoal", choiceId: "h1", night: false });

  assert.equal(urgency.nextStep, "awaiting_1_urgency");
  assert.ok(urgency.list.choices.some((row) => row.includes("|u1|")));

  const zone = decideMenuReply({ lastStep: "awaiting_1_urgency", text: "O quanto antes", choiceId: "u1", night: false });

  assert.equal(zone.nextStep, "awaiting_1_zone");
  assert.equal(zone.list, undefined);
  assert.match(zone.replies[0], /localidade/);

  const confirm = decideMenuReply({ lastStep: "awaiting_1_zone", text: "Lisboa, Benfica", night: false });

  assert.equal(confirm.nextStep, "awaiting_1_confirm");
  assert.equal(confirm.handoff, false);
  assert.match(confirm.replies[0], /«Lisboa, Benfica»/);
  assert.ok(confirm.list.choices.some((row) => row.startsWith("Sim, está certo|yes|")));
  assert.ok(confirm.list.choices.some((row) => row.startsWith("Corrigir|fix|")));

  const done = decideMenuReply({ lastStep: "awaiting_1_confirm", text: "Sim, está certo", choiceId: "yes", night: false });

  assert.deepEqual(done, { replies: [HANDOFF_DAY], nextStep: "done", handoff: true });
});

test("confirmar: 'corrigir' repete a pergunta; escrever outro local confirma o novo; texto sem sentido pede de novo", () => {
  const fixTapped = decideMenuReply({ lastStep: "awaiting_1_confirm", text: "Corrigir", choiceId: "fix", night: false });
  const fixTyped = decideMenuReply({ lastStep: "awaiting_1_confirm", text: "não, está errado", night: false });

  assert.equal(fixTapped.nextStep, "awaiting_1_zone");
  assert.equal(fixTyped.nextStep, "awaiting_1_zone");
  assert.match(fixTapped.replies[0], /localidade/);

  const other = decideMenuReply({ lastStep: "awaiting_1_confirm", text: "Porto", night: false });

  assert.equal(other.nextStep, "awaiting_1_confirm");
  assert.match(other.replies[0], /«Porto»/);
  assert.equal(other.handoff, false);

  const nonsense = decideMenuReply({ lastStep: "awaiting_1_confirm", text: "👍", night: false });

  assert.equal(nonsense.nextStep, "awaiting_1_zone");
  assert.equal(nonsense.handoff, false);

  for (const text of ["sim", "Sim!", "confirmo", "certo", "ok"]) {
    assert.equal(decideMenuReply({ lastStep: "awaiting_1_confirm", text, night: false }).handoff, true, text);
  }
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

  assert.equal(ok.nextStep, "awaiting_1_confirm");
  assert.equal(ok.handoff, false);
  assert.equal(giveUp.handoff, true);
});

test("nome e zona da candidatura: sem palavras pede de novo; com texto pede confirmação", () => {
  const again = decideMenuReply({ lastStep: "awaiting_3_details", text: "😀", night: false, recruitmentFormUrl: "https://x.pt" });

  assert.equal(again.nextStep, "awaiting_3_details_retry");
  assert.equal(again.handoff, false);

  const confirm = decideMenuReply({ lastStep: "awaiting_3_details_retry", text: "Ana, Porto", night: false, recruitmentFormUrl: "https://x.pt" });

  assert.equal(confirm.nextStep, "awaiting_3_confirm");
  assert.equal(confirm.handoff, false);
  assert.match(confirm.replies[0], /«Ana, Porto»/);

  const giveUp = decideMenuReply({ lastStep: "awaiting_3_details_retry", text: "😀", night: false, recruitmentFormUrl: "https://x.pt" });

  assert.equal(giveUp.handoff, true);
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
test("candidatura: experiência, nome e zona, confirmação; depois o formulário e a equipa (à noite, aviso noturno)", () => {
  const url = "https://exemplo.pt/candidatura";
  const details = decideMenuReply({ lastStep: "awaiting_3", text: "Tenho experiência", choiceId: "e1", night: false, recruitmentFormUrl: url });

  assert.equal(details.nextStep, "awaiting_3_details");
  assert.equal(details.handoff, false);

  const confirm = decideMenuReply({ lastStep: "awaiting_3_details", text: "Ana, Porto", night: false, recruitmentFormUrl: url });

  assert.equal(confirm.nextStep, "awaiting_3_confirm");

  const withForm = decideMenuReply({ lastStep: "awaiting_3_confirm", text: "Sim", choiceId: "yes", night: false, recruitmentFormUrl: url });
  const withoutForm = decideMenuReply({ lastStep: "awaiting_3_confirm", text: "sim", night: false });
  const atNight = decideMenuReply({ lastStep: "awaiting_3_confirm", text: "sim", night: true, recruitmentFormUrl: url });
  const fix = decideMenuReply({ lastStep: "awaiting_3_confirm", text: "Corrigir", choiceId: "fix", night: false });

  assert.equal(withForm.replies.length, 2);
  assert.ok(withForm.replies[0].includes(url));
  assert.equal(withForm.replies[1], HANDOFF_DAY);
  assert.deepEqual(withoutForm.replies, [HANDOFF_DAY]);
  assert.equal(atNight.replies[1], HANDOFF_NIGHT);
  assert.equal(atNight.handoff, true);
  assert.equal(fix.nextStep, "awaiting_3_details");
  assert.equal(fix.handoff, false);
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

test("toda lista de opções tem a linha ← Voltar, e o texto avisa", () => {
  const lists = [
    decideMenuReply({ lastStep: "menu", text: "1", night: false }).list,
    decideMenuReply({ lastStep: "menu", text: "2", night: false }).list,
    decideMenuReply({ lastStep: "menu", text: "3", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_1", text: "x", choiceId: "w1", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_1_type", text: "x", choiceId: "h1", night: false }).list
  ];

  for (const list of lists) {
    assert.ok(list.choices.some((row) => row.startsWith("← Voltar|back|")), list.text);
    assert.match(list.text, /Voltar/);
    assert.ok(list.choices.length <= 10);
    assert.ok(list.choices.every((row) => row.split("|")[0].length <= 24), "título até 24 caracteres");
  }
});

test("voltar repete a pergunta anterior em cada etapa (tocado ou digitado)", () => {
  const expected = {
    awaiting_1: "menu",
    awaiting_2: "menu",
    awaiting_3: "menu",
    awaiting_1_type: "awaiting_1",
    awaiting_1_urgency: "awaiting_1_type",
    awaiting_1_zone: "awaiting_1_urgency",
    awaiting_1_zone_retry: "awaiting_1_urgency",
    awaiting_1_confirm: "awaiting_1_urgency",
    awaiting_3_details: "awaiting_3",
    awaiting_3_details_retry: "awaiting_3",
    awaiting_3_confirm: "awaiting_3"
  };

  for (const [step, target] of Object.entries(expected)) {
    for (const input of [{ text: "← Voltar", choiceId: "back" }, { text: "Voltar" }, { text: "voltar!" }]) {
      const decision = decideMenuReply({ lastStep: step, night: false, ...input });

      assert.equal(decision.nextStep, target, `${step} ${JSON.stringify(input)}`);
      assert.equal(decision.handoff, false);
    }
  }
});

test("voltar refaz a pergunta com a lista certa e o texto de reserva", () => {
  const toWho = decideMenuReply({ lastStep: "awaiting_1_type", text: "", choiceId: "back", night: false });

  assert.deepEqual(toWho.replies, [OPTION_REPLIES[1]]);
  assert.ok(toWho.list.choices.some((row) => row.includes("|w1|")));

  const toUrgency = decideMenuReply({ lastStep: "awaiting_1_zone", text: "voltar", night: false });

  assert.ok(toUrgency.list.choices.some((row) => row.includes("|u1|")));

  const toMenu = decideMenuReply({ lastStep: "awaiting_2", text: "", choiceId: "back", night: false });

  assert.deepEqual(toMenu.replies, [MENU_WELCOME]);
  assert.equal(toMenu.list.choices.length, 4);
});

test("voltar tem prioridade sobre a validação de texto e sobre 'outro'", () => {
  const zone = decideMenuReply({ lastStep: "awaiting_1_zone", text: "voltar", night: false });

  assert.equal(zone.nextStep, "awaiting_1_urgency");
  assert.equal(zone.handoff, false);
});

test("voltar sem etapa anterior (menu, encaminhado, sem estado) não quebra nem encaminha", () => {
  for (const lastStep of ["menu", "menu_retry", "done", null]) {
    const decision = decideMenuReply({ lastStep, text: "voltar", choiceId: "back", night: false });

    assert.equal(decision.handoff, lastStep === "menu_retry", String(lastStep));
  }
});

test("as perguntas de texto livre avisam que dá para escrever 'voltar'", () => {
  const zone = decideMenuReply({ lastStep: "awaiting_1_urgency", text: "x", choiceId: "u1", night: false });
  const details = decideMenuReply({ lastStep: "awaiting_3", text: "x", choiceId: "e1", night: false });

  assert.match(zone.replies[0], /voltar/);
  assert.match(details.replies[0], /voltar/);
});
