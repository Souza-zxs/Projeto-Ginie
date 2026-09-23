// Reconstrói as respostas do cliente ao bot de menu a partir do histórico de mensagens.
// Cada mensagem do bot leva `menu_step` (a pergunta que ela faz); a mensagem seguinte do
// cliente é a resposta a essa pergunta. Módulo puro (sem imports do projeto) para testes.

export type MenuHistoryMessage = {
  direction: "inbound" | "outbound";
  content: string | null;
  /** payload->>menu_step da mensagem; só o bot preenche. */
  menu_step: string | null;
};

export type MenuAnswer = { question: string; answer: string };

export type MenuTopic = "support" | "training" | "recruitment" | "other";

export const TOPIC_LABELS: Record<MenuTopic, string> = {
  support: "Apoio domiciliário",
  training: "Formação",
  recruitment: "Candidatura",
  other: "Outro assunto"
};

const QUESTION_BY_STEP: Record<string, string> = {
  menu: "Opção do menu",
  menu_retry: "Opção do menu",
  awaiting_1: "Apoio para quem",
  awaiting_1_type: "Tipo de apoio",
  awaiting_1_urgency: "Urgência",
  awaiting_1_zone: "Localidade",
  awaiting_1_zone_retry: "Localidade",
  awaiting_2: "Curso",
  awaiting_3: "Experiência ou formação",
  awaiting_3_details: "Nome e zona",
  awaiting_3_details_retry: "Nome e zona"
};

/** Respostas do cliente, em ordem, com a pergunta a que cada uma responde. */
export function extractMenuAnswers(messages: MenuHistoryMessage[]): MenuAnswer[] {
  const answers: MenuAnswer[] = [];
  let pendingStep: string | null = null;

  for (const message of messages) {
    if (message.direction === "outbound") {
      // Mensagem manual da equipa não tem menu_step e não muda a pergunta pendente.
      if (message.menu_step) {
        pendingStep = message.menu_step;
      }

      continue;
    }

    const question = pendingStep ? QUESTION_BY_STEP[pendingStep] : null;
    const text = (message.content ?? "").trim();

    if (question && text) {
      answers.push({ question, answer: text });
    } else if (pendingStep === "done" && text) {
      answers.push({ question: "Depois do encaminhamento", answer: text });
    }
  }

  return answers;
}

/** Assunto escolhido: pelo caminho do menu (a etapa que o bot abriu depois da escolha). */
export function detectMenuTopic(messages: MenuHistoryMessage[]): MenuTopic | null {
  const steps = new Set(messages.map((message) => message.menu_step).filter(Boolean));

  if (steps.has("awaiting_1")) return "support";
  if (steps.has("awaiting_2")) return "training";
  if (steps.has("awaiting_3")) return "recruitment";

  // A opção 4 e o "outro" encerram sem abrir etapa própria: se o menu foi respondido e a
  // conversa acabou, o assunto é "outro".
  const menuAnswered = messages.some((message) => message.direction === "inbound") && steps.has("done") && steps.has("menu");

  return menuAnswered ? "other" : null;
}

export type MenuProgress = "in_progress" | "handed_off" | "no_menu";

export function detectMenuProgress(messages: MenuHistoryMessage[]): MenuProgress {
  const lastStep = [...messages].reverse().find((message) => message.menu_step)?.menu_step ?? null;

  if (!lastStep) return "no_menu";

  return lastStep === "done" ? "handed_off" : "in_progress";
}
