import test from "node:test";
import assert from "node:assert/strict";
import { GUARDRAIL_FALLBACK_REPLY, applyConversationGuardrails, enforceReplyGuardrails, stripRepeatedGreeting, toEuropeanPortuguese, dropInventedVisitDates, dropLeakedInstructions, dropRepeatedSentences, REPEATED_REPLY_REASK, stripSlotOptions, historyTextForModel, leadInForOffer, introduceAgent, isGreetingOnly, greetingReply, followUpQuestion, dropKnownRegionQuestion, isEmergency, EMERGENCY_REPLY, dropUnmentionedRelatives, flattenBullets, needsFollowUp, followUpFor, keepFirstQuestion, collapseStutter, tidyReply, isBotQuestion, BOT_REPLY, TEAM_OFFER, TEAM_OFFER_MARKER, TEAM_CONFIRM_REPLY, isAffirmative, stripQuestions, shouldOfferTeam, isPriceQuestion, isFreeClarification, PRICE_REPLY, FREE_CLARIFICATION_REPLY, dropFalseFree, detectRegion } from "./reply-guardrails.ts";

test("bloqueia a frase real que o modelo escreveu (caso observado em produção)", () => {
  const result = enforceReplyGuardrails(
    "Boa tarde, João. Vamos marcar uma consulta. Em que horário preferem o início?"
  );

  assert.equal(result.reply, GUARDRAIL_FALLBACK_REPLY);
  assert.equal(result.reason, "confirmacao_agendamento");
});

test("bloqueia variações de confirmação de agendamento", () => {
  for (const text of [
    "Fica confirmado para amanhã às 10h.",
    "Confirmo a visita para sexta-feira.",
    "Posso marcar a visita para si na quinta.",
    "A sua visita ficou marcada."
  ]) {
    assert.equal(enforceReplyGuardrails(text).reason, "confirmacao_agendamento", text);
  }
});

test("bloqueia oferta de desconto", () => {
  assert.equal(
    enforceReplyGuardrails("Posso lhe dar um desconto de 10% nesse pacote.").reason,
    "oferta_desconto"
  );
});

test("bloqueia preço fechado", () => {
  assert.equal(
    enforceReplyGuardrails("O orçamento fica em torno de 250€ por semana.").reason,
    "preco_fechado"
  );
});

test("bloqueia conselho médico direto", () => {
  assert.equal(
    enforceReplyGuardrails("O senhor deve tomar a medicação de manhã e à noite.").reason,
    "conselho_medico"
  );
});

test("não mexe em respostas normais", () => {
  const normal = "Boa tarde. Para o podermos ajudar melhor, em que zona vive?";
  assert.deepEqual(enforceReplyGuardrails(normal), { reply: normal, reason: null });
});

test("não bloqueia menção a 'visita' sem confirmar nada", () => {
  const text = "Podemos propor uma visita avaliativa; a nossa equipa entra em contacto para combinar.";
  assert.deepEqual(enforceReplyGuardrails(text), { reply: text, reason: null });
});

test("não bloqueia falar de preço em geral, só quando fecha um valor", () => {
  const text = "O valor é personalizado conforme as horas de apoio.";
  assert.deepEqual(enforceReplyGuardrails(text), { reply: text, reason: null });
});

test("parentesco: pessoa disse avó e a resposta traz avô -> bloqueia", () => {
  const r = enforceReplyGuardrails("Percebi, é para a sua avó e avô. Em que zona vivem?", "É para a minha avó");
  assert.equal(r.reply, GUARDRAIL_FALLBACK_REPLY);
  assert.equal(r.reason, "parentesco_inventado");
});

test("parentesco: resposta que repete só o que a pessoa disse passa", () => {
  const r = enforceReplyGuardrails("Percebi, é para a sua avó. Em que zona vive?", "É para a minha avó");
  assert.equal(r.reason, null);
});

test("parentesco: a pessoa falou nos dois ou em plural -> passa", () => {
  assert.equal(enforceReplyGuardrails("Para o avô e a avó, certo?", "avô e avó").reason, null);
  assert.equal(enforceReplyGuardrails("Para o avô e a avó, certo?", "são os meus avós").reason, null);
  assert.equal(enforceReplyGuardrails("Para o avô?", "para o meu avo").reason, null);
});

// Regressão: "confirmação" contém "irma" como substring. Sem o limite de palavra completa
// (checagem de fronteira Unicode), isso contava como a pessoa ter mencionado "irmã" e
// bloqueava uma resposta válida sobre "irmão".
test("parentesco: palavra que só contém o parentesco por acaso (ex.: 'confirmação' tem 'irma' dentro) não conta", () => {
  const r = enforceReplyGuardrails("Preciso falar com o seu irmão sobre isto.", "Aguardo a confirmação da visita.");
  assert.equal(r.reason, null);
});

