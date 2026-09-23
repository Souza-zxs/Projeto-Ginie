import { formatNowForAgent } from "@/lib/datetime";
import { describeServicePeriod } from "@/lib/service-hours";
import { AGENT_LANGUAGE_RULE } from "@/agents/locale";
import { chatCompletion, hasLlmConfigured, resolveModel, type ChatMessage } from "@/lib/openai/chat";

type ChatAgentInput = {
  agent: {
    name: string;
    description: string | null;
    system_prompt: string;
    openai_model?: string;
    greeting_template?: string | null;
    humanization_rules?: string | null;
    forbidden_phrases?: string | null;
    conversation_examples?: string | null;
    agent_skills?: string | null;
    qualification_criteria?: string | null;
    handoff_instructions?: string | null;
  };
  messages: Array<{
    direction: "inbound" | "outbound";
    content: string | null;
  }>;
};

export async function runAgentChat(input: ChatAgentInput) {
  if (!hasLlmConfigured()) {
    throw new Error("Nenhum modelo configurado: defina OPENAI_API_KEY ou OPENAI_BASE_URL.");
  }

  const systemPrompt = [
    input.agent.system_prompt,
    "",
    AGENT_LANGUAGE_RULE,
    "",
    "Regras de ritmo para soar humano:",
    input.agent.greeting_template
      ? `Saudação preferida para resposta curta: ${input.agent.greeting_template}`
      : "",
    "- Se a última mensagem for só um cumprimento, responde com o cumprimento indicado no período e uma pergunta curta.",
    "- Uma pergunta por mensagem; não acumules perguntas de qualificação.",
    "- Sem pontuação exagerada nem excesso de pontos de exclamação.",
    input.agent.humanization_rules ? `Tom e humanização:\n${input.agent.humanization_rules}` : "",
    input.agent.forbidden_phrases ? `Frases proibidas:\n${input.agent.forbidden_phrases}` : "",
    input.agent.conversation_examples ? `Bons exemplos:\n${input.agent.conversation_examples}` : "",
    input.agent.agent_skills ? `Conhecimento do agente:\n${input.agent.agent_skills}` : "",
    "",
    "Estás num simulador interno de WhatsApp.",
    "Responde com naturalidade, como numa conversa real, em mensagens curtas.",
    "Não devolvas JSON, não expliques critérios internos e não digas que é um teste.",
    input.agent.qualification_criteria
      ? `Critérios de qualificação: ${input.agent.qualification_criteria}`
      : "",
    input.agent.handoff_instructions
      ? `Encaminhamento: ${input.agent.handoff_instructions}`
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...input.messages.map((message) => ({
      role: (message.direction === "inbound" ? "user" : "assistant") as ChatMessage["role"],
      content: message.content || ""
    }))
  ];

  // A hora e o período vão na última mensagem, e não no system, para o system ficar
  // idêntico entre chamadas e o Ollama reaproveitar o cache do prompt.
  const last = messages[messages.length - 1];

  if (last?.role === "user") {
    last.content = `${last.content}\n\n[Agora é ${formatNowForAgent()}. Período (já calculado, não refaça a conta): ${describeServicePeriod()}]`;
  }

  const result = await chatCompletion({
    model: resolveModel(input.agent.openai_model),
    messages
  });

  if (!result.ok || !result.content) {
    throw new Error(result.error || "O modelo nao retornou resposta.");
  }

  return result.content.trim();
}
