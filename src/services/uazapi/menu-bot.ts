// Bot de menu do WhatsApp (Uazapi): fluxo por opções, sem IA. Módulo puro (sem imports do
// projeto) para ser testável sem o Next. O estado da conversa fica no `payload.menu_step`
// da última mensagem enviada pelo bot, então não precisa de coluna nova no banco.

export type MenuStep =
  | "menu"
  | "menu_retry"
  | "awaiting_1"
  | "awaiting_1_type"
  | "awaiting_1_urgency"
  | "awaiting_1_zone"
  | "awaiting_1_zone_retry"
  | "awaiting_1_confirm"
  | "awaiting_2"
  | "awaiting_3"
  | "awaiting_3_details"
  | "awaiting_3_details_retry"
  | "awaiting_3_confirm"
  | "done";

export type MenuChoice = 1 | 2 | 3 | 4;

export type MenuDecision = {
  replies: string[];
  nextStep: MenuStep;
  /** true: a conversa passa para a equipa (IA/bot desligados; aparece no Inbox). */
  handoff: boolean;
  /** Presente quando a resposta é o menu: enviar como lista clicável (replies fica de reserva em texto). */
  list?: MenuList;
};

export type MenuList = { text: string; listButton: string; choices: string[] };

export const MENU_WELCOME = [
  "Olá! 👋 Obrigada pelo seu contacto e seja bem-vindo(a) à DAR+.",
  "Para podermos ajudar da melhor forma, indique por favor o número da opção que pretende:",
  "1️⃣ Procuro apoio domiciliário, para mim ou para um familiar",
  "2️⃣ Procuro formação, com cursos e formação profissional na área da geriatria",
  "3️⃣ Quero candidatar-me, para trabalhar connosco",
  "4️⃣ Outro assunto",
  "Basta responder com o número (1, 2, 3 ou 4). 😊"
].join("\n");

const MENU_LIST_INTRO =
  "Olá! 👋 Obrigada pelo seu contacto e seja bem-vindo(a) à DAR+.\nPara podermos ajudar da melhor forma, toque no botão e escolha a opção que pretende:";

const MENU_LIST_CHOICES = [
  "Apoio domiciliário|1|Para mim ou para um familiar",
  "Formação|2|Cursos e formação profissional em geriatria",
  "Candidatura|3|Quero trabalhar na DAR+",
  "Outro assunto|4"
];

function menuList(prefix?: string): MenuList {
  return {
    text: prefix ? `${prefix}\n\n${MENU_LIST_INTRO}` : MENU_LIST_INTRO,
    listButton: "Ver opções",
    choices: MENU_LIST_CHOICES
  };
}

// Título de linha do WhatsApp aceita só 24 caracteres; o detalhe vai na descrição.
const COURSES: Array<{ id: string; name: string; description: string }> = [
  { id: "c1", name: "Técnico de Geriatria", description: "360º com Estágio · b-learning · 60h + 120h de estágio" },
  { id: "c2", name: "Animação Sociocultural", description: "Com Idosos e Estágio · b-learning · 40h + 20h de prática" },
  { id: "c3", name: "Gestão de ERPI, CD e SAD", description: "Gestão de ERPI, Centro de Dia e SAD · síncrono · 60h + 15h" },
  { id: "c4", name: "Prevenção do Burnout", description: "No Cuidador de Idosos · assíncrono · 4h" },
  { id: "c5", name: "Módulos avulsos", description: "Módulos soltos de alguns dos cursos" }
];

const OTHER_ROW = "Outro|other|Falar com a nossa equipa";
const BACK_ROW = "← Voltar|back|Corrigir a resposta anterior";
const BACK_TO_MENU_ROW = "← Voltar|back|Voltar ao menu principal";
const BACK_HINT = "Se se enganou, escolha “← Voltar”.";

