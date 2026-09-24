import test from "node:test";
import assert from "node:assert/strict";
import { CANDIDACY, MENU_CHOICE_ROWS } from "./menu-bot.ts";
import { describeClientStatus, detectMenuProgress, detectMenuTopic, displayAnswer, extractMenuAnswers, splitMenuRequests } from "./menu-answers.ts";

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

test("associa cada resposta à pergunta feita antes dela (resposta que o bot recusou não conta)", () => {
  assert.deepEqual(extractMenuAnswers(supportFlow), [
    { question: "Opção do menu", answer: "Apoio domiciliário" },
    { question: "Apoio para quem", answer: "Pai ou mãe" },
    { question: "Tipo de apoio", answer: "Higiene pessoal" },
    { question: "Urgência", answer: "O quanto antes" },
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

test("mensagens depois do encaminhamento não entram nas respostas, só numa contagem", () => {
  const messages = [...supportFlow, client("Ainda aí?"), client("Olá")];
  const [request] = splitMenuRequests(messages);

  assert.equal(extractMenuAnswers(messages).at(-1).question, "Localidade");
  assert.equal(request.afterHandoff, 2);
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

test("estado do cliente: encaminhado, em atendimento pela equipa (bot pausado) ou com o bot", () => {
  assert.deepEqual(describeClientStatus("handed_off", false), { label: "Encaminhado para a equipa", tone: "warning" });
  assert.deepEqual(describeClientStatus("in_progress", false), { label: "Em atendimento pela equipa", tone: "warning" });
  assert.deepEqual(describeClientStatus("in_progress", true), { label: "A responder ao bot", tone: "default" });
});

test("mensagem manual da equipa (sem menu_step) no meio do fluxo não vira resposta do cliente", () => {
  const messages = [
    bot("awaiting_1_zone"),
    { direction: "outbound", content: "Olá, sou da equipa", menu_step: null },
    client("Lisboa")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Localidade", answer: "Lisboa" }]);
});

test("mídia que o bot não lê ([áudio], [imagem]) não vira resposta; depois do encaminhamento só conta", () => {
  const messages = [
    bot("awaiting_1_zone"), client("[áudio]"),
    bot("awaiting_1_zone", "só texto"), client("Lisboa"),
    bot("awaiting_1_confirm"), client("[imagem]"),
    bot("awaiting_1_confirm"), client("Sim"),
    bot("done"), client("[áudio]")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Localidade", answer: "Lisboa" }]);
  assert.equal(splitMenuRequests(messages)[0].afterHandoff, 1);
});


const at = (n) => `2026-09-24T${String(8 + n).padStart(2, "0")}:00:00Z`;
const stamped = (messages) => messages.map((message, index) => ({ ...message, created_at: at(index) }));

test("cada passagem pelo menu é um pedido; o menu reaparecendo depois do encaminhamento abre outro", () => {
  const messages = stamped([
    client("olá"), bot("menu"),
    client("Formação"), bot("awaiting_2"),
    client("Técnico de Geriatria"), bot("done"),
    client("Olá"), bot("menu"),
    client("Apoio domiciliário"), bot("awaiting_1"),
    client("Para mim"), bot("awaiting_1_type")
  ]);
  const requests = splitMenuRequests(messages);

  assert.equal(requests.length, 2);
  assert.equal(requests[0].topic, "training");
  assert.equal(requests[0].progress, "handed_off");
  assert.deepEqual(requests[0].answers, [
    { question: "Opção do menu", answer: "Formação" },
    { question: "Curso", answer: "Técnico de Geriatria" }
  ]);
  assert.equal(requests[0].startedAt, at(0));

  assert.equal(requests[1].topic, "support");
  assert.equal(requests[1].progress, "in_progress");
  assert.deepEqual(requests[1].answers, [
    { question: "Opção do menu", answer: "Apoio domiciliário" },
    { question: "Apoio para quem", answer: "Para mim" }
  ]);
  // O "Olá" que reabriu o menu pertence ao pedido novo, não ao encaminhamento antigo.
  assert.equal(requests[0].afterHandoff, 0);
  assert.equal(requests[1].startedAt, at(6));
});

test("voltar ao menu no meio do fluxo não abre pedido novo", () => {
  const messages = stamped([
    bot("menu"), client("Formação"), bot("awaiting_2"),
    client("← Voltar"), bot("menu"),
    client("Candidatura"), bot("awaiting_3")
  ]);

  assert.equal(splitMenuRequests(messages).length, 1);
});

test("várias passagens de teste: três pedidos, cada um com as suas respostas", () => {
  const run = (choice, step) => [client("olá"), bot("menu"), client(choice), bot(step), client("x"), bot("done")];
  const messages = stamped([...run("Formação", "awaiting_2"), ...run("Candidatura", "awaiting_3"), ...run("Formação", "awaiting_2")]);
  const requests = splitMenuRequests(messages);

  assert.equal(requests.length, 3);
  assert.deepEqual(requests.map((request) => request.topic), ["training", "recruitment", "training"]);
});

test("conversa sem menu não gera pedido com progresso", () => {
  const requests = splitMenuRequests([client("oi"), { direction: "outbound", content: "x", menu_step: null }]);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].progress, "no_menu");
});

test("opção do menu recusada (o bot repetiu o menu) não conta como resposta", () => {
  const messages = [bot("menu"), client("#"), bot("menu_retry"), client("2"), bot("awaiting_2")];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Opção do menu", answer: "Formação" }]);
});

test("os rótulos das respostas da candidatura acompanham as perguntas do bot", () => {
  for (const item of CANDIDACY) {
    const [answer] = extractMenuAnswers([bot(item.step), client("resposta")]);

    assert.equal(answer?.question, item.label, item.step);
  }
});

test("'voltar' na candidatura apaga a resposta da pergunta anterior, uma etapa de cada vez", () => {
  const messages = [
    bot("awaiting_3_name"), client("Ana Silva"),
    bot("awaiting_3_age"), client("Sim"),
    bot("awaiting_3_q1"), client("Não"),
    bot("awaiting_3_q2"), client("← Voltar"),
    bot("awaiting_3_q1"), client("Sim"),
    bot("awaiting_3_q2")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [
    { question: "Nome", answer: "Ana Silva" },
    { question: "Tem 18 anos ou mais", answer: "Sim" },
    { question: "Experiência como cuidador(a)", answer: "Sim" }
  ]);
});

test("resposta confusa repetida pelo bot na mesma pergunta não conta; só a aceita", () => {
  const messages = [
    bot("awaiting_3_q2"), client("talvez"),
    bot("awaiting_3_q2"), client("Sim"),
    bot("awaiting_3_q3")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Autorização para trabalhar em Portugal", answer: "Sim" }]);
});

test("recusa: pedido 'declined', motivo lido dos 'Não' e estado 'Não avança: motivo'", () => {
  const messages = stamped([
    bot("menu"), client("Candidatura"),
    bot("awaiting_3_name"), client("Ana Silva"),
    bot("awaiting_3_age"), client("Sim"),
    bot("awaiting_3_q1"), client("Sim"),
    bot("awaiting_3_q2"), client("Não"),
    bot("awaiting_3_q3"), client("Não"),
    bot("awaiting_3_q4"), client("Sim"),
    bot("declined"), client("obrigada")
  ]);
  const [request] = splitMenuRequests(messages);

  assert.equal(request.progress, "declined");
  assert.equal(request.topic, "recruitment");
  assert.equal(request.declineReason, "sem autorização de trabalho, não aceita recibos verdes");
  assert.equal(request.afterHandoff, 0);
  assert.deepEqual(describeClientStatus("declined", true, request.declineReason), {
    label: "Não avança: sem autorização de trabalho, não aceita recibos verdes",
    tone: "muted"
  });
  assert.equal(describeClientStatus("declined", true).label, "Não avança");
});

test("recusa pela idade, e 'voltar' na recusa desfaz o 'Não'", () => {
  const byAge = [bot("awaiting_3_age"), client("Não"), bot("declined")];

  assert.equal(splitMenuRequests(byAge)[0].declineReason, "menos de 18 anos");

  const undone = [...byAge, client("voltar"), bot("awaiting_3_age")];

  assert.deepEqual(extractMenuAnswers(undone), []);

  const afterQ4 = [
    bot("awaiting_3_q3"), client("Sim"),
    bot("awaiting_3_q4"), client("Não"),
    bot("declined"), client("← Voltar"),
    bot("awaiting_3_q4")
  ];

  assert.deepEqual(extractMenuAnswers(afterQ4), [{ question: "Recibos verdes", answer: "Sim" }]);
});

test("o menu depois de uma recusa abre um pedido novo", () => {
  const messages = stamped([
    bot("awaiting_3_age"), client("Não"), bot("declined"),
    client("menu"), bot("menu"),
    client("Formação"), bot("awaiting_2")
  ]);
  const requests = splitMenuRequests(messages);

  assert.equal(requests.length, 2);
  assert.equal(requests[0].progress, "declined");
  assert.equal(requests[1].topic, "training");
});

test("sim/não mapeados: ids da lista e do rótulo antigo", () => {
  assert.equal(displayAnswer("Recibos verdes", "yes"), "Sim");
  assert.equal(displayAnswer("Recibos verdes", "no"), "Não");
  assert.equal(displayAnswer("Disponibilidade", "a3"), "Semana e fim de semana");
});

test("nome e horário escritos entre parênteses aparecem sem eles", () => {
  const messages = [
    bot("awaiting_3_name"), client("(Ana Maria Silva)"),
    bot("awaiting_3_hours"), client("( manhãs, das 9h às 13h )"),
    bot("awaiting_3_p4"), client("Sim")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [
    { question: "Nome", answer: "Ana Maria Silva" },
    { question: "Horário pretendido", answer: "manhãs, das 9h às 13h" },
    { question: "Carta de condução ou viatura", answer: "Sim" }
  ]);
  assert.equal(displayAnswer("Nome", "Ana Silva"), "Ana Silva");
  assert.equal(displayAnswer("Localidade", "(Benfica, Lisboa)"), "Benfica, Lisboa");
  assert.equal(displayAnswer("Curso", "(x)"), "(x)");
});

test("localidade entre parênteses aparece sem eles, também quando escrita de novo na confirmação", () => {
  const messages = [
    bot("awaiting_1_zone"), client("(Benfica, Lisboa)"),
    bot("awaiting_1_confirm"), client("(Porto)"),
    bot("awaiting_1_confirm"), client("Sim"),
    bot("done")
  ];

  assert.deepEqual(extractMenuAnswers(messages), [{ question: "Localidade", answer: "Porto" }]);
});