test("cumprimento repetido é removido quando já houve um", () => {
  assert.equal(stripRepeatedGreeting("Boa tarde, João. Em que zona vive?", ["Boa tarde! Como posso ajudar?"]), "Em que zona vive?");
  assert.equal(stripRepeatedGreeting("Boa tarde. Obrigado pela informação.", ["Olá"]), "Obrigado pela informação.");
  assert.equal(stripRepeatedGreeting("Boa tarde, obrigado pela informação.", ["Boa tarde"]), "Obrigado pela informação.");
});

test("primeiro cumprimento é mantido", () => {
  assert.equal(stripRepeatedGreeting("Boa tarde, João. Em que posso ajudar?", []), "Boa tarde, João. Em que posso ajudar?");
  assert.equal(stripRepeatedGreeting("Boa tarde.", ["Boa tarde"]), "Boa tarde.");
});

test("applyConversationGuardrails junta as duas regras", () => {
  const msgs = [
    { direction: "outbound", content: "Boa tarde! Em que posso ajudar?" },
    { direction: "inbound", content: "É para a minha avó" }
  ];
  assert.equal(applyConversationGuardrails("Boa tarde. Qual a zona onde vive a sua avó?", msgs).reply, "Qual a zona onde vive a sua avó?");
  assert.equal(applyConversationGuardrails("Boa tarde. Vivem o avô e a avó aí?", msgs).reason, "parentesco_inventado");
});

test("pt-PT: gerúndio vira 'a + infinitivo'", () => {
  assert.equal(toEuropeanPortuguese("Estou verificando e estamos fazendo o possível."), "Estou a verificar e estamos a fazer o possível.");
  assert.equal(toEuropeanPortuguese("Ela está indo ao médico?"), "Ela está a ir ao médico?");
});

test("pt-PT: 'você' sai e o léxico do Brasil é trocado", () => {
  assert.equal(toEuropeanPortuguese("Você pode deixar o seu celular? O nosso time fala com você."), "Pode deixar o seu telemóvel? A nossa equipa fala consigo.");
  assert.equal(toEuropeanPortuguese("Qual o seu endereço e contato?"), "Qual a sua morada e contacto?");
});

test("pt-PT: texto já correto não muda", () => {
  const ok = "Boa tarde. Estou a verificar a morada e o contacto da equipa.";
  assert.equal(toEuropeanPortuguese(ok), ok);
});

test("pt-PT: 'vamos agendar' passa a 'vamos marcar' e é bloqueado", () => {
  assert.equal(enforceReplyGuardrails("Vamos agendar uma visita amanhã.").reason, "confirmacao_agendamento");
});

test("pt-PT: 'Deixo-vos' vira 'Deixo-lhe' e 'visita avaliativa' vira 'visita de avaliação'", () => {
  assert.equal(toEuropeanPortuguese("Deixo-vos a informação."), "Deixo-lhe a informação.");
});

test("visita com data inventada pelo modelo é removida (o sistema oferece os horários)", () => {
  const msg =
    "Deixo-vos a informação que os nossos serviços incluem apoio domiciliário. Poderá marcar uma visita avaliativa para a sua avó no dia útil seguinte. Estaremos em contacto então.";
  const r = enforceReplyGuardrails(msg, "preciso de uma cuidadora para a minha avó");
  assert.equal(r.reply, "Deixo-lhe a informação que os nossos serviços incluem apoio domiciliário. Estaremos em contacto então.");
});

test("visita sem data inventada passa; só data inventada vira frase de reserva", () => {
  assert.equal(dropInventedVisitDates("Podemos combinar uma visita de avaliação em casa.").changed, false);
  assert.equal(enforceReplyGuardrails("A visita fica para amanhã às 10h.").reply, GUARDRAIL_FALLBACK_REPLY);
});

test("instrução interna copiada pelo modelo é removida", () => {
  assert.equal(
    dropLeakedInstructions("Cuidamos de si todos os dias. Continue a recolher os dados hoje e estarei em contacto amanhã."),
    "Cuidamos de si todos os dias."
  );
});

test("frase já dita antes não se repete; se tudo repetir, faz pergunta aberta", () => {
  const before = ["Os nossos serviços incluem apoio domiciliário com cuidados pessoais e acompanhamento."];
  assert.equal(
    dropRepeatedSentences("Os nossos serviços incluem apoio domiciliário com cuidados pessoais e acompanhamento. Em que zona vive?", before),
    "Em que zona vive?"
  );
  assert.equal(
    dropRepeatedSentences("Os nossos serviços incluem apoio domiciliário com cuidados pessoais e acompanhamento.", before),
    REPEATED_REPLY_REASK
  );
  assert.equal(dropRepeatedSentences("Olá, tudo bem?", before), "Olá, tudo bem?");
});