const COURSE_LIST: MenuList = {
  text: `Obrigada pelo interesse na nossa formação! Toque no botão e escolha o curso que lhe interessa.\n${BACK_HINT}`,
  listButton: "Ver cursos",
  choices: [...COURSES.map((course) => `${course.name}|${course.id}|${course.description}`), OTHER_ROW, BACK_TO_MENU_ROW]
};

const WHO_LIST: MenuList = {
  text: `Obrigada! O apoio domiciliário é para quem? Toque no botão e escolha.\n${BACK_HINT}`,
  listButton: "Ver opções",
  choices: [
    "Para mim|w1|Sou eu quem precisa de apoio",
    "Pai ou mãe|w2|Apoio a um dos meus pais",
    "Outro familiar|w3|Avós, tios, cônjuge, irmãos…",
    "Amigo ou conhecido|w4|Apoio a alguém próximo",
    OTHER_ROW,
    BACK_TO_MENU_ROW
  ]
};

const HELP_TEXT =
  "E que tipo de apoio procura (higiene pessoal, refeições, companhia, medicação, apoio doméstico, vários serviços ou outro)? Para corrigir a resposta anterior, escreva 'voltar'.";

const HELP_LIST: MenuList = {
  text: `E que tipo de apoio procura? Toque no botão e escolha a opção mais próxima.\n${BACK_HINT}`,
  listButton: "Ver apoios",
  choices: [
    "Higiene pessoal|h1|Banho, vestir e cuidados de conforto",
    "Refeições|h2|Preparar e apoiar nas refeições",
    "Companhia|h3|Acompanhamento e conversa",
    "Medicação|h4|Apoio na toma da medicação",
    "Apoio doméstico|h5|Limpezas e tarefas da casa",
    "Vários serviços|h6|Mais do que um tipo de apoio",
    OTHER_ROW,
    BACK_ROW
  ]
};

const URGENCY_TEXT =
  "E para quando precisa do apoio (o quanto antes, nas próximas semanas ou só para se informar)? Para corrigir a resposta anterior, escreva 'voltar'.";

const URGENCY_LIST: MenuList = {
  text: `E para quando precisa do apoio? Toque no botão e escolha.\n${BACK_HINT}`,
  listButton: "Ver opções",
  choices: [
    "O quanto antes|u1|Preciso de apoio com urgência",
    "Próximas semanas|u2|Nas próximas semanas",
    "Só a informar-me|u3|Ainda estou a avaliar",
    OTHER_ROW,
    BACK_ROW
  ]
};

const EXPERIENCE_LIST: MenuList = {
  text: `Obrigada pelo interesse em trabalhar na DAR+! Tem experiência ou formação na área? Toque no botão e escolha.\n${BACK_HINT}`,
  listButton: "Ver opções",
  choices: [
    "Tenho experiência|e1|Já trabalhei na área",
    "Tenho formação|e2|Curso ou formação na área",
    "Experiência e formação|e3|Tenho as duas",
    "Ainda sem experiência|e4|Quero começar na área",
    OTHER_ROW,
    BACK_TO_MENU_ROW
  ]
};

const ASK_ZONE = "Por fim, em que localidade reside a pessoa a apoiar? Para corrigir a resposta anterior, escreva 'voltar'.";
const ASK_ZONE_AGAIN = "Não consegui perceber a localidade. Pode escrever o nome da localidade (por exemplo, a cidade ou a freguesia)?";
const ASK_CANDIDATE_DETAILS = "Pode indicar-nos o seu nome e a zona onde reside? Para corrigir a resposta anterior, escreva 'voltar'.";
const ASK_CANDIDATE_DETAILS_AGAIN = "Não consegui perceber. Pode escrever o seu nome e a zona onde reside?";

/** Resposta de texto livre válida: pelo menos duas letras seguidas (emoji, números ou pontuação não servem). */
function hasWords(text: string) {
  return /\p{L}{2,}/u.test(text);
}

function normalizeWord(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.!?\s]+$/g, "")
    .trim();
}

