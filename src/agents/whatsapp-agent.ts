// Agente conversacional livre do WhatsApp da DAR+ (Uazapi). Mesma arquitetura de
// src/agents/lead-agent.ts (prompt ordenado para o cache do Ollama, AGENT_LANGUAGE_RULE
// injetada duas vezes, saída em JSON com schema estrito, fundamentação contra alucinação,
// guarda-corpo sempre aplicado), mas de domínio mais amplo: apoio domiciliário, formação e
// candidatura, em vez de só qualificação de lead.
//
// Importante: este módulo NUNCA decide a elegibilidade da candidatura (idade, autorização de
// trabalho, recibos verdes, Lisboa). Ele só conduz a conversa e relata o que entendeu; quem
// decide passa/recusa é sempre o código, em candidacy-eligibility.ts + lead-workflow.ts — ver
// o comentário em cima de buildSystemPrompt.
import { formatNowForAgent } from "@/lib/datetime";
import { describeServicePeriod, getGreeting } from "@/lib/service-hours";
import { AGENT_LANGUAGE_RULE } from "@/agents/locale";
import { mergeKnownFacts, type KnownLeadFacts } from "@/agents/known-facts";
import { buildGroundingText, isGroundedNumber, isGroundedText } from "@/agents/extraction-grounding";
import { applyConversationGuardrails, dropKnownRegionQuestion, enforceReplyGuardrails, followUpFor, needsFollowUp, isEmergency, EMERGENCY_REPLY, isBotQuestion, BOT_REPLY, detectRegion, isPriceQuestion, isFreeClarification, PRICE_REPLY, FREE_CLARIFICATION_REPLY, HOURS_QUESTION, followUpQuestion, TEAM_OFFER, TEAM_OFFER_MARKER, TEAM_CONFIRM_REPLY, isAffirmative, shouldOfferTeam, stripQuestions, greetingReply, historyTextForModel, introduceAgent, isGreetingOnly } from "@/agents/reply-guardrails";
import { chatCompletion, hasLlmConfigured, resolveModel, type ChatMessage } from "@/lib/openai/chat";
import type { CandidacyFacts, CandidacyKey } from "@/agents/candidacy-eligibility";

export type WhatsappTopic = "support" | "training" | "recruitment" | "other";

export type WhatsappKnown = {
  topic: WhatsappTopic | null;
  /** Factos do apoio domiciliário (reaproveita o formato de known-facts.ts). */
  support: KnownLeadFacts;
  /** Nome que a própria pessoa deu (pode ser diferente do nome de perfil do WhatsApp). */
  candidateName: string | null;
  /** Elegibilidade da candidatura (idade + 4 eliminatórias) já resolvida até agora. */
  eligibility: CandidacyFacts;
  /** Campo que o código está à espera de resolver agora; null = nada pendente (ou não é candidatura). */
  eligibilityPendingField: CandidacyKey | null;
  /** Texto-base da pergunta pendente (o modelo pode reformular à vontade, mas tem de perguntar isto). */
  eligibilityQuestion: string | null;
};

type WhatsappAgentAgentConfig = {
  name: string;
  system_prompt: string;
  openai_model?: string | null;
  greeting_template?: string | null;
  humanization_rules?: string | null;
  forbidden_phrases?: string | null;
  conversation_examples?: string | null;
  agent_skills?: string | null;
};

type WhatsappAgentInput = {
  contact: { name: string | null; phone: string };
  agent?: WhatsappAgentAgentConfig | null;
  known: WhatsappKnown;
  messages: Array<{ direction: "inbound" | "outbound"; content: string | null }>;
  night: boolean;
};

export type WhatsappAgentOutput = {
  reply: string;
  topic: WhatsappTopic;
  support: KnownLeadFacts;
  candidateName: string | null;
  /** O modelo acha que já recolheu o suficiente e a equipa deve continuar a partir daqui. */
  handoffRequested: boolean;
};