test("lista de horários escrita pelo modelo é removida (só o sistema oferece horários)", () => {
  const invented =
    "Boa tarde\n\nTenho estes horários disponíveis para a visita:\n1) quinta-feira, 05 de novembro de 2026, às 14:00\n2) quinta-feira, 05 de novembro de 2026, às 15:00\n\nResponda com o número da opção (1, 2).";
  assert.equal(stripSlotOptions(invented), "Boa tarde");
  assert.equal(stripSlotOptions("Percebo, é uma decisão importante."), "Percebo, é uma decisão importante.");
});

test("histórico para o modelo não traz listas de horários", () => {
  assert.equal(historyTextForModel("Combinado.\n\n1) quinta-feira, 5 de novembro, às 09:00\nResponda com o número da opção (1)."), "Combinado.");
  assert.equal(historyTextForModel("1) quinta-feira, 5 de novembro, às 09:00"), "(enviei as opções de horário para a visita)");
});

test("abertura do convite: resposta só com cumprimento ganha frase humana", () => {
  assert.match(leadInForOffer("Boa tarde"), /visita de avaliação/);
  assert.equal(leadInForOffer("Claro, com todo o gosto."), "Claro, com todo o gosto.");
});

test("primeira mensagem: apresenta-se como Cecília e diz que vai iniciar o atendimento", () => {
  assert.equal(
    introduceAgent("Olá! Em que posso ajudar?", "Cecilia", "Boa tarde"),
    "Boa tarde! Chamo-me Cecília, sou da DAR+ e vou iniciar o seu atendimento. Em que posso ajudar?"
  );
  assert.equal(introduceAgent("Chamo-me Cecília e posso ajudar.", "Cecilia", "Boa tarde"), "Chamo-me Cecília e posso ajudar.");
});

test("apresentação não é pulada só porque a resposta cita o nome", () => {
  assert.match(introduceAgent("Boa tarde, Cecília. Estou com medo.", "Cecilia", "Boa tarde"), /Chamo-me Cecília, sou da DAR\+ e vou iniciar o seu atendimento/);
});

test("cumprimento puro é respondido em código", () => {
  assert.equal(isGreetingOnly("Olá"), true);
  assert.equal(isGreetingOnly("boa tarde, tudo bem?"), true);
  assert.equal(isGreetingOnly("Olá, preciso de uma cuidadora"), false);
  assert.match(greetingReply("Olá", false, "Cecilia", "Boa tarde"), /Chamo-me Cecília.*Em que posso ajudar\?$/);
  assert.equal(greetingReply("oi", true, "Cecilia", "Boa tarde"), "Diga, estou a ouvir. Em que posso ajudar?");
});

test("pergunta de seguimento e zona repetida", () => {
  assert.match(followUpQuestion({ region: null }), /zona/);
  assert.match(followUpQuestion({ region: "Cascais", urgency: null }), /Para quando/);
  assert.equal(
    dropKnownRegionQuestion("Percebo, ótimo. Em que zona vive a sua avó?", "Cascais"),
    "Percebo, ótimo."
  );
  assert.equal(dropKnownRegionQuestion("Em que zona vive?", "Cascais"), "Em que zona vive?");
});

test("urgência: resposta fixa com o 112", () => {
  assert.equal(isEmergency("A minha mãe caiu hoje e não consegue levantar!"), true);
  assert.equal(isEmergency("preciso de uma cuidadora para a minha avó"), false);
  assert.match(EMERGENCY_REPLY, /112/);
});

test("familiar que a pessoa nunca citou sai da resposta", () => {
  assert.equal(
    dropUnmentionedRelatives("Claro, posso ajudar. Em que zona vive a sua avó?", "você pode conversar comigo normalmente?"),
    "Claro, posso ajudar."
  );
  assert.equal(dropUnmentionedRelatives("Em que zona vive a sua avó?", "preciso de ajuda para a minha avó"), "Em que zona vive a sua avó?");
});

test("lista com marcadores vira frase corrida", () => {
  assert.equal(
    flattenBullets("Temos estes cursos:\n- Geriatria 360º\n- Animação Sociocultural\n- Gestão de ERPI"),
    "Temos estes cursos: Geriatria 360º; Animação Sociocultural; Gestão de ERPI"
  );
  assert.equal(flattenBullets("Sem lista nenhuma."), "Sem lista nenhuma.");
});

test("pergunta de seguimento só quando faz falta", () => {
  assert.equal(needsFollowUp("O custo é personalizado.", "quanto custa?"), true);
  assert.equal(needsFollowUp("Quer saber mais?", "quanto custa?"), false);
  assert.equal(needsFollowUp("Lamento, não temos serviço nessa zona.", "no Porto"), false);
  assert.equal(needsFollowUp("De nada!", "obrigada"), false);
  assert.match(followUpFor("training", {}), /cursos/);
});