/** "Outro" tocado na lista (id "other") ou digitado; leva direto para o atendimento manual. */
function isOther(choiceId: string | null | undefined, text: string) {
  return choiceId === "other" || /^outr[oa]s?$/.test(normalizeWord(text));
}

/** "← Voltar" tocado na lista (id "back") ou "voltar" digitado. */
function isBack(choiceId: string | null | undefined, text: string) {
  return choiceId === "back" || normalizeWord(text) === "voltar";
}

const CONFIRM_ROWS = ["Sim, está certo|yes|Enviar para a equipa", "Corrigir|fix|Escrever de novo", BACK_ROW];

function shorten(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();

  return clean.length > 200 ? `${clean.slice(0, 197)}…` : clean;
}

/** Pede para confirmar o texto livre da última pergunta antes de encaminhar para a equipa. */
function confirmation(step: "awaiting_1_confirm" | "awaiting_3_confirm", answer: string): MenuDecision {
  const question =
    step === "awaiting_1_confirm"
      ? `Confirma que a localidade é «${shorten(answer)}»?`
      : `Confirma o seu nome e zona: «${shorten(answer)}»?`;

  return {
    replies: [`${question} Responda 'sim' para confirmar ou 'corrigir' para escrever de novo.`],
    nextStep: step,
    handoff: false,
    list: {
      text: `${question}\nSe estiver errado, escolha “Corrigir”.`,
      listButton: "Ver opções",
      choices: CONFIRM_ROWS
    }
  };
}

const YES_WORDS = new Set(["sim", "confirmo", "sim confirmo", "certo", "correto", "esta certo", "esta correto", "ok", "isso", "exato"]);

/** "Sim, está certo" tocado (id "yes") ou dito por extenso. */
function isYes(choiceId: string | null | undefined, text: string) {
  return choiceId === "yes" || YES_WORDS.has(normalizeWord(text).replace(/[,]/g, ""));
}

/** "Corrigir" tocado (id "fix") ou dito: "corrigir", "não", "errado"... */
function isFix(choiceId: string | null | undefined, text: string) {
  return choiceId === "fix" || /^(nao|corrigir|errad)/.test(normalizeWord(text));
}

function courseNameFromChoice(choiceId?: string | null) {
  return COURSES.find((course) => course.id === choiceId)?.name ?? null;
}

export const MENU_RETRY_PREFIX = "Desculpe, não consegui perceber a sua resposta.";

export const OPTION_REPLIES: Record<1 | 2 | 3, string> = {
  1: "Obrigada! O apoio domiciliário é para quem (para si, pai ou mãe, outro familiar, amigo, conhecido ou outro)? Se se enganou, escreva 'voltar'.",
  2: [
    "Obrigada pelo interesse na nossa formação! Estes são os cursos disponíveis:",
    "• Técnico de Geriatria 360º com Estágio Prático: b-learning, 60h online + 120h de estágio",
    "• Animação Sociocultural com Idosos com Estágio Prático: b-learning, 40h online + 20h de prática",
    "• Gestão de ERPI, Centro de Dia e SAD: e-learning síncrono, 60h de aulas ao vivo + 15h de projeto final",
    "• Prevenção do Burnout no Cuidador de Idosos: e-learning assíncrono, 4h",
    "Alguns cursos também têm módulos avulsos. Qual destes lhe interessa (ou escreva 'outro')? Se se enganou, escreva 'voltar'."
  ].join("\n"),
  3: "Obrigada pelo interesse em trabalhar na DAR+! Tem experiência ou formação na área (ou escreva 'outro')? Se se enganou, escreva 'voltar'."
};

const OPTION_LISTS: Record<1 | 2 | 3, MenuList> = { 1: WHO_LIST, 2: COURSE_LIST, 3: EXPERIENCE_LIST };

/** Todas as linhas ("rótulo|id|descrição") das listas, para conferir o mapa de rótulos das respostas. */
export const MENU_CHOICE_ROWS = [
  ...MENU_LIST_CHOICES,
  ...WHO_LIST.choices,
  ...HELP_LIST.choices,
  ...URGENCY_LIST.choices,
  ...COURSE_LIST.choices,
  ...EXPERIENCE_LIST.choices
];