const SERVICE_CATALOGUE = [
  "A DAR+ tem três áreas: apoio domiciliário (cuidar de uma pessoa idosa em casa), formação profissional em geriatria e candidaturas (trabalhar na DAR+ como cuidador(a)).",
  "Cursos: Técnico de Geriatria 360º (b-learning, 60h online + 120h de estágio); Animação Sociocultural com Idosos (b-learning, 40h online + 20h de prática); Gestão de ERPI, Centro de Dia e SAD (e-learning síncrono, 60h ao vivo + 15h de projeto); Prevenção do Burnout no Cuidador de Idosos (e-learning, 4h). Alguns têm módulos avulsos.",
  "Ao falar dos cursos, apresenta-os em frases naturais, sem listas nem marcadores, e só dá os detalhes de um curso se a pessoa perguntar por ele. Não menciones preços: isso fica para a equipa."
].join("\n");

function buildSystemPrompt(input: WhatsappAgentInput) {
  const eligibilityBlock =
    input.known.topic === "recruitment"
      ? [
          "Esta conversa é sobre candidatura para trabalhar na DAR+.",
          "A elegibilidade (idade, experiência, autorização de trabalho, recibos verdes, zona) é decidida pelo CÓDIGO, nunca por ti.",
          "A tua única função aqui é perguntar, UMA pergunta de cada vez, na ordem em que o sistema pedir — nunca adiantes a pergunta seguinte, nunca resumas várias perguntas numa só, e nunca digas se a pessoa passou ou não.",
          input.known.eligibilityQuestion
            ? `Pergunta a fazer agora (podes reformular com as tuas palavras, mas tem de ser exatamente isto, sem adicionar mais nada): "${input.known.eligibilityQuestion}"`
            : "O sistema vai dizer-te quando a parte de elegibilidade terminar; a partir daí, podes perguntar livremente sobre disponibilidade, horário, experiência adicional e outros detalhes do perfil.",
          "Se a pessoa já respondeu a tudo o que o sistema te pede e parece não haver mais nada a perguntar, marca handoffRequested como verdadeiro."
        ].join("\n")
      : "";

  return [
    input.agent?.system_prompt ||
      "És a assistente de WhatsApp da DAR+ Serviços | Formação, em Portugal. Conversa de forma natural e calorosa, nunca como um formulário.",
    "",
    AGENT_LANGUAGE_RULE,
    "",
    "Regras de ritmo:",
    "- Uma pergunta por mensagem; não acumules perguntas.",
    "- Escreve como uma pessoa a conversar no WhatsApp: reage ao que a pessoa disse (\"Percebo\", \"Claro\", \"Imagino que seja uma preocupação\"), com frases naturais e calorosas. Nunca escrevas como um comunicado (\"Deixo a informação que…\") nem como um menu ou formulário.",
    "- Vai direto ao que a pessoa pediu, com simpatia. Só expressas preocupação ou pena quando ela falar de um problema, doença ou urgência; num pedido normal, não presumas emoções (nunca digas \"está preocupada\") e não marques o género da pessoa.",
    "- Se a pessoa já disse o que precisa, não perguntes \"como posso ajudar\": reconhece o pedido e faz UMA pergunta útil para avançar (zona onde vive, para quem é, que ajuda precisa, horário).",
    "- Distingue quem escreve de quem precisa de cuidados: fala da pessoa de quem se cuida em terceira pessoa (\"a sua avó\", \"ela\") e nunca lhe atribuas horários ou tarefas como se fossem de quem escreve, nem inventes horários novos.",
    "- Nunca uses listas com marcadores nem enumerações com hífenes: escreve sempre em frases corridas, como numa conversa.",
    "- Nunca escrevas listas de horários, datas ou números de opção: os horários de visita são sempre enviados pelo sistema, depois da tua resposta.",
    "- Sem pontuação exagerada nem excesso de emojis.",
    "- O campo `known` no JSON do utilizador traz o que já sabemos desta pessoa. NUNCA voltes a perguntar o que já está preenchido lá.",
    "- Se a última mensagem for só uma saudação ou cortesia (\"olá\", \"boa tarde\", \"tudo bem\"), responde com simpatia e retoma a conversa de onde ficou — não repitas a pergunta do zero nem a trates como se não tivesses percebido.",
    "",
    SERVICE_CATALOGUE,
    "",
    eligibilityBlock,
    "",
    input.agent?.humanization_rules ? `Tom e humanização:\n${input.agent.humanization_rules}` : "",
    input.agent?.forbidden_phrases ? `Frases proibidas:\n${input.agent.forbidden_phrases}` : "",
    input.agent?.conversation_examples ? `Bons exemplos:\n${input.agent.conversation_examples}` : "",
    input.agent?.agent_skills ? `Conhecimento do agente:\n${input.agent.agent_skills}` : "",
    "- Nunca confirmes desconto ou preço fechado; isso é sempre com a equipa.",
    "- Não marques nem ofereças horários, datas ou visitas: marcar é sempre com a nossa equipa, porque só ela vê a disponibilidade real. Se a pessoa quiser marcar uma visita ou combinar um horário, diz com simpatia que a equipa trata disso e combina diretamente com ela, e não proponhas nenhuma data nem hora.",
    "",
    "O campo `now` traz a data e a hora de Portugal, e `periodo` diz se estamos dentro ou fora do horário de atendimento. Segue `periodo`: já está calculado, não refaças a conta.",
    "",
    "Responde SÓ com um objeto JSON válido, sem texto antes ou depois e sem blocos de código.",
    "Campos obrigatórios: reply, topic (um de: support | training | recruitment | other),",
    "interest, region, budget, paymentMethod, urgency (factos do apoio domiciliário; null se não se aplicar ou ainda não foi dito),",
    "candidateName (nome que a pessoa deu, se for candidatura; null senão), handoffRequested (bool).",
    "",
    "Lembrete final: o campo reply é em português de Portugal (nunca \"você\"), em frases naturais de quem conversa, sem repetir o que já foi dito."
  ]
    .filter(Boolean)
    .join("\n");
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "topic", "interest", "region", "budget", "paymentMethod", "urgency", "candidateName", "handoffRequested"],
  properties: {
    reply: { type: "string" },
    topic: { type: "string", enum: ["support", "training", "recruitment", "other"] },
    interest: { type: ["string", "null"] },
    region: { type: ["string", "null"] },
    budget: { type: ["number", "null"] },
    paymentMethod: { type: ["string", "null"] },
    urgency: { type: ["string", "null"] },
    candidateName: { type: ["string", "null"] },
    handoffRequested: { type: "boolean" }
  }
} as const;

