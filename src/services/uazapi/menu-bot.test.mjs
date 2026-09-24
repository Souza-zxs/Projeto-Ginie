import test from "node:test";
import assert from "node:assert/strict";
import {
  HANDOFF_DAY,
  HANDOFF_NIGHT,
  MENU_WELCOME,
  CANDIDACY,
  DEFAULT_RECRUITMENT_FORM_URL,
  OPTION_REPLIES,
  decideMenuReply,
  detectMenuIntent,
  isSmallTalk,
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

test("opções 1 e 2 abrem uma lista de escolha; a 3 (candidatura) começa pelo nome", () => {
  for (const choice of [1, 2]) {
    const decision = decideMenuReply({ lastStep: "menu", text: String(choice), night: false });

    assert.deepEqual(decision.replies, [OPTION_REPLIES[choice]]);
    assert.equal(decision.nextStep, `awaiting_${choice}`);
    assert.equal(decision.handoff, false);
    assert.ok(decision.list.choices.length >= 4);
    assert.ok(decision.list.choices.every((row) => row.split("|")[0].length <= 24), "título de linha até 24 caracteres");
    assert.ok(decision.list.choices.every((row) => (row.split("|")[2] ?? "").length <= 72), "descrição até 72 caracteres");
  }

  const candidacy = decideMenuReply({ lastStep: "menu", text: "3", night: false });

  assert.equal(candidacy.nextStep, "awaiting_3_name");
  assert.equal(candidacy.handoff, false);
  assert.equal(candidacy.list, undefined);
  assert.match(candidacy.replies[0], /nome completo/);
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

test("toda lista tem a linha Outro, e escolhê-la vai direto para o atendimento manual", () => {
  const lists = [
    decideMenuReply({ lastStep: "menu", text: "1", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_1", text: "x", choiceId: "w1", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_1_type", text: "x", choiceId: "h1", night: false }).list,
    decideMenuReply({ lastStep: "menu", text: "2", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_3_name", text: "Ana Silva", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_3_p3", text: "Sim", choiceId: "yes", night: false }).list
  ];

  for (const list of lists) {
    assert.ok(list.choices.some((row) => row.startsWith("Outro|other|")), list.text);
    assert.ok(list.choices.length <= 10, "WhatsApp aceita no máximo 10 linhas");
  }

  const steps = [
    "awaiting_1",
    "awaiting_1_type",
    "awaiting_1_urgency",
    "awaiting_2",
    ...CANDIDACY.filter((item) => item.kind !== "text").map((item) => item.step)
  ];

  for (const step of steps) {
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
const yes = { text: "Sim", choiceId: "yes" };
const no = { text: "Não", choiceId: "no" };
const avail = (id, text) => ({ text, choiceId: id });

/** Conversa simulada: cada resposta usa o estado que a decisão anterior deixou (etapa, "Não" guardados, pedido de repetição). */
function chat(inputs, options = {}) {
  let state = { lastStep: "menu", fails: [], mediaRetry: false };
  const decisions = [];

  for (const input of inputs) {
    const value = typeof input === "string" ? { text: input } : input;
    const decision = decideMenuReply({
      lastStep: state.lastStep,
      text: value.text,
      choiceId: value.choiceId,
      isMedia: value.isMedia,
      mediaRetry: state.mediaRetry,
      candidacyFails: state.fails,
      night: false,
      ...options
    });

    decisions.push(decision);
    state = { lastStep: decision.nextStep, fails: decision.candidacyFails ?? [], mediaRetry: decision.mediaRetry === true };
  }

  return decisions;
}

const HAPPY_PATH = ["3", "Ana Silva", yes, yes, yes, yes, yes, yes, yes, yes, avail("a1", "Semana"), "manhãs e tardes", yes, yes];

test("candidatura: nome, idade, 4 eliminatórias, 6 de perfil e só no fim o formulário e a equipa", () => {
  const decisions = chat(HAPPY_PATH, { recruitmentFormUrl: DEFAULT_RECRUITMENT_FORM_URL });

  assert.deepEqual(
    decisions.map((decision) => decision.nextStep),
    [
      "awaiting_3_name",
      "awaiting_3_age",
      "awaiting_3_q1",
      "awaiting_3_q2",
      "awaiting_3_q3",
      "awaiting_3_q4",
      "awaiting_3_p1",
      "awaiting_3_p2",
      "awaiting_3_p3",
      "awaiting_3_avail",
      "awaiting_3_hours",
      "awaiting_3_p4",
      "awaiting_3_p5",
      "done"
    ]
  );

  assert.match(decisions[6].replies[0], /Passou à próxima etapa/);

  for (const decision of decisions.slice(0, -1)) {
    assert.equal(decision.handoff, false);
    assert.doesNotMatch(decision.replies.join(" "), /formulário/);
  }

  const last = decisions.at(-1);

  assert.equal(last.handoff, true);
  assert.equal(last.replies.length, 2);
  assert.ok(last.replies[0].includes(DEFAULT_RECRUITMENT_FORM_URL));
  assert.match(last.replies[0], /Preencha este formulário, por favor/);
  assert.equal(last.replies[1], HANDOFF_DAY);
});

test("formulário à noite usa o aviso noturno; sem link configurado só encaminha", () => {
  const night = chat(HAPPY_PATH, { night: true, recruitmentFormUrl: "https://x.pt" }).at(-1);
  const noLink = chat(HAPPY_PATH, { recruitmentFormUrl: null }).at(-1);

  assert.equal(night.replies[1], HANDOFF_NIGHT);
  assert.ok(night.replies[0].includes("https://x.pt"));
  assert.deepEqual(noLink.replies, [HANDOFF_DAY]);
});

test("um 'Não' numa eliminatória não encerra na hora: o bot pergunta as outras e só decide depois da quarta", () => {
  const decisions = chat(["3", "Ana Silva", yes, yes, no, yes, yes]);

  // Depois do "Não" à autorização (índice 4), a próxima é a pergunta dos recibos verdes, não uma recusa.
  assert.equal(decisions[4].nextStep, "awaiting_3_q3");
  assert.equal(decisions[4].handoff, false);
  assert.doesNotMatch(decisions[4].replies[0], /não podemos/);
  assert.deepEqual(decisions[4].candidacyFails, ["q2"]);

  // A decisão só vem depois da quarta.
  assert.equal(decisions[5].nextStep, "awaiting_3_q4");
  assert.equal(decisions[6].nextStep, "declined");
  assert.match(decisions[6].replies[0], /autorização para trabalhar em Portugal/);
  assert.match(decisions[6].replies[0], /'voltar'/);
  assert.equal(decisions[6].handoff, false);
});

test("recusa cita todos os requisitos em falta e não pergunta as questões de perfil", () => {
  const decisions = chat(["3", "Ana Silva", yes, yes, no, no, no]);
  const declined = decisions.at(-1);

  assert.equal(declined.nextStep, "declined");
  assert.match(declined.replies[0], /autorização para trabalhar/);
  assert.match(declined.replies[0], /recibos verdes/);
  assert.match(declined.replies[0], /Lisboa/);
  assert.doesNotMatch(declined.replies[0], /formulário/);
});

test("sem experiência (e mais nada em falta) vai para o menu de formação da DAR+ Academia", () => {
  const decisions = chat(["3", "Ana Silva", yes, no, yes, yes, yes]);

  // Só depois da quarta pergunta, e sem dizer que não avança.
  assert.equal(decisions[3].nextStep, "awaiting_3_q2");
  assert.doesNotMatch(decisions[3].replies[0], /Academia/);

  const academy = decisions.at(-1);

  assert.equal(academy.nextStep, "awaiting_2");
  assert.equal(academy.handoff, false);
  assert.match(academy.replies[0], /DAR\+ Academia/);
  assert.doesNotMatch(academy.replies[0], /não podemos dar seguimento/);
  assert.ok(academy.list.choices.some((row) => row.includes("|c1|")), "traz a lista de cursos");
  assert.match(academy.list.text, /DAR\+ Academia/);
});

test("sem experiência e sem outro requisito: a recusa vale mais que a Academia", () => {
  const declined = chat(["3", "Ana Silva", yes, no, no, yes, yes]).at(-1);

  assert.equal(declined.nextStep, "declined");
});

test("menos de 18 anos encerra logo (não se continuam a recolher dados de um menor)", () => {
  const decisions = chat(["3", "Ana Silva", no]);
  const declined = decisions.at(-1);

  assert.equal(declined.nextStep, "declined");
  assert.match(declined.replies[0], /18 anos/);
  assert.equal(declined.handoff, false);
});

test("'voltar' na recusa reabre a última pergunta (ou a idade) sem o 'Não' antigo", () => {
  const afterQ4 = chat(["3", "Ana Silva", yes, yes, no, yes, yes]);
  const back = decideMenuReply({
    lastStep: "declined",
    text: "voltar",
    candidacyFails: afterQ4.at(-1).candidacyFails,
    night: false
  });

  assert.equal(back.nextStep, "awaiting_3_q4");
  assert.deepEqual(back.candidacyFails, ["q2"]); // o Não à autorização continua; a quarta será respondida de novo
  assert.ok(back.list.choices.some((row) => row.startsWith("Sim|yes")));

  const byAge = chat(["3", "Ana Silva", no]).at(-1);
  const backAge = decideMenuReply({ lastStep: "declined", text: "← Voltar", choiceId: "back", candidacyFails: byAge.candidacyFails, night: false });

  assert.equal(backAge.nextStep, "awaiting_3_age");
  assert.deepEqual(backAge.candidacyFails, []);
});

test("'voltar' durante as perguntas apaga o 'Não' da pergunta que será repetida", () => {
  const decisions = chat(["3", "Ana Silva", yes, no, yes]);

  assert.deepEqual(decisions.at(-1).candidacyFails, ["q1"]);

  // Estava na Q3 (com "Não" guardado à Q1). Voltar repete a Q2; o Não à Q1 não é tocado.
  const back = decideMenuReply({ lastStep: "awaiting_3_q3", text: "voltar", candidacyFails: ["q1"], night: false });

  assert.equal(back.nextStep, "awaiting_3_q2");
  assert.deepEqual(back.candidacyFails, ["q1"]);

  // Voltar da Q2 repete a Q1 e apaga o Não dela.
  const backToQ1 = decideMenuReply({ lastStep: "awaiting_3_q2", text: "voltar", candidacyFails: ["q1"], night: false });

  assert.equal(backToQ1.nextStep, "awaiting_3_q1");
  assert.deepEqual(backToQ1.candidacyFails, []);

  // Voltar do nome volta ao menu principal.
  assert.equal(decideMenuReply({ lastStep: "awaiting_3_name", text: "voltar", night: false }).nextStep, "menu");
});

test("depois da recusa, qualquer mensagem só recebe a dica; 'menu' recomeça", () => {
  const hint = decideMenuReply({ lastStep: "declined", text: "obrigada", candidacyFails: ["q2"], night: false });
  const restart = decideMenuReply({ lastStep: "declined", text: "menu", night: false });

  assert.equal(hint.nextStep, "declined");
  assert.match(hint.replies[0], /voltar/);
  assert.equal(hint.handoff, false);
  assert.equal(restart.nextStep, "menu");
});

test("sim/não digitados são entendidos; resposta confusa repete uma vez e depois passa para a equipa", () => {
  for (const text of ["sim", "Sim, tenho", "não", "Não tenho", "nao"]) {
    // Na Q1 (eliminatória) "Não" é guardado e a pergunta seguinte vem sem recusa.
    assert.equal(decideMenuReply({ lastStep: "awaiting_3_q1", text, night: false }).nextStep, "awaiting_3_q2", text);
  }

  assert.deepEqual(decideMenuReply({ lastStep: "awaiting_3_q1", text: "Não tenho", night: false }).candidacyFails, ["q1"]);
  assert.deepEqual(decideMenuReply({ lastStep: "awaiting_3_q1", text: "Sim, tenho", night: false }).candidacyFails, []);

  const unclear = decideMenuReply({ lastStep: "awaiting_3_q2", text: "talvez", candidacyFails: ["q1"], night: false });

  assert.equal(unclear.nextStep, "awaiting_3_q2");
  assert.equal(unclear.mediaRetry, true);
  assert.deepEqual(unclear.candidacyFails, ["q1"]);
  assert.ok(unclear.list);

  const twice = decideMenuReply({ lastStep: "awaiting_3_q2", text: "sei lá", mediaRetry: true, night: false });

  assert.deepEqual(twice, { replies: [HANDOFF_DAY], nextStep: "done", handoff: true, gaveUp: true });
});

test("disponibilidade: lista ou texto livre; nome e horário aceitam texto e pedem de novo se vier sem palavras", () => {
  for (const [input, ok] of [[avail("a2", "Fim de semana"), true], ["fins de semana", false], ["semana e fim de semana", true], ["segunda a sexta", true], ["quando puder", false]]) {
    const decision = decideMenuReply({ lastStep: "awaiting_3_avail", text: input.text ?? input, choiceId: input.choiceId, night: false });

    if (ok) {
      assert.equal(decision.nextStep, "awaiting_3_hours", String(input.text ?? input));
    }
  }

  assert.equal(decideMenuReply({ lastStep: "awaiting_3_avail", text: "fim de semana", night: false }).nextStep, "awaiting_3_hours");

  const nameAgain = decideMenuReply({ lastStep: "awaiting_3_name", text: "😀", night: false });

  assert.equal(nameAgain.nextStep, "awaiting_3_name_retry");
  assert.equal(decideMenuReply({ lastStep: "awaiting_3_name_retry", text: "Ana", night: false }).nextStep, "awaiting_3_age");
  assert.equal(decideMenuReply({ lastStep: "awaiting_3_name_retry", text: "😀", night: false }).handoff, true);

  const hoursAgain = decideMenuReply({ lastStep: "awaiting_3_hours", text: "123", night: false });

  assert.equal(hoursAgain.nextStep, "awaiting_3_hours_retry");
  assert.equal(decideMenuReply({ lastStep: "awaiting_3_hours_retry", text: "manhãs", night: false }).nextStep, "awaiting_3_p4");
});

test("readMenuStep só aceita etapas conhecidas", () => {
  assert.equal(readMenuStep("awaiting_1_zone"), "awaiting_1_zone");
  assert.equal(readMenuStep("awaiting_1_type"), "awaiting_1_type");
  assert.equal(readMenuStep("awaiting_1_urgency"), "awaiting_1_urgency");
  for (const item of CANDIDACY) {
    assert.equal(readMenuStep(item.step), item.step, item.step);
  }
  assert.equal(readMenuStep("awaiting_3_name_retry"), "awaiting_3_name_retry");
  assert.equal(readMenuStep("declined"), "declined");
  // Etapas da candidatura antiga deixam de valer: a conversa recomeça pelo menu.
  assert.equal(readMenuStep("awaiting_3"), null);
  assert.equal(readMenuStep("awaiting_3_details"), null);
  assert.equal(readMenuStep("awaiting_4"), null);
  assert.equal(readMenuStep("x"), null);
  assert.equal(readMenuStep(undefined), null);
});

test("toda lista de opções tem a linha ← Voltar, e o texto avisa", () => {
  const lists = [
    decideMenuReply({ lastStep: "menu", text: "1", night: false }).list,
    decideMenuReply({ lastStep: "menu", text: "2", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_1", text: "x", choiceId: "w1", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_1_type", text: "x", choiceId: "h1", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_3_name", text: "Ana Silva", night: false }).list,
    decideMenuReply({ lastStep: "awaiting_3_p3", text: "Sim", choiceId: "yes", night: false }).list
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
    awaiting_1_type: "awaiting_1",
    awaiting_1_urgency: "awaiting_1_type",
    awaiting_1_zone: "awaiting_1_urgency",
    awaiting_1_zone_retry: "awaiting_1_urgency",
    awaiting_1_confirm: "awaiting_1_urgency"
  };

  CANDIDACY.forEach((item, index) => {
    expected[item.step] = index === 0 ? "menu" : CANDIDACY[index - 1].step;
  });
  expected.awaiting_3_name_retry = "menu";
  expected.awaiting_3_hours_retry = "awaiting_3_avail";

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
  const hours = decideMenuReply({ lastStep: "awaiting_3_avail", text: "Semana", choiceId: "a1", night: false });
  const name = decideMenuReply({ lastStep: "menu", text: "3", night: false });

  assert.match(zone.replies[0], /voltar/);
  assert.match(hours.replies[0], /voltar/);
  assert.match(name.replies[0], /voltar/);
});

test("áudio/imagem numa pergunta: pede texto ou opção, repete a pergunta e mantém a etapa", () => {
  const listSteps = [
    "menu",
    "awaiting_1",
    "awaiting_1_type",
    "awaiting_1_urgency",
    "awaiting_2",
    "awaiting_1_confirm",
    ...CANDIDACY.filter((item) => item.kind !== "text").map((item) => item.step)
  ];

  for (const step of listSteps) {
    const decision = decideMenuReply({ lastStep: step, text: "[áudio]", isMedia: true, night: false });

    assert.equal(decision.nextStep, step, step);
    assert.equal(decision.handoff, false, step);
    assert.equal(decision.mediaRetry, true, step);
    assert.match(decision.replies[0], /Só consigo ler mensagens de texto/, step);
    assert.ok(decision.list, `${step} deve repetir a lista`);
    assert.match(decision.list.text, /Só consigo ler mensagens de texto/, step);
  }

  const textSteps = [
    "awaiting_1_zone",
    "awaiting_1_zone_retry",
    ...CANDIDACY.filter((item) => item.kind === "text").map((item) => item.step),
    "awaiting_3_name_retry",
    "awaiting_3_hours_retry"
  ];

  for (const step of textSteps) {
    const decision = decideMenuReply({ lastStep: step, text: "[áudio]", isMedia: true, night: false });

    assert.equal(decision.nextStep, step, step);
    assert.equal(decision.list, undefined, step);
    assert.match(decision.replies[0], /Só consigo ler mensagens de texto/, step);
  }
});

test("insistir com mídia depois do pedido encaminha para a equipa", () => {
  const day = decideMenuReply({ lastStep: "awaiting_1_type", text: "[áudio]", isMedia: true, mediaRetry: true, night: false });
  const night = decideMenuReply({ lastStep: "awaiting_1_zone", text: "[imagem]", isMedia: true, mediaRetry: true, night: true });

  assert.deepEqual(day, { replies: [HANDOFF_DAY], nextStep: "done", handoff: true, gaveUp: true });
  assert.deepEqual(night, { replies: [HANDOFF_NIGHT], nextStep: "done", handoff: true, gaveUp: true });
});

test("mídia como primeira mensagem abre o menu normalmente; texto depois do pedido segue o fluxo", () => {
  const first = decideMenuReply({ lastStep: null, text: "[áudio]", isMedia: true, night: false });

  assert.equal(first.nextStep, "menu");
  assert.equal(first.mediaRetry, undefined);

  const answered = decideMenuReply({ lastStep: "awaiting_1_type", text: "Companhia", choiceId: "h3", mediaRetry: true, night: false });

  assert.equal(answered.nextStep, "awaiting_1_urgency");
  assert.equal(answered.handoff, false);
});

test("áudio no meio da candidatura mantém os 'Não' já guardados", () => {
  const decision = decideMenuReply({ lastStep: "awaiting_3_q3", text: "[áudio]", isMedia: true, candidacyFails: ["q1", "q2"], night: false });

  assert.equal(decision.nextStep, "awaiting_3_q3");
  assert.deepEqual(decision.candidacyFails, ["q1", "q2"]);
});


test("as perguntas escritas da candidatura (nome e horário) pedem o formato entre parênteses, com exemplo", () => {
  const name = decideMenuReply({ lastStep: "menu", text: "3", night: false });
  const hours = decideMenuReply({ lastStep: "awaiting_3_avail", text: "Semana", choiceId: "a1", night: false });

  assert.match(name.replies[0], /Responda neste formato: \(nome completo\)\. Exemplo: \(Ana Maria Silva\)\./);
  assert.match(hours.replies[0], /Responda neste formato: \(horário pretendido\)\. Exemplo: \(manhãs, das 9h às 13h\)\./);
  assert.doesNotMatch(name.replies[0], /  /, "sem espaço duplo");

  // Ao repetir por resposta sem sentido, o formato vem de novo.
  const nameAgain = decideMenuReply({ lastStep: "awaiting_3_name", text: "😀", night: false });
  const hoursAgain = decideMenuReply({ lastStep: "awaiting_3_hours", text: "123", night: false });

  assert.match(nameAgain.replies[0], /\(nome completo\)/);
  assert.match(hoursAgain.replies[0], /\(manhãs, das 9h às 13h\)/);

  // Quem escreve sem parênteses também é aceite.
  assert.equal(decideMenuReply({ lastStep: "awaiting_3_name", text: "Ana Maria Silva", night: false }).nextStep, "awaiting_3_age");
  assert.equal(decideMenuReply({ lastStep: "awaiting_3_name", text: "(Ana Maria Silva)", night: false }).nextStep, "awaiting_3_age");
});

test("a localidade do apoio domiciliário pede o formato (bairro ou freguesia, cidade), com exemplo", () => {
  const ask = decideMenuReply({ lastStep: "awaiting_1_urgency", text: "O quanto antes", choiceId: "u1", night: false });
  const again = decideMenuReply({ lastStep: "awaiting_1_zone", text: "👍", night: false });

  assert.match(ask.replies[0], /Responda neste formato: \(bairro ou freguesia, cidade\)\. Exemplo: \(Benfica, Lisboa\)\./);
  assert.match(again.replies[0], /\(bairro ou freguesia, cidade\)/);
  assert.match(again.replies[0], /\(Benfica, Lisboa\)/);
});

test("a confirmação da localidade mostra o local sem os parênteses do formato", () => {
  const confirm = decideMenuReply({ lastStep: "awaiting_1_zone", text: "(Benfica, Lisboa)", night: false });

  assert.equal(confirm.nextStep, "awaiting_1_confirm");
  assert.match(confirm.replies[0], /«Benfica, Lisboa»/);
  assert.doesNotMatch(confirm.replies[0], /«\(/);
});

const SMALL_TALK = ["Olá", "Boa tarde", "Tudo Bm", "Bom dia, tudo bem?", "oi", "Olá, boa noite!", "tudo bem", "Obrigada", "ok", "Olá bom dia tudo bem"];
const NOT_SMALL_TALK = ["Quero apoio para a minha mãe", "Boa tarde, quero saber os cursos", "1", "sim", "preço?", "", "👍", "Olá, preciso de ajuda com a medicação"];

test("saudação é reconhecida; pedido de verdade não é", () => {
  for (const text of SMALL_TALK) {
    assert.equal(isSmallTalk(text), true, text);
  }

  for (const text of NOT_SMALL_TALK) {
    assert.equal(isSmallTalk(text), false, text);
  }
});

test("caso real: 'Olá', 'Boa tarde', 'Tudo Bm' seguidos não gastam tentativa nem encaminham", () => {
  const first = decideMenuReply({ lastStep: null, text: "Olá", night: false });

  assert.equal(first.nextStep, "menu");

  let state = first.nextStep;

  for (const text of ["Boa tarde", "Tudo Bm", "Olá"]) {
    const decision = decideMenuReply({ lastStep: state, text, night: false });

    assert.equal(decision.smallTalk, true, text);
    assert.equal(decision.handoff, false, text);
    assert.equal(decision.nextStep, "menu", text); // continua no menu, sem passar para "menu_retry"
    assert.ok(decision.list, "repete o menu para o caso de ele não estar na tela");
    assert.doesNotMatch(decision.replies[0], /Desculpe, não consegui perceber/);
    state = decision.nextStep;
  }

  // Depois das saudações, tocar numa opção funciona normalmente.
  assert.equal(decideMenuReply({ lastStep: state, text: "Candidatura", choiceId: "3", night: false }).nextStep, "awaiting_3_name");
});

test("saudação também não gasta a nova tentativa depois de uma resposta errada", () => {
  const retry = decideMenuReply({ lastStep: "menu", text: "quero saber preços", night: false });

  assert.equal(retry.nextStep, "menu_retry");

  const greeting = decideMenuReply({ lastStep: "menu_retry", text: "Boa tarde", night: false });

  assert.equal(greeting.nextStep, "menu_retry");
  assert.equal(greeting.handoff, false);

  // Mas uma segunda resposta errada de verdade continua a passar para a equipa.
  const invalid = decideMenuReply({ lastStep: "menu_retry", text: "quero saber preços", night: false });

  assert.equal(invalid.handoff, true);
});

test("desistência do bot é marcada (gaveUp); pedido explícito da equipa e recusa não são", () => {
  const gaveUp = [
    decideMenuReply({ lastStep: "menu_retry", text: "não sei", night: false }),
    decideMenuReply({ lastStep: "awaiting_1_type", text: "[áudio]", isMedia: true, mediaRetry: true, night: false }),
    decideMenuReply({ lastStep: "awaiting_3_q2", text: "sei lá", mediaRetry: true, night: false }),
    decideMenuReply({ lastStep: "awaiting_3_name_retry", text: "😀", night: false }),
    decideMenuReply({ lastStep: "awaiting_1_zone_retry", text: "👍", night: false })
  ];

  for (const decision of gaveUp) {
    assert.equal(decision.handoff, true);
    assert.equal(decision.gaveUp, true);
  }

  const asked = [
    decideMenuReply({ lastStep: "menu", text: "4", night: false }),
    decideMenuReply({ lastStep: "awaiting_1", text: "Outro", choiceId: "other", night: false }),
    decideMenuReply({ lastStep: "awaiting_1_confirm", text: "sim", night: false })
  ];

  for (const decision of asked) {
    assert.equal(decision.handoff, true);
    assert.equal(decision.gaveUp, undefined);
  }
});

test("palavras-chave levam à opção certa (formação, candidatura, apoio)", () => {
  const cases = {
    2: ["Quero saber os cursos", "a minha mãe quer fazer um curso", "Boa tarde, gostava de saber sobre a formação", "vocês têm formação em geriatria?", "quero inscrever-me num curso", "informações sobre a academia"],
    3: ["Quero trabalhar convosco", "procuro emprego", "Há vagas?", "gostaria de me candidatar", "envio o meu currículo?", "quero trabalhar com apoio domiciliário"],
    1: ["Preciso de apoio domiciliário para a minha mãe", "quero uma pessoa para cuidar do meu pai", "tenho uma avó idosa", "a minha tia está acamada", "apoio doméstico", "queria saber sobre cuidados para o meu tio"]
  };

  for (const [intent, texts] of Object.entries(cases)) {
    for (const text of texts) {
      assert.equal(detectMenuIntent(text), Number(intent), text);
    }
  }
});

test("quando as palavras apontam para mais de um assunto (ou nenhum), não adivinha", () => {
  for (const text of [
    "apoio para a minha mãe e um curso para mim",
    "quero um curso para trabalhar",
    "Quero saber os preços",
    "Não irei conseguir ir para o trabalho",
    "Sim vou fazer um trabalho até às 9 da noite",
    "Da manhã já tenho um lugar para trabalhar",
    "a minha mãe está doente",
    "o meu pai não pode",
    "ajuda",
    "sim",
    "olá",
    "Boa tarde",
    "sou cuidadora",
    "",
    "👍"
  ]) {
    assert.equal(detectMenuIntent(text), null, text);
  }
});

test("no menu, escrever o que quer vai direto à opção, avisando o que entendeu", () => {
  for (const lastStep of ["menu", "menu_retry"]) {
    const training = decideMenuReply({ lastStep, text: "Boa tarde, quero saber os cursos", night: false });

    assert.equal(training.nextStep, "awaiting_2", lastStep);
    assert.equal(training.handoff, false);
    assert.match(training.replies[0], /^Percebi que procura formação\./);
    assert.match(training.list.text, /^Percebi que procura formação\./);
    assert.ok(training.list.choices.some((row) => row.includes("|c1|")));
  }

  const support = decideMenuReply({ lastStep: "menu", text: "preciso de apoio para a minha mãe", night: false });

  assert.equal(support.nextStep, "awaiting_1");
  assert.match(support.replies[0], /Percebi que procura apoio domiciliário/);
  assert.ok(support.list.choices.some((row) => row.includes("|w1|")));

  const candidacy = decideMenuReply({ lastStep: "menu", text: "procuro emprego", night: false });

  assert.equal(candidacy.nextStep, "awaiting_3_name");
  assert.match(candidacy.replies[0], /Percebi que quer trabalhar connosco\./);
  assert.match(candidacy.replies[0], /nome completo/);
});

test("se o bot entendeu mal, 'voltar' devolve ao menu; número e saudação continuam com prioridade", () => {
  const routed = decideMenuReply({ lastStep: "menu", text: "quero saber os cursos", night: false });
  const back = decideMenuReply({ lastStep: routed.nextStep, text: "voltar", night: false });

  assert.equal(back.nextStep, "menu");

  // Um número tocado ou digitado vale mais que qualquer palavra.
  assert.equal(decideMenuReply({ lastStep: "menu", text: "1", night: false }).nextStep, "awaiting_1");
  assert.equal(decideMenuReply({ lastStep: "menu", text: "Candidatura", choiceId: "3", night: false }).nextStep, "awaiting_3_name");

  // Saudação pura continua a não gastar tentativa; texto sem palavra-chave continua a ser resposta errada.
  assert.equal(decideMenuReply({ lastStep: "menu", text: "Boa tarde", night: false }).smallTalk, true);
  assert.equal(decideMenuReply({ lastStep: "menu", text: "quero saber preços", night: false }).nextStep, "menu_retry");
});