export const HANDOFF_DAY = "Obrigada! Já passámos o seu pedido a um membro da nossa equipa, que dará seguimento assim que possível.";
export const HANDOFF_NIGHT = "Recebemos o seu contacto. Será contactado por um membro da nossa equipa logo que possível.";

/** "1", "1️⃣", "opção 1", "a 2", "nº 3", "número 4." → número; qualquer outra coisa → null. */
export function parseMenuChoice(text: string): MenuChoice | null {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[̀-ͯ️⃣]/g, "")
    .toLowerCase()
    .replace(/[.!?)\s]+$/g, "")
    .trim();
  const match = cleaned.match(/^(?:(?:a|o)\s+)?(?:(?:opcao|numero|no|n)\s*)?([1-4])$/);

  return match ? (Number(match[1]) as MenuChoice) : null;
}

export function readMenuStep(value: unknown): MenuStep | null {
  const steps: MenuStep[] = ["menu", "menu_retry", "awaiting_1", "awaiting_1_type", "awaiting_1_urgency", "awaiting_1_zone", "awaiting_1_zone_retry", "awaiting_1_confirm", "awaiting_2", "awaiting_3", "awaiting_3_details", "awaiting_3_details_retry", "awaiting_3_confirm", "done"];

  return typeof value === "string" && (steps as string[]).includes(value) ? (value as MenuStep) : null;
}

type DecideInput = {
  /** ID do item tocado na lista (ex.: "2"); tem prioridade sobre o texto. */
  choiceId?: string | null;
  /** menu_step da última mensagem enviada pelo bot nesta conversa (null = nunca houve). */
  lastStep: MenuStep | null;
  text: string;
  night: boolean;
  /** Link do formulário de recrutamento; sem ele, a opção 3 só encaminha para a equipa. */
  recruitmentFormUrl?: string | null;
};

function closing({
  night,
  choice,
  recruitmentFormUrl,
  courseName
}: {
  night: boolean;
  choice: MenuChoice | null;
  recruitmentFormUrl?: string | null;
  courseName?: string | null;
}): MenuDecision {
  const replies: string[] = [];

  if (choice === 2 && courseName) {
    replies.push(`Obrigada pelo interesse em ${courseName}!`);
  }

  if (choice === 3 && recruitmentFormUrl) {
    replies.push(`Obrigada! Para avançar com a sua candidatura, preencha por favor o nosso formulário: ${recruitmentFormUrl}`);
  }

  replies.push(night ? HANDOFF_NIGHT : HANDOFF_DAY);

  return { replies, nextStep: "done", handoff: true };
}

/** Volta uma pergunta: a etapa anterior é repetida (ou o menu principal, se era a primeira). */
function goBack(step: MenuStep | null): MenuDecision | null {
  switch (step) {
    case "awaiting_1":
    case "awaiting_2":
    case "awaiting_3":
      return { replies: [MENU_WELCOME], nextStep: "menu", handoff: false, list: menuList() };
    case "awaiting_1_type":
      return { replies: [OPTION_REPLIES[1]], nextStep: "awaiting_1", handoff: false, list: WHO_LIST };
    case "awaiting_1_urgency":
      return { replies: [HELP_TEXT], nextStep: "awaiting_1_type", handoff: false, list: HELP_LIST };
    case "awaiting_1_zone":
    case "awaiting_1_zone_retry":
    case "awaiting_1_confirm":
      return { replies: [URGENCY_TEXT], nextStep: "awaiting_1_urgency", handoff: false, list: URGENCY_LIST };
    case "awaiting_3_details":
    case "awaiting_3_details_retry":
    case "awaiting_3_confirm":
      return { replies: [OPTION_REPLIES[3]], nextStep: "awaiting_3", handoff: false, list: EXPERIENCE_LIST };
    default:
      return null;
  }
}

