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

// Respostas antigas foram gravadas com o código do item da lista (ex.: "u2") em vez do rótulo.
// Este mapa traduz na hora de mostrar. menu-answers.test.mjs confere que não fica defasado
// em relação às listas do menu-bot.
const CHOICE_LABELS: Record<string, string> = {
  w1: "Para mim",
  w2: "Pai ou mãe",
  w3: "Outro familiar",
  w4: "Amigo ou conhecido",
  h1: "Higiene pessoal",
  h2: "Refeições",
  h3: "Companhia",
  h4: "Medicação",
  h5: "Apoio doméstico",
  h6: "Vários serviços",
  u1: "O quanto antes",
  u2: "Próximas semanas",
  u3: "Só a informar-me",
  c1: "Técnico de Geriatria",
  c2: "Animação Sociocultural",
  c3: "Gestão de ERPI, CD e SAD",
  c4: "Prevenção do Burnout",
  c5: "Módulos avulsos",
  e1: "Tenho experiência",
  e2: "Tenho formação",
  e3: "Experiência e formação",
  e4: "Ainda sem experiência",
  other: "Outro",
  back: "← Voltar"
};

const MENU_OPTION_LABELS: Record<string, string> = {
  "1": "Apoio domiciliário",
  "2": "Formação",
  "3": "Candidatura",
  "4": "Outro assunto"
};

/** Texto legível de uma resposta: troca códigos de lista e números do menu pelos rótulos. */
export function displayAnswer(question: string, answer: string) {
  const key = answer.trim();

  if (question === "Opção do menu" && MENU_OPTION_LABELS[key]) {
    return MENU_OPTION_LABELS[key];
  }

  return CHOICE_LABELS[key] ?? answer;
}

// Ao voltar, a resposta dada à pergunta que vai ser repetida deixa de valer.
const DISCARDED_BY_BACK: Record<string, string> = {
  awaiting_1: "Opção do menu",
  awaiting_2: "Opção do menu",
  awaiting_3: "Opção do menu",
  awaiting_1_type: "Apoio para quem",
  awaiting_1_urgency: "Tipo de apoio",
  awaiting_1_zone: "Urgência",
  awaiting_1_zone_retry: "Urgência",
  awaiting_3_details: "Experiência ou formação",
  awaiting_3_details_retry: "Experiência ou formação"
};

// Etapas de confirmação: o que a pessoa respondeu não vira "resposta" própria. O que vale é o
// que o bot fez a seguir (a próxima mensagem dele): encaminhou (confirmou), repetiu a pergunta
// (corrigiu), confirmou outro texto (escreveu outra) ou voltou uma pergunta.
type ConfirmStep = { question: string; askAgain: string; backTo: string; backDiscards: string };

const CONFIRM_STEPS: Record<string, ConfirmStep> = {
  awaiting_1_confirm: {
    question: "Localidade",
    askAgain: "awaiting_1_zone",
    backTo: "awaiting_1_urgency",
    backDiscards: "Urgência"
  },
  awaiting_3_confirm: {
    question: "Nome e zona",
    askAgain: "awaiting_3_details",
    backTo: "awaiting_3",
    backDiscards: "Experiência ou formação"
  }
};

function truncateFrom(answers: MenuAnswer[], question: string) {
  const index = answers.map((item) => item.question).lastIndexOf(question);

  if (index >= 0) {
    answers.length = index;
  }
}

function isBackAnswer(text: string) {
  const letters = text.normalize("NFKD").replace(/[^\p{L}]/gu, "").toLowerCase();

  return letters === "voltar" || letters === "back";
}

/** Respostas do cliente, em ordem, com a pergunta a que cada uma responde. */
export function extractMenuAnswers(messages: MenuHistoryMessage[]): MenuAnswer[] {
  const answers: MenuAnswer[] = [];
  let pendingStep: string | null = null;

  for (let position = 0; position < messages.length; position += 1) {
    const message = messages[position];

    if (message.direction === "outbound") {
      // Mensagem manual da equipa não tem menu_step e não muda a pergunta pendente.
      if (message.menu_step) {
        pendingStep = message.menu_step;
      }

      continue;
    }

    const text = (message.content ?? "").trim();

    // "[áudio]", "[imagem]"...: mídia que o bot não lê. Não é resposta a nenhuma pergunta.
    if (/^\[[^\]]{1,20}\]$/.test(text) && pendingStep !== "done") {
      continue;
    }

    const confirmStep: ConfirmStep | undefined = pendingStep ? CONFIRM_STEPS[pendingStep] : undefined;

    if (confirmStep) {
      const nextStep = messages.slice(position + 1).find((item) => item.direction === "outbound" && item.menu_step)?.menu_step;

      if (nextStep === confirmStep.askAgain) {
        truncateFrom(answers, confirmStep.question);
      } else if (nextStep === pendingStep && text) {
        truncateFrom(answers, confirmStep.question);
        answers.push({ question: confirmStep.question, answer: text });
      } else if (nextStep === confirmStep.backTo) {
        truncateFrom(answers, confirmStep.backDiscards);
      }

      continue;
    }

    const question = pendingStep ? QUESTION_BY_STEP[pendingStep] : null;

    if (question && text && pendingStep && DISCARDED_BY_BACK[pendingStep] && isBackAnswer(text)) {
      const discarded = DISCARDED_BY_BACK[pendingStep];
      const index = answers.map((item) => item.question).lastIndexOf(discarded);

      if (index >= 0) {
        answers.length = index;
      }
    } else if (question && text) {
      answers.push({ question, answer: displayAnswer(question, text) });
    } else if (pendingStep === "done" && text) {
      answers.push({ question: "Depois do encaminhamento", answer: text });
    }
  }

  return answers;
}

/** Assunto escolhido: pelo caminho do menu; ao voltar ao menu principal, recomeça. */
export function detectMenuTopic(messages: MenuHistoryMessage[]): MenuTopic | null {
  let topic: MenuTopic | null = null;
  let sawInbound = false;

  for (const message of messages) {
    if (message.direction === "inbound") {
      sawInbound = true;
      continue;
    }

    const step = message.menu_step;

    if (!step) continue;

    if (step === "menu") topic = null;
    else if (step.startsWith("awaiting_1")) topic = "support";
    else if (step.startsWith("awaiting_2")) topic = "training";
    else if (step.startsWith("awaiting_3")) topic = "recruitment";
    else if (step === "done" && topic === null && sawInbound) topic = "other";
  }

  return topic;
}

export type MenuProgress = "in_progress" | "handed_off" | "no_menu";

export function detectMenuProgress(messages: MenuHistoryMessage[]): MenuProgress {
  const lastStep = [...messages].reverse().find((message) => message.menu_step)?.menu_step ?? null;

  if (!lastStep) return "no_menu";

  return lastStep === "done" ? "handed_off" : "in_progress";
}

export type ClientStatus = { label: string; tone: "default" | "warning" | "success" };

/** Estado mostrado ao lado do cliente: cruza o ponto do menu com o bot estar ativo ou pausado. */
export function describeClientStatus(progress: MenuProgress, botActive: boolean): ClientStatus {
  if (progress === "handed_off") {
    return { label: "Encaminhado para a equipa", tone: "warning" };
  }

  if (!botActive) {
    return { label: "Em atendimento pela equipa", tone: "warning" };
  }

  return { label: "A responder ao bot", tone: "default" };
}
