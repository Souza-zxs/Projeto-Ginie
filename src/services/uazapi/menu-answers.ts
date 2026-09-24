// Reconstrói as respostas do cliente ao bot de menu a partir do histórico de mensagens.
// Cada mensagem do bot leva `menu_step` (a pergunta que ela faz); a mensagem seguinte do
// cliente é a resposta a essa pergunta. Módulo puro (sem imports do projeto) para testes.

export type MenuHistoryMessage = {
  direction: "inbound" | "outbound";
  content: string | null;
  /** payload->>menu_step da mensagem; só o bot preenche. */
  menu_step: string | null;
  created_at?: string;
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
  awaiting_3_details_retry: "Nome e zona",
  awaiting_3_name: "Nome",
  awaiting_3_name_retry: "Nome",
  awaiting_3_age: "Tem 18 anos ou mais",
  awaiting_3_q1: "Experiência como cuidador(a)",
  awaiting_3_q2: "Autorização para trabalhar em Portugal",
  awaiting_3_q3: "Recibos verdes",
  awaiting_3_q4: "Vive em Lisboa ou Grande Lisboa",
  awaiting_3_p1: "Mais de 1 ano de experiência",
  awaiting_3_p2: "Cuidados a pessoas acamadas",
  awaiting_3_p3: "Formação na área",
  awaiting_3_avail: "Disponibilidade",
  awaiting_3_hours: "Horário pretendido",
  awaiting_3_hours_retry: "Horário pretendido",
  awaiting_3_p4: "Carta de condução ou viatura",
  awaiting_3_p5: "Referências"
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
  back: "← Voltar",
  yes: "Sim",
  no: "Não",
  a1: "Semana",
  a2: "Fim de semana",
  a3: "Semana e fim de semana"
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

  // Perguntas escritas pedem a resposta entre parênteses, ex.: "(Ana Maria Silva)". Ao mostrar, sem eles.
  if (question === "Nome" || question === "Horário pretendido" || question === "Localidade") {
    const inner = key.match(/^\(\s*([^()]+?)\s*\)$/)?.[1];

    if (inner) {
      return inner;
    }
  }

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
  awaiting_3_details_retry: "Experiência ou formação",
  awaiting_3_name: "Opção do menu",
  awaiting_3_name_retry: "Opção do menu",
  awaiting_3_age: "Nome",
  awaiting_3_q1: "Tem 18 anos ou mais",
  awaiting_3_q2: "Experiência como cuidador(a)",
  awaiting_3_q3: "Autorização para trabalhar em Portugal",
  awaiting_3_q4: "Recibos verdes",
  awaiting_3_p1: "Vive em Lisboa ou Grande Lisboa",
  awaiting_3_p2: "Mais de 1 ano de experiência",
  awaiting_3_p3: "Cuidados a pessoas acamadas",
  awaiting_3_avail: "Formação na área",
  awaiting_3_hours: "Disponibilidade",
  awaiting_3_hours_retry: "Disponibilidade",
  awaiting_3_p4: "Horário pretendido",
  awaiting_3_p5: "Carta de condução ou viatura"
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

// Resposta recusada pelo bot (ele repetiu a mesma pergunta por não entender): não conta.
const RETRY_STEP_OF: Record<string, string> = {
  menu: "menu_retry",
  awaiting_1_zone: "awaiting_1_zone_retry",
  awaiting_3_details: "awaiting_3_details_retry",
  awaiting_3_name: "awaiting_3_name_retry",
  awaiting_3_hours: "awaiting_3_hours_retry"
};

function nextBotStep(messages: MenuHistoryMessage[], position: number) {
  return messages.slice(position + 1).find((item) => item.direction === "outbound" && item.menu_step)?.menu_step ?? null;
}

function walkMenu(messages: MenuHistoryMessage[]): { answers: MenuAnswer[]; afterHandoff: number } {
  const answers: MenuAnswer[] = [];
  let afterHandoff = 0;
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

    // Depois de recusada a candidatura: "voltar" desfaz a resposta que a levou à recusa; o resto é ignorado.
    if (pendingStep === "declined") {
      if (text && isBackAnswer(text)) {
        const last = answers[answers.length - 1];

        truncateFrom(
          answers,
          last?.question === "Tem 18 anos ou mais" ? "Tem 18 anos ou mais" : "Vive em Lisboa ou Grande Lisboa"
        );
      }

      continue;
    }

    const confirmStep: ConfirmStep | undefined = pendingStep ? CONFIRM_STEPS[pendingStep] : undefined;

    if (confirmStep) {
      const nextStep = nextBotStep(messages, position);

      if (nextStep === confirmStep.askAgain) {
        truncateFrom(answers, confirmStep.question);
      } else if (nextStep === pendingStep && text) {
        truncateFrom(answers, confirmStep.question);
        answers.push({ question: confirmStep.question, answer: displayAnswer(confirmStep.question, text) });
      } else if (nextStep === confirmStep.backTo) {
        truncateFrom(answers, confirmStep.backDiscards);
      }

      continue;
    }

    const question = pendingStep ? QUESTION_BY_STEP[pendingStep] : null;

    if (question && text && pendingStep && DISCARDED_BY_BACK[pendingStep] && isBackAnswer(text)) {
      truncateFrom(answers, DISCARDED_BY_BACK[pendingStep]);
    } else if (question && text) {
      const retry = pendingStep ? RETRY_STEP_OF[pendingStep] : undefined;
      const next = nextBotStep(messages, position);

      // Se o bot repetiu a mesma pergunta (ou passou para a "nova tentativa"), a resposta foi recusada.
      if (next !== pendingStep && (!retry || next !== retry)) {
        answers.push({ question, answer: displayAnswer(question, text) });
      }
    } else if (pendingStep === "done" && text) {
      afterHandoff += 1;
    }
  }

  return { answers, afterHandoff };
}