export function decideMenuReply({ lastStep, text, choiceId, night, recruitmentFormUrl }: DecideInput): MenuDecision {
  if (lastStep === "menu" || lastStep === "menu_retry") {
    const choice = (choiceId ? parseMenuChoice(choiceId) : null) ?? parseMenuChoice(text);

    if (choice === 4) {
      return closing({ night, choice });
    }

    if (choice) {
      return {
        replies: [OPTION_REPLIES[choice]],
        nextStep: `awaiting_${choice}` as MenuStep,
        handoff: false,
        list: OPTION_LISTS[choice]
      };
    }

    if (lastStep === "menu") {
      return { replies: [`${MENU_RETRY_PREFIX}\n\n${MENU_WELCOME}`], nextStep: "menu_retry", handoff: false, list: menuList(MENU_RETRY_PREFIX) };
    }

    return closing({ night, choice: null });
  }

  if (isBack(choiceId, text)) {
    const back = goBack(lastStep);

    if (back) {
      return back;
    }
  }

  const other = isOther(choiceId, text);

  switch (lastStep) {
    case "awaiting_1":
      return other ? closing({ night, choice: null }) : { replies: [HELP_TEXT], nextStep: "awaiting_1_type", handoff: false, list: HELP_LIST };
    case "awaiting_1_type":
      return other ? closing({ night, choice: null }) : { replies: [URGENCY_TEXT], nextStep: "awaiting_1_urgency", handoff: false, list: URGENCY_LIST };
    case "awaiting_1_urgency":
      return other ? closing({ night, choice: null }) : { replies: [ASK_ZONE], nextStep: "awaiting_1_zone", handoff: false };
    case "awaiting_1_zone":
      return hasWords(text)
        ? confirmation("awaiting_1_confirm", text)
        : { replies: [ASK_ZONE_AGAIN], nextStep: "awaiting_1_zone_retry", handoff: false };
    case "awaiting_1_zone_retry":
      return hasWords(text) ? confirmation("awaiting_1_confirm", text) : closing({ night, choice: 1 });
    case "awaiting_1_confirm":
      if (isYes(choiceId, text)) {
        return closing({ night, choice: 1 });
      }

      if (isFix(choiceId, text)) {
        return { replies: [ASK_ZONE], nextStep: "awaiting_1_zone", handoff: false };
      }

      // Escreveu outra localidade em vez de tocar: confirma a nova.
      return hasWords(text)
        ? confirmation("awaiting_1_confirm", text)
        : { replies: [ASK_ZONE_AGAIN], nextStep: "awaiting_1_zone", handoff: false };
    case "awaiting_2":
      return closing({ night, choice: 2, courseName: other ? null : courseNameFromChoice(choiceId) });
    case "awaiting_3":
      return other ? closing({ night, choice: null }) : { replies: [ASK_CANDIDATE_DETAILS], nextStep: "awaiting_3_details", handoff: false };
    case "awaiting_3_details":
      return hasWords(text)
        ? confirmation("awaiting_3_confirm", text)
        : { replies: [ASK_CANDIDATE_DETAILS_AGAIN], nextStep: "awaiting_3_details_retry", handoff: false };
    case "awaiting_3_details_retry":
      return hasWords(text) ? confirmation("awaiting_3_confirm", text) : closing({ night, choice: 3, recruitmentFormUrl });
    case "awaiting_3_confirm":
      if (isYes(choiceId, text)) {
        return closing({ night, choice: 3, recruitmentFormUrl });
      }

      if (isFix(choiceId, text)) {
        return { replies: [ASK_CANDIDATE_DETAILS], nextStep: "awaiting_3_details", handoff: false };
      }

      return hasWords(text)
        ? confirmation("awaiting_3_confirm", text)
        : { replies: [ASK_CANDIDATE_DETAILS_AGAIN], nextStep: "awaiting_3_details", handoff: false };
    default:
      return { replies: [MENU_WELCOME], nextStep: "menu", handoff: false, list: menuList() };
  }
}