type RawOutput = {
  reply: string;
  topic: WhatsappTopic;
  interest: string | null;
  region: string | null;
  budget: number | null;
  paymentMethod: string | null;
  urgency: string | null;
  candidateName: string | null;
  handoffRequested: boolean;
};

export async function runWhatsappAgent(input: WhatsappAgentInput): Promise<WhatsappAgentOutput> {
  if (!hasLlmConfigured()) {
    return heuristicReply(input);
  }

  // Um "Olá" não precisa do modelo: responder em código é instantâneo e evita que o modelo
  // pequeno invente a conversa (já o vimos escrever como se fosse o cliente).
  const lastInbound = [...input.messages].reverse().find((m) => m.direction === "inbound")?.content ?? "";

  if (lastInbound && isGreetingOnly(lastInbound)) {
    return {
      reply: greetingReply(
        lastInbound,
        input.messages.some((m) => m.direction === "outbound"),
        input.agent?.name,
        getGreeting()
      ),
      topic: input.known.topic ?? "other",
      support: input.known.support,
      candidateName: input.known.candidateName,
      handoffRequested: false,
    };
  }

  // A pessoa aceitou que a equipa entre em contacto: confirma e passa à equipa (o lead-workflow
  // faz a passagem ao ver esta resposta).
  const lastOutboundText = [...input.messages].reverse().find((m) => m.direction === "outbound")?.content ?? "";

  if (lastInbound && lastOutboundText.includes(TEAM_OFFER_MARKER) && isAffirmative(lastInbound)) {
    return {
      reply: TEAM_CONFIRM_REPLY,
      topic: input.known.topic ?? "support",
      support: input.known.support,
      candidateName: input.known.candidateName,
      handoffRequested: true,
    };
  }

  // "És um robô?": sempre a verdade, sempre a mesma resposta.
  if (lastInbound && isBotQuestion(lastInbound)) {
    return {
      reply: BOT_REPLY,
      topic: input.known.topic ?? "other",
      support: input.known.support,
      candidateName: input.known.candidateName,
      handoffRequested: false,
    };
  }

  // Preço: resposta fixa e correta (o orçamento é que é gratuito), seguida da pergunta que falta.
  if (lastInbound && (isPriceQuestion(lastInbound) || isFreeClarification(lastInbound))) {
    const known = input.known.support;
    const next = shouldOfferTeam(input.messages, known.region)
      ? TEAM_OFFER
      : known.region && known.urgency
        ? HOURS_QUESTION
        : followUpQuestion({ region: known.region, urgency: known.urgency });

    return {
      reply: `${isFreeClarification(lastInbound) ? FREE_CLARIFICATION_REPLY : PRICE_REPLY}\n\n${next}`,
      topic: input.known.topic ?? "support",
      support: input.known.support,
      candidateName: input.known.candidateName,
      handoffRequested: false,
    };
  }

  // Urgência (queda, desmaio, falta de ar…): resposta fixa com o 112 e passagem à equipa. Não
  // pode depender de um modelo pequeno, que já inventou uma "equipa médica".
  if (lastInbound && isEmergency(lastInbound)) {
    return {
      reply: EMERGENCY_REPLY,
      topic: input.known.topic ?? "support",
      support: input.known.support,
      candidateName: input.known.candidateName,
      handoffRequested: true,
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(input);
    // A conversa vai como turnos reais de chat (pessoa = user, Cecília = assistant): um modelo
    // pequeno segue muito melhor o fio da conversa assim do que lendo-a dentro de um JSON.
    // O contexto interno (o que já sabemos, data, período) vem no fim, para o início do prompt
    // ficar igual entre mensagens e o Ollama poder reaproveitar o cache.
    const turns: ChatMessage[] = input.messages
      .slice(-8)
      .map((m) => ({
        role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: m.direction === "inbound" ? (m.content ?? "") : historyTextForModel(m.content)
      }))
      .filter((m) => m.content.trim().length > 0);

    const knownFacts = Object.entries(input.known.support)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `${key}: ${value}`);

    const context = [
      "CONTEXTO INTERNO (não o repitas à pessoa):",
      `- Nome da pessoa: ${input.contact.name ?? input.known.candidateName ?? "ainda não o sabes"}`,
      `- Assunto até agora: ${input.known.topic ?? "ainda não definido"}`,
      `- Já sabes: ${knownFacts.length > 0 ? knownFacts.join("; ") : "nada ainda"}`,
      `- Data e hora: ${formatNowForAgent()}`,
      `- ${describeServicePeriod()}`,
      "Responde à ÚLTIMA mensagem da pessoa, tendo em conta toda a conversa acima: não repitas a saudação nem perguntes o que ela já disse."
    ].join("\n");

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...turns,
      { role: "system", content: context }
    ];

    const result = await chatCompletion({
      model: resolveModel(input.agent?.openai_model),
      messages,
      responseFormat: { type: "json_schema", json_schema: { name: "whatsapp_reply", strict: true, schema: OUTPUT_SCHEMA } }
    });

    if (!result.ok || !result.content) {
      throw new Error(result.error || "Modelo nao retornou resposta.");
    }

    const value = JSON.parse(extractJson(result.content)) as Partial<RawOutput>;

    return normalize(value, input);
  } catch {
    // Falha do modelo (tempo esgotado, JSON inválido): pede para repetir em vez de encaminhar
    // e pausar o bot. Só se encaminha para a equipa quando a pessoa pede ou há algo que só uma
    // pessoa resolve (ver human-handoff.ts).
    return { ...heuristicReply(input), reply: TECH_RETRY_REPLY, handoffRequested: false };
  }
}

