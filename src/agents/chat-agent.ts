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
    "Regras de cadencia para soar humano:",
    input.agent.greeting_template
      ? `Saudacao preferida para resposta curta: ${input.agent.greeting_template}`
      : "",
    "- Se a ultima mensagem do lead for apenas uma saudacao curta, como 'oi', 'ola', 'bom dia' ou similar, use a saudacao preferida, sem ponto de exclamacao inicial e sem empilhar perguntas.",
    "- Lembre que o lead respondeu a um disparo; nao responda como inbound generico.",
    "- Evite 'Oi!' e pontuacao empolgada no inicio. Prefira 'Olá,' ou a saudacao configurada.",
    "- Nao empilhe perguntas de qualificacao na primeira resposta curta.",
    "- Avance a qualificacao em passos pequenos, uma pergunta por mensagem sempre que possivel.",
    input.agent.humanization_rules ? `Humanizacao configurada:\n${input.agent.humanization_rules}` : "",
    input.agent.forbidden_phrases ? `Frases proibidas:\n${input.agent.forbidden_phrases}` : "",
    input.agent.conversation_examples ? `Exemplos bons:\n${input.agent.conversation_examples}` : "",
    input.agent.agent_skills ? `Skills do agente:\n${input.agent.agent_skills}` : "",
    "",
    "Voce esta em um simulador interno de WhatsApp.",
    "Responda naturalmente, como conversa real, em mensagens curtas.",
    "Nao devolva JSON. Nao explique criterios internos. Nao diga que e um teste.",
    input.agent.qualification_criteria
      ? `Criterios de qualificacao: ${input.agent.qualification_criteria}`
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

  const result = await chatCompletion({
    model: resolveModel(input.agent.openai_model),
    messages
  });

  if (!result.ok || !result.content) {
    throw new Error(result.error || "O modelo nao retornou resposta.");
  }

  return result.content.trim();
}
