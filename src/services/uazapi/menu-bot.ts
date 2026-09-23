// Bot de menu do WhatsApp (Uazapi): fluxo por opções, sem IA. Módulo puro (sem imports do
// projeto) para ser testável sem o Next. O estado da conversa fica no `payload.menu_step`
// da última mensagem enviada pelo bot, então não precisa de coluna nova no banco.

export type MenuStep = "menu" | "menu_retry" | "awaiting_1" | "awaiting_2" | "awaiting_3" | "awaiting_4" | "done";

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

export const MENU_RETRY_PREFIX = "Desculpe, não consegui perceber a sua resposta.";

export const OPTION_REPLIES: Record<MenuChoice, string> = {
  1: "Obrigada! Para percebermos a melhor resposta, pode indicar-nos a zona onde reside a pessoa a apoiar e que tipo de ajuda procura (higiene, refeições, companhia, medicação, apoio doméstico…)?",
  2: [
    "Obrigada pelo interesse na nossa formação! Estes são os cursos disponíveis:",
    "• Técnico de Geriatria 360º com Estágio Prático: b-learning, 60h online + 120h de estágio",
    "• Animação Sociocultural com Idosos com Estágio Prático: b-learning, 40h online + 20h de prática",
    "• Gestão de ERPI, Centro de Dia e SAD: e-learning síncrono, 60h de aulas ao vivo + 15h de projeto final",
    "• Prevenção do Burnout no Cuidador de Idosos: e-learning assíncrono, 4h",
    "Alguns cursos também têm módulos avulsos. Qual destes lhe interessa?"
  ].join("\n"),
  3: "Obrigada pelo interesse em trabalhar na DAR+! Pode indicar-nos o seu nome, a zona onde reside e se tem experiência ou formação na área?",
  4: "Com certeza. Descreva-nos brevemente o assunto e encaminharemos para a pessoa certa."
};

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
  const steps: MenuStep[] = ["menu", "menu_retry", "awaiting_1", "awaiting_2", "awaiting_3", "awaiting_4", "done"];

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

function closing({ night, choice, recruitmentFormUrl }: { night: boolean; choice: MenuChoice | null; recruitmentFormUrl?: string | null }): MenuDecision {
  const replies: string[] = [];

  if (choice === 3 && recruitmentFormUrl) {
    replies.push(`Obrigada! Para avançar com a sua candidatura, preencha por favor o nosso formulário: ${recruitmentFormUrl}`);
  }

  replies.push(night ? HANDOFF_NIGHT : HANDOFF_DAY);

  return { replies, nextStep: "done", handoff: true };
}

export function decideMenuReply({ lastStep, text, choiceId, night, recruitmentFormUrl }: DecideInput): MenuDecision {
  if (lastStep === "menu" || lastStep === "menu_retry") {
    const choice = (choiceId ? parseMenuChoice(choiceId) : null) ?? parseMenuChoice(text);

    if (choice) {
      return { replies: [OPTION_REPLIES[choice]], nextStep: `awaiting_${choice}` as MenuStep, handoff: false };
    }

    if (lastStep === "menu") {
      return { replies: [`${MENU_RETRY_PREFIX}\n\n${MENU_WELCOME}`], nextStep: "menu_retry", handoff: false, list: menuList(MENU_RETRY_PREFIX) };
    }

    return closing({ night, choice: null });
  }

  if (lastStep && lastStep.startsWith("awaiting_")) {
    const choice = Number(lastStep.slice("awaiting_".length)) as MenuChoice;

    return closing({ night, choice, recruitmentFormUrl });
  }

  return { replies: [MENU_WELCOME], nextStep: "menu", handoff: false, list: menuList() };
}