/** Modelos locais às vezes embrulham o JSON em ```json ... ``` ou texto. Extrai o objeto. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  return start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
}

const TECH_RETRY_REPLY = "Peço desculpa, tive uma pequena dificuldade técnica. Pode repetir a sua mensagem, por favor?";

const FALLBACK_REPLY = "Peço desculpa, estou com uma dificuldade técnica neste momento. Vou já passar a sua mensagem à nossa equipa.";

/** Sem modelo configurado, ou o modelo falhou: resposta segura e encaminha — nunca inventa. */
function heuristicReply(input: WhatsappAgentInput): WhatsappAgentOutput {
  return {
    reply: enforceReplyGuardrails(FALLBACK_REPLY).reply,
    topic: input.known.topic ?? "other",
    support: input.known.support,
    candidateName: input.known.candidateName,
    handoffRequested: true,
  };
}

function normalize(value: Partial<RawOutput>, input: WhatsappAgentInput): WhatsappAgentOutput {
  const fallback = heuristicReply(input);
  const groundingText = buildGroundingText(input.messages);

  // Mesma lógica de normalizeQualification em lead-agent.ts: um modelo pequeno às vezes
  // "chuta" um valor plausível para um campo obrigatório do JSON em vez de admitir que não
  // sabe. Descarta o que não aparece no que a pessoa escreveu (nem já era conhecido).
  const grounded: KnownLeadFacts = {
    interest: isGroundedText(value.interest, groundingText, input.known.support.interest) ? (value.interest ?? null) : null,
    region: isGroundedText(value.region, groundingText, input.known.support.region) ? (value.region ?? null) : null,
    paymentMethod: isGroundedText(value.paymentMethod, groundingText, input.known.support.paymentMethod)
      ? (value.paymentMethod ?? null)
      : null,
    urgency: isGroundedText(value.urgency, groundingText, input.known.support.urgency) ? (value.urgency ?? null) : null,
    budget: isGroundedNumber(value.budget, groundingText, input.known.support.budget) ? (value.budget ?? null) : null
  };
  const mergedSupport = mergeKnownFacts(grounded, input.known.support, fallback.support);
  // A zona quase nunca vem preenchida pelo modelo pequeno: lê-a das mensagens da pessoa.
  const regionFromText = mergedSupport.region
    ? null
    : detectRegion(input.messages.filter((m) => m.direction === "inbound").map((m) => m.content ?? "").join("\n"));
  const support = regionFromText ? { ...mergedSupport, region: regionFromText } : mergedSupport;

  const candidateName = isGroundedText(value.candidateName, groundingText, input.known.candidateName)
    ? (value.candidateName ?? null)
    : (input.known.candidateName ?? null);

  const validTopics: WhatsappTopic[] = ["support", "training", "recruitment", "other"];
  const topic = value.topic && validTopics.includes(value.topic) ? value.topic : (input.known.topic ?? "other");

  const { reply } = applyConversationGuardrails(
    typeof value.reply === "string" && value.reply.trim() ? value.reply : fallback.reply,
    input.messages
  );
  const hasOutbound = input.messages.some((m) => m.direction === "outbound");
  let body = dropKnownRegionQuestion(reply, support.region);

  // Conversa de apoio que acaba sem pergunta fica parada: acrescenta a pergunta que falta.
  const lastInboundText = [...input.messages].reverse().find((m) => m.direction === "inbound")?.content ?? "";

  // Com zona e necessidade já recolhidas, fecha oferecendo a equipa (única pergunta da mensagem).
  if ((topic === "support" || topic === "other") && !value.handoffRequested && shouldOfferTeam(input.messages, support.region)) {
    body = `${stripQuestions(body) || "Perfeito, ficou anotado."}\n\n${TEAM_OFFER}`.trim();
  }

  if (
    (topic === "support" || topic === "other" || topic === "training") &&
    !value.handoffRequested &&
    needsFollowUp(body, lastInboundText)
  ) {
    body = `${body}\n\n${followUpFor(topic, { region: support.region, urgency: support.urgency })}`;
  }

  const finalReply = hasOutbound ? body : introduceAgent(body, input.agent?.name, getGreeting());

  return {
    reply: finalReply,
    topic,
    support,
    candidateName,
    handoffRequested: Boolean(value.handoffRequested),
  };
}
