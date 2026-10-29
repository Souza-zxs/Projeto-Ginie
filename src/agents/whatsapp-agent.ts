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
import { describeServicePeriod } from "@/lib/service-hours";
import { AGENT_LANGUAGE_RULE } from "@/agents/locale";
import { mergeKnownFacts, type KnownLeadFacts } from "@/agents/known-facts";
import { buildGroundingText, isGroundedNumber, isGroundedText } from "@/agents/extraction-grounding";
import { enforceReplyGuardrails } from "@/agents/reply-guardrails";
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
  "A DAR+ tem três áreas: apoio domiciliário (cuidar de uma pessoa idosa em casa), formação",
  "profissional em geriatria, e candidaturas (trabalhar na DAR+ como cuidador(a)).",
  "",
  "Cursos de formação disponíveis:",
  "- Técnico de Geriatria 360º com Estágio Prático: b-learning, 60h online + 120h de estágio.",
  "- Animação Sociocultural com Idosos com Estágio Prático: b-learning, 40h online + 20h de prática.",
  "- Gestão de ERPI, Centro de Dia e SAD: e-learning síncrono, 60h de aulas ao vivo + 15h de projeto final.",
  "- Prevenção do Burnout no Cuidador de Idosos: e-learning assíncrono, 4h.",
  "Alguns cursos também têm módulos avulsos. Não menciones preços: isso fica para a equipa."
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
    input.agent?.greeting_template ? `Saudação preferida: ${input.agent.greeting_template}` : "",
    "- Uma pergunta por mensagem; não acumules perguntas.",
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
    "- Nunca confirmes visitas, descontos ou preços fechados; isso é sempre com a equipa.",
    "",
    "O campo `now` traz a data e a hora de Portugal, e `periodo` diz se estamos dentro ou fora do horário de atendimento. Segue `periodo`: já está calculado, não refaças a conta.",
    "",
    "Responde SÓ com um objeto JSON válido, sem texto antes ou depois e sem blocos de código.",
    "Campos obrigatórios: reply, topic (um de: support | training | recruitment | other),",
    "interest, region, budget, paymentMethod, urgency (factos do apoio domiciliário; null se não se aplicar ou ainda não foi dito),",
    "candidateName (nome que a pessoa deu, se for candidatura; null senão), handoffRequested (bool).",
    "",
    `Lembrete final sobre o campo reply: ${AGENT_LANGUAGE_RULE}`
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

  try {
    const systemPrompt = buildSystemPrompt(input);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          contact: input.contact,
          known: {
            topic: input.known.topic,
            support: input.known.support,
            candidateName: input.known.candidateName,
            eligibilityPendingField: input.known.eligibilityPendingField
          },
          messages: input.messages,
          now: formatNowForAgent(),
          periodo: describeServicePeriod()
        })
      }
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
    return heuristicReply(input);
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

const FALLBACK_REPLY = "Peço desculpa, estou com uma dificuldade técnica neste momento. Vou já passar a sua mensagem à nossa equipa.";

/** Sem modelo configurado, ou o modelo falhou: resposta segura e encaminha — nunca inventa. */
function heuristicReply(input: WhatsappAgentInput): WhatsappAgentOutput {
  return {
    reply: enforceReplyGuardrails(FALLBACK_REPLY).reply,
    topic: input.known.topic ?? "other",
    support: input.known.support,
    candidateName: input.known.candidateName,
    handoffRequested: true
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
  const support = mergeKnownFacts(grounded, input.known.support, fallback.support);

  const candidateName = isGroundedText(value.candidateName, groundingText, input.known.candidateName)
    ? (value.candidateName ?? null)
    : (input.known.candidateName ?? null);

  const validTopics: WhatsappTopic[] = ["support", "training", "recruitment", "other"];
  const topic = value.topic && validTopics.includes(value.topic) ? value.topic : (input.known.topic ?? "other");

  const { reply } = enforceReplyGuardrails(typeof value.reply === "string" && value.reply.trim() ? value.reply : fallback.reply);

  return {
    reply,
    topic,
    support,
    candidateName,
    handoffRequested: Boolean(value.handoffRequested)
  };
}
