import { chatCompletion, hasLlmConfigured, resolveModel, type ChatMessage } from "@/lib/openai/chat";

export type LeadQualification = {
  name: string | null;
  phone: string;
  interest: string | null;
  region: string | null;
  budget: number | null;
  paymentMethod: string | null;
  urgency: string | null;
  intention: "novo_servico" | "contrato_recorrente" | "formacao" | "indefinido";
  qualificationStatus: string;
  stage: string;
  score: number;
  summary: string;
  qualified: boolean;
  wantsVisit: boolean;
  visitDatePreference: string | null;
  reply: string;
};

type LeadAgentInput = {
  contact: {
    name: string | null;
    phone: string;
  };
  campaign: {
    property_description: string | null;
    agent_prompt: string | null;
  } | null;
  agent?: {
    name: string;
    description: string | null;
    system_prompt: string;
    openai_model?: string;
    greeting_template?: string | null;
    humanization_rules?: string | null;
    forbidden_phrases?: string | null;
    conversation_examples?: string | null;
    agent_skills?: string | null;
    qualification_criteria: string | null;
    handoff_instructions: string | null;
  } | null;
  messages: Array<{
    direction: "inbound" | "outbound";
    content: string | null;
  }>;
};

export async function runLeadAgent(input: LeadAgentInput): Promise<LeadQualification> {
  if (!hasLlmConfigured()) {
    return heuristicQualification(input);
  }

  try {
    const systemPrompt = [
      input.agent?.system_prompt ||
        "Voce e um consultor da DAR+ Servicos e Formacao. Responda curto, qualifique o lead e devolva JSON valido.",
      "",
      "Regras de cadencia para a resposta em reply:",
      input.agent?.greeting_template
        ? `Saudacao preferida para resposta curta: ${input.agent.greeting_template}`
        : "",
      "- Se a ultima mensagem do lead for apenas uma saudacao curta, como 'oi', 'ola', 'bom dia' ou similar, use a saudacao preferida, sem ponto de exclamacao inicial e sem empilhar perguntas.",
      "- Lembre que o lead respondeu a um disparo; nao responda como inbound generico.",
      "- Evite 'Oi!' e pontuacao empolgada no inicio. Prefira 'Olá,' ou a saudacao configurada.",
      "- Nao empilhe perguntas de qualificacao na primeira resposta curta.",
      "- Avance a qualificacao em passos pequenos, uma pergunta por mensagem sempre que possivel.",
      input.agent?.humanization_rules
        ? `Humanizacao configurada:\n${input.agent.humanization_rules}`
        : "",
      input.agent?.forbidden_phrases
        ? `Frases proibidas:\n${input.agent.forbidden_phrases}`
        : "",
      input.agent?.conversation_examples
        ? `Exemplos bons:\n${input.agent.conversation_examples}`
        : "",
      input.agent?.agent_skills ? `Skills do agente:\n${input.agent.agent_skills}` : "",
      "- Mesmo devolvendo JSON, o campo reply deve soar como WhatsApp humano e natural.",
      "",
      "Responda SOMENTE com um objeto JSON valido, sem texto antes ou depois, sem blocos de codigo.",
      "Campos obrigatorios: name, phone, interest, region, budget, paymentMethod, urgency,",
      "intention (um de: novo_servico | contrato_recorrente | formacao | indefinido),",
      "qualificationStatus, stage, score (0-100), summary, qualified (bool), wantsVisit (bool),",
      "visitDatePreference, reply."
    ]
      .filter(Boolean)
      .join("\n");

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          agent: input.agent,
          qualificationCriteria: input.agent?.qualification_criteria,
          handoffInstructions: input.agent?.handoff_instructions,
          instruction: input.campaign?.agent_prompt,
          service: input.campaign?.property_description,
          contact: input.contact,
          messages: input.messages
        })
      }
    ];

    const result = await chatCompletion({
      model: resolveModel(input.agent?.openai_model),
      messages,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "lead_qualification",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "name",
              "phone",
              "interest",
              "region",
              "budget",
              "paymentMethod",
              "urgency",
              "intention",
              "qualificationStatus",
              "stage",
              "score",
              "summary",
              "qualified",
              "wantsVisit",
              "visitDatePreference",
              "reply"
            ],
            properties: {
              name: { type: ["string", "null"] },
              phone: { type: "string" },
              interest: { type: ["string", "null"] },
              region: { type: ["string", "null"] },
              budget: { type: ["number", "null"] },
              paymentMethod: { type: ["string", "null"] },
              urgency: { type: ["string", "null"] },
              intention: {
                type: "string",
                enum: ["novo_servico", "contrato_recorrente", "formacao", "indefinido"]
              },
              qualificationStatus: { type: "string" },
              stage: { type: "string" },
              score: { type: "integer", minimum: 0, maximum: 100 },
              summary: { type: "string" },
              qualified: { type: "boolean" },
              wantsVisit: { type: "boolean" },
              visitDatePreference: { type: ["string", "null"] },
              reply: { type: "string" }
            }
          }
        }
      }
    });

    if (!result.ok || !result.content) {
      throw new Error(result.error || "Modelo nao retornou resposta.");
    }

    return normalizeQualification(JSON.parse(extractJson(result.content)), input);
  } catch {
    return heuristicQualification(input);
  }
}