test("só a primeira pergunta fica", () => {
  assert.equal(
    keepFirstQuestion("Preciso de saber mais. Em que horário precisa de ajuda? E quanto tempo por dia?"),
    "Preciso de saber mais. Em que horário precisa de ajuda?"
  );
  assert.equal(keepFirstQuestion("Em que zona vive?"), "Em que zona vive?");
});

test("repetição colada e vocativo inventado saem", () => {
  assert.equal(collapseStutter("À noite, à noite e ao fim de semana"), "À noite e ao fim de semana");
  assert.equal(tidyReply("Querido(a), temos quatro formações. Algum interessa?"), "Temos quatro formações. Algum interessa?");
});

test("pergunta se é robô tem resposta fixa e sincera", () => {
  assert.equal(isBotQuestion("mas você é um robô ou uma pessoa?"), true);
  assert.equal(isBotQuestion("estou a falar com uma pessoa real?"), true);
  assert.equal(isBotQuestion("preciso de uma cuidadora para a minha avó"), false);
  assert.match(BOT_REPLY, /assistente virtual/);
});

test("aceitar a oferta da equipa: respostas curtas afirmativas", () => {
  for (const ok of ["Sim", "sim, por favor", "Pode ser", "claro!", "Quero sim", "ok"]) assert.equal(isAffirmative(ok), true, ok);
  for (const no of ["não", "sim, mas quanto custa?", "quanto custa", "talvez depois", "preciso de uma cuidadora para a minha avó"]) assert.equal(isAffirmative(no), false, no);
});

test("oferta da equipa: só com zona, 3 mensagens reais e uma única vez", () => {
  const msgs = [
    { direction: "inbound", content: "Olá" },
    { direction: "inbound", content: "preciso de uma cuidadora para a minha avó" },
    { direction: "inbound", content: "em Cascais" },
    { direction: "inbound", content: "ela precisa de ajuda de manhã" }
  ];
  assert.equal(shouldOfferTeam(msgs, "Cascais"), true);
  assert.equal(shouldOfferTeam(msgs, null), false);
  assert.equal(shouldOfferTeam(msgs.slice(0, 3), "Cascais"), false);
  assert.equal(shouldOfferTeam([...msgs, { direction: "outbound", content: TEAM_OFFER }], "Cascais"), false);
  assert.match(TEAM_OFFER, new RegExp(TEAM_OFFER_MARKER));
  assert.match(TEAM_CONFIRM_REPLY, /orçamento/);
});

test("a oferta fica como única pergunta", () => {
  assert.equal(stripQuestions("Entendo a rotina dela. Como posso ajudar com isso?"), "Entendo a rotina dela.");
});

test("pt-PT: horas, medicamentos e outras palavras do Brasil", () => {
  assert.equal(toEuropeanPortuguese("Começa às 8:10, com banho e remédios."), "Começa às 8h10, com banho e medicamentos.");
  assert.equal(toEuropeanPortuguese("Ela toma suco e depois o remédio."), "Ela toma sumo e depois o medicamento.");
  assert.equal(toEuropeanPortuguese("Envie o arquivo."), "Envie o ficheiro.");
});

test("preço: perguntas de preço têm resposta fixa; cursos ficam de fora", () => {
  for (const q of ["quanto custa?", "me diga o preço", "qual o valor?", "gostava de um orçamento"]) assert.equal(isPriceQuestion(q), true, q);
  for (const q of ["quanto custa o curso de geriatria?", "preciso de uma cuidadora", "quero trabalhar aí"]) assert.equal(isPriceQuestion(q), false, q);
  assert.equal(isFreeClarification("o que seria gratuito?"), true);
  assert.match(PRICE_REPLY, /orçamento é gratuito/);
  assert.match(FREE_CLARIFICATION_REPLY, /o orçamento/);
});

test("só o orçamento é gratuito: afirmação falsa sai", () => {
  assert.equal(
    dropFalseFree("O que é gratuito são os cuidados pessoais, tarefas domésticas e acompanhamento, sem qualquer cobrança."),
    "Claro, com todo o gosto. Pode contar-me um pouco mais sobre o que precisa, para podermos ajudar da melhor forma?"
  );
  assert.equal(dropFalseFree("O orçamento é gratuito e sem compromisso."), "O orçamento é gratuito e sem compromisso.");
  assert.equal(
    dropFalseFree("Entendo. Os cuidados são gratuitos. Para quando precisa?"),
    "Entendo. Para quando precisa?"
  );
});

test("zona detectada em código", () => {
  assert.equal(detectRegion("Em Cascais"), "Cascais");
  assert.equal(detectRegion("vivo em Algés, perto da praia"), "Algés");
  assert.equal(detectRegion("moro em linda a velha"), "Linda-a-Velha");
  assert.equal(detectRegion("estou no Porto"), null);
});