/** Respostas do cliente, em ordem, com a pergunta a que cada uma responde. */
export function extractMenuAnswers(messages: MenuHistoryMessage[]): MenuAnswer[] {
  return walkMenu(messages).answers;
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

export type MenuProgress = "in_progress" | "handed_off" | "declined" | "no_menu";

export function detectMenuProgress(messages: MenuHistoryMessage[]): MenuProgress {
  const lastStep = [...messages].reverse().find((message) => message.menu_step)?.menu_step ?? null;

  if (!lastStep) return "no_menu";

  if (lastStep === "declined") return "declined";

  return lastStep === "done" ? "handed_off" : "in_progress";
}

export type ClientStatus = { label: string; tone: "default" | "warning" | "success" | "muted" };

/** Estado mostrado ao lado do cliente: cruza o ponto do menu com o bot estar ativo ou pausado. */
export function describeClientStatus(progress: MenuProgress, botActive: boolean, declineReason?: string | null): ClientStatus {
  if (progress === "declined") {
    return { label: declineReason ? `Não avança: ${declineReason}` : "Não avança", tone: "muted" };
  }

  if (progress === "handed_off") {
    return { label: "Encaminhado para a equipa", tone: "warning" };
  }

  if (!botActive) {
    return { label: "Em atendimento pela equipa", tone: "warning" };
  }

  return { label: "A responder ao bot", tone: "default" };
}

const DECLINE_REASONS: Record<string, string> = {
  "Tem 18 anos ou mais": "menos de 18 anos",
  "Autorização para trabalhar em Portugal": "sem autorização de trabalho",
  "Recibos verdes": "não aceita recibos verdes",
  "Vive em Lisboa ou Grande Lisboa": "fora de Lisboa"
};

function isNoText(text: string) {
  return /^(nao|n|no)(\s|,|$)/.test(text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim());
}

/** Motivos da recusa, lidos das respostas "Não" às eliminatórias. */
function declineReasonOf(progress: MenuProgress, answers: MenuAnswer[]) {
  if (progress !== "declined") {
    return null;
  }

  const reasons = answers.filter((item) => DECLINE_REASONS[item.question] && isNoText(item.answer)).map((item) => DECLINE_REASONS[item.question]);

  return reasons.length ? reasons.join(", ") : null;
}

export type MenuRequest = {
  /** Data da primeira mensagem do pedido. */
  startedAt: string | null;
  topic: MenuTopic | null;
  progress: MenuProgress;
  answers: MenuAnswer[];
  /** Motivo, quando a candidatura foi recusada (ex.: "sem autorização de trabalho"). */
  declineReason: string | null;
  /** Mensagens que a pessoa mandou depois de encaminhada (ex.: "Olá", "Obrigada"). */
  afterHandoff: number;
};

/**
 * Uma pessoa pode passar pelo menu várias vezes (voltou depois de 24h, a equipa reativou o
 * bot...). Cada passagem é um pedido: um novo começa quando o menu reaparece depois de um
 * encaminhamento. Voltar ao menu no meio do fluxo não abre pedido novo.
 */
export function splitMenuRequests(messages: MenuHistoryMessage[]): MenuRequest[] {
  const segments: MenuHistoryMessage[][] = [[]];
  let lastBotStep: string | null = null;

  for (const message of messages) {
    if (message.direction === "outbound" && message.menu_step === "menu" && (lastBotStep === "done" || lastBotStep === "declined")) {
      const current = segments[segments.length - 1];
      let cut = current.length;

      // A mensagem da pessoa que reabriu o menu pertence ao pedido novo, não ao antigo.
      while (cut > 0 && current[cut - 1].direction === "inbound") {
        cut -= 1;
      }

      segments.push(current.splice(cut));
    }

    segments[segments.length - 1].push(message);

    if (message.direction === "outbound" && message.menu_step) {
      lastBotStep = message.menu_step;
    }
  }

  return segments
    .filter((segment) => segment.length)
    .map((segment) => {
      const progress = detectMenuProgress(segment);
      const walked = walkMenu(segment);

      return {
        startedAt: segment.find((message) => message.created_at)?.created_at ?? null,
        topic: detectMenuTopic(segment),
        progress,
        ...walked,
        declineReason: declineReasonOf(progress, walked.answers)
      };
    });
}