/** Modelos locais as vezes embrulham o JSON em ```json ... ``` ou texto. Extrai o objeto. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  return start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
}

function heuristicQualification(input: LeadAgentInput): LeadQualification {
  const inboundText = input.messages
    .filter((message) => message.direction === "inbound")
    .map((message) => message.content ?? "")
    .join(" ")
    .toLowerCase();
  const budgetMatch = inboundText.match(/(?:r\$|rs)?\s?(\d{3,}(?:[\.,]\d{3})*)/i);
  const budget = budgetMatch?.[1] ? Number(budgetMatch[1].replace(/\./g, "").replace(",", ".")) : null;
  const hasRegion = /bairro|regiao|região|zona|centro|sul|norte|leste|oeste/.test(inboundText);
  const hasPayment = /financi|entrada|avista|à vista|transferencia|multibanco/.test(inboundText);
  const wantsVisit = /visita|conhecer|orcamento no local|avaliar no local|agenda|agendar|marcar|hor[aá]rio|posso ir|consigo ir/.test(
    inboundText
  );
  const greetingOnly = /^(oi|ola|olá|bom dia|boa tarde|boa noite|opa|e ai|e aí)[\s!.]*$/i.test(
    inboundText.trim()
  );
  const score = Math.min(100, 30 + (budget ? 25 : 0) + (hasRegion ? 20 : 0) + (hasPayment ? 15 : 0));
  const qualified = score >= 70 || wantsVisit;

  return {
    name: input.contact.name,
    phone: input.contact.phone,
    interest: input.campaign?.property_description ?? "Serviço da campanha",
    region: hasRegion ? "Informada na conversa" : null,
    budget,
    paymentMethod: hasPayment ? "Informado na conversa" : null,
    urgency: /urgente|rapido|rápido|essa semana|hoje|amanha|amanhã/.test(inboundText)
      ? "alta"
      : null,
    intention: /manuten|recorrent|mensalidade|assinatura/.test(inboundText)
      ? "contrato_recorrente"
      : /forma[cç][aã]o|curso|treinamento|capacita/.test(inboundText)
        ? "formacao"
        : /novo|servi[cç]o/.test(inboundText)
          ? "novo_servico"
          : "indefinido",
    qualificationStatus: qualified ? "qualified" : "qualifying",
    stage: qualified ? "qualified" : "qualifying",
    score,
    summary: inboundText
      ? `Lead respondeu: ${inboundText.slice(0, 220)}`
      : "Lead ainda com poucas informacoes estruturadas.",
    qualified,
    wantsVisit,
    visitDatePreference: extractVisitPreference(inboundText),
    reply: greetingOnly
      ? input.agent?.greeting_template || "Olá, obrigado por responder. Como posso te ajudar?"
      : qualified
        ? input.agent?.handoff_instructions ||
          "Perfeito, ja tenho informacoes suficientes. Vou encaminhar seu atendimento para a nossa equipe tecnica agora."
        : "Perfeito. Para eu te ajudar melhor, me conta que tipo de serviço ou curso você procura e qual é o seu objetivo?"
  };
}

function normalizeQualification(value: Partial<LeadQualification>, input: LeadAgentInput) {
  const fallback = heuristicQualification(input);

  return {
    ...fallback,
    ...value,
    phone: input.contact.phone,
    score: Math.max(0, Math.min(100, Number(value.score ?? fallback.score))),
    qualified: Boolean(value.qualified ?? fallback.qualified),
    wantsVisit: Boolean(value.wantsVisit ?? fallback.wantsVisit),
    visitDatePreference: value.visitDatePreference ?? fallback.visitDatePreference
  };
}

function extractVisitPreference(text: string) {
  const match = text.match(
    /(hoje|amanh[aã]|segunda|terça|terca|quarta|quinta|sexta|s[aá]bado|sabado|domingo|manh[aã]|tarde|noite|[0-2]?\d[:h][0-5]?\d?)/i
  );

  return match?.[0] ?? null;
}
