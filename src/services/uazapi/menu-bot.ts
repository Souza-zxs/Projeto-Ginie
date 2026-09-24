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
  | "awaiting_3_name"
  | "awaiting_3_name_retry"
  | "awaiting_3_age"
  | "awaiting_3_q1"
  | "awaiting_3_q2"
  | "awaiting_3_q3"
  | "awaiting_3_q4"
  | "awaiting_3_p1"
  | "awaiting_3_p2"
  | "awaiting_3_p3"
  | "awaiting_3_avail"
  | "awaiting_3_hours"
  | "awaiting_3_hours_retry"
  | "awaiting_3_p4"
  | "awaiting_3_p5"
  | "declined"
  | "done";

/** Perguntas eliminatórias da candidatura: o "Não" é guardado e só avaliado depois da quarta. */
export type CandidacyKey = "age" | "q1" | "q2" | "q3" | "q4";

export type MenuChoice = 1 | 2 | 3 | 4;

export type MenuDecision = {
  replies: string[];
  nextStep: MenuStep;
  /** true: a conversa passa para a equipa (IA/bot desligados; aparece no Inbox). */
  handoff: boolean;
  /** Presente quando a resposta é o menu: enviar como lista clicável (replies fica de reserva em texto). */
  list?: MenuList;
  /** true: o bot recusou uma mídia (áudio, imagem...) e pediu texto/opção; a próxima mídia encaminha. */
  mediaRetry?: boolean;
  /** Eliminatórias da candidatura respondidas "Não" até agora; vai no payload e volta na próxima resposta. */
  candidacyFails?: CandidacyKey[];
  /** Saudação ou conversa de cortesia ("Boa tarde", "Tudo bem"): não conta como resposta errada. */
  smallTalk?: boolean;
  /** O bot desistiu por não entender (não foi a pessoa que pediu a equipa): um toque no menu retoma o fluxo. */
  gaveUp?: boolean;
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

/** Link do formulário de recrutamento (pode ser trocado por RECRUITMENT_FORM_URL no ambiente). */
export const DEFAULT_RECRUITMENT_FORM_URL = "https://recrutamento.darmais.pt/";

const YES_NO_ROWS = ["Sim|yes", "Não|no"];
const AVAIL_ROWS = [
  "Semana|a1|Segunda a sexta",
  "Fim de semana|a2|Sábado e domingo",
  "Semana e fim de semana|a3|Todos os dias"
];

type CandidacyItem = {
  step: MenuStep;
  /** Rótulo da resposta em Clientes e no Inbox (menu-answers.ts usa o mesmo texto). */
  label: string;
  kind: "text" | "yesno" | "avail";
  question: string;
  /** Só nas eliminatórias. */
  key?: CandidacyKey;
  /** Só nas perguntas escritas: como a pessoa deve responder, com exemplo. */
  format?: { pattern: string; example: string };
};

/** A candidatura, na ordem: nome, idade, 4 eliminatórias, 6 perguntas de perfil (não eliminam). */
export const CANDIDACY: CandidacyItem[] = [
  {
    step: "awaiting_3_name",
    label: "Nome",
    kind: "text",
    question: "Qual é o seu nome completo?",
    format: { pattern: "(nome completo)", example: "(Ana Maria Silva)" }
  },
  { step: "awaiting_3_age", label: "Tem 18 anos ou mais", kind: "yesno", question: "Tem 18 anos ou mais?", key: "age" },
  { step: "awaiting_3_q1", label: "Experiência como cuidador(a)", kind: "yesno", question: "Tem experiência como cuidador(a) de idosos?", key: "q1" },
  {
    step: "awaiting_3_q2",
    label: "Autorização para trabalhar em Portugal",
    kind: "yesno",
    question: "Tem autorização para trabalhar em Portugal (legalizado/a ou com processo em curso)?",
    key: "q2"
  },
  {
    step: "awaiting_3_q3",
    label: "Recibos verdes",
    kind: "yesno",
    question: "Pode trabalhar com contrato de prestação de serviços (recibos verdes)?",
    key: "q3"
  },
  {
    step: "awaiting_3_q4",
    label: "Vive em Lisboa ou Grande Lisboa",
    kind: "yesno",
    question: "Vive em Lisboa ou Grande Lisboa, ou consegue deslocar-se até lá?",
    key: "q4"
  },
  { step: "awaiting_3_p1", label: "Mais de 1 ano de experiência", kind: "yesno", question: "Tem mais de 1 ano de experiência com idosos?" },
  {
    step: "awaiting_3_p2",
    label: "Cuidados a pessoas acamadas",
    kind: "yesno",
    question: "Já prestou cuidados de higiene e posicionamentos a pessoas acamadas?"
  },
  {
    step: "awaiting_3_p3",
    label: "Formação na área",
    kind: "yesno",
    question: "Tem formação na área (Geriatria, Auxiliar de Saúde, Cuidador)?"
  },
  { step: "awaiting_3_avail", label: "Disponibilidade", kind: "avail", question: "Qual é a sua disponibilidade?" },
  {
    step: "awaiting_3_hours",
    label: "Horário pretendido",
    kind: "text",
    question: "E que horário pretende?",
    format: { pattern: "(horário pretendido)", example: "(manhãs, das 9h às 13h)" }
  },
  { step: "awaiting_3_p4", label: "Carta de condução ou viatura", kind: "yesno", question: "Tem carta de condução ou viatura própria?" },
  {
    step: "awaiting_3_p5",
    label: "Referências",
    kind: "yesno",
    question: "Tem referências de trabalhos anteriores que possamos contactar?"
  }
];

const LAST_ELIMINATORY_INDEX = 5;
const AGE_INDEX = 1;

const CANDIDACY_INTRO = "Obrigada pelo interesse em trabalhar na DAR+!";
const PASSED_INTRO =
  "Obrigada! Passou à próxima etapa. Faltam só algumas perguntas rápidas para conhecermos melhor o seu perfil.";
const UNCLEAR_PREFIX = "Desculpe, não consegui perceber a sua resposta.";

function formatHint(item: CandidacyItem) {
  return item.format ? `Responda neste formato: ${item.format.pattern}. Exemplo: ${item.format.example}.` : "";
}

function textAgain(item: CandidacyItem) {
  return item.format
    ? `Não consegui perceber. Escreva neste formato: ${item.format.pattern}. Exemplo: ${item.format.example}.`
    : "Não consegui perceber. Pode escrever de novo, por favor?";
}

const REQUIREMENT_TEXT: Record<"q2" | "q3" | "q4", string> = {
  q2: "ter autorização para trabalhar em Portugal (legalizado/a ou com processo em curso)",
  q3: "poder trabalhar em prestação de serviços (recibos verdes)",
  q4: "viver em Lisboa ou Grande Lisboa, ou poder deslocar-se até lá"
};

const DECLINE_AGE =
  "Obrigada pelo interesse na DAR+. Para trabalhar connosco é necessário ter 18 anos ou mais, por isso, de momento, não podemos dar seguimento à candidatura. Se respondeu por engano, escreva 'voltar' para corrigir a resposta.";
const DECLINED_HINT = "Se respondeu por engano, escreva 'voltar' para corrigir a resposta. Para recomeçar, escreva 'menu'.";
const ACADEMY_MESSAGE =
  "Obrigada pela sua sinceridade! Para trabalhar como cuidador(a) connosco é preciso alguma experiência, mas pode adquiri-la: a DAR+ Academia tem formação com estágio prático, pensada para quem quer começar nesta área. Pode ser o primeiro passo! 💚";

function candidacyIndexOf(step: MenuStep | null) {
  return CANDIDACY.findIndex((item) => item.step === step || `${item.step}_retry` === step);
}

function sanitizeFails(value: unknown): CandidacyKey[] {
  const valid: string[] = ["age", "q1", "q2", "q3", "q4"];

  return Array.isArray(value) ? (value.filter((item) => typeof item === "string" && valid.includes(item)) as CandidacyKey[]) : [];
}

function candidacyPrompt(index: number): { text: string; list?: MenuList } {
  const item = CANDIDACY[index];

  if (item.kind === "text") {
    return { text: `${item.question} ${formatHint(item)} Para corrigir a resposta anterior, escreva 'voltar'.`.replace("  ", " ") };
  }

  if (item.kind === "avail") {
    return {
      text: `${item.question} Responda 'semana', 'fim de semana' ou 'semana e fim de semana' (ou 'voltar' para corrigir a resposta anterior).`,
      list: {
        text: `${item.question} Toque no botão e escolha.\n${BACK_HINT}`,
        listButton: "Escolher",
        choices: [...AVAIL_ROWS, OTHER_ROW, BACK_ROW]
      }
    };
  }

  return {
    text: `${item.question} Responda 'sim' ou 'não' (ou 'voltar' para corrigir a resposta anterior).`,
    list: {
      text: `${item.question}\n${BACK_HINT}`,
      listButton: "Responder",
      choices: [...YES_NO_ROWS, OTHER_ROW, BACK_ROW]
    }
  };
}

function askCandidacy(index: number, fails: CandidacyKey[], intro?: string): MenuDecision {
  const prompt = candidacyPrompt(index);

  return {
    replies: [intro ? `${intro} ${prompt.text}` : prompt.text],
    nextStep: CANDIDACY[index].step,
    handoff: false,
    candidacyFails: fails,
    ...(prompt.list ? { list: { ...prompt.list, text: intro ? `${intro}\n${prompt.list.text}` : prompt.list.text } } : {})
  };
}

/** "Sim" tocado (id "yes") ou dito; "Não" idem. Outra coisa: null (não deu para entender). */
function yesNoAnswer(choiceId: string | null | undefined, text: string): "yes" | "no" | null {
  if (choiceId === "yes") return "yes";
  if (choiceId === "no") return "no";

  const word = normalizeWord(text);

  if (/^(nao|n|no)(\s|,|$)/.test(word)) return "no";
  if (/^(sim|s|claro|tenho|posso|vivo|consigo|yes|ok)(\s|,|$)/.test(word)) return "yes";

  return null;
}

/** Disponibilidade: id da lista (a1, a2, a3) ou texto livre reconhecível. */
function availAnswer(choiceId: string | null | undefined, text: string): "a1" | "a2" | "a3" | null {
  if (choiceId === "a1" || choiceId === "a2" || choiceId === "a3") return choiceId;

  const word = normalizeWord(text);

  if (/(semana e fim|ambos|todos os dias|qualquer)/.test(word)) return "a3";
  if (/(fim de semana|sabado|domingo)/.test(word)) return "a2";
  if (/(semana|segunda|sexta|dias uteis)/.test(word)) return "a1";

  return null;
}

/** Recusa: só depois da última eliminatória (a idade é a exceção: encerra logo, não se recolhem dados de menores). */
function declineDecision(failed: Array<"age" | "q2" | "q3" | "q4">, fails: CandidacyKey[]): MenuDecision {
  const text = failed.includes("age")
    ? DECLINE_AGE
    : `Obrigada pelo interesse na DAR+ e por ter respondido às nossas perguntas. De momento não podemos dar seguimento à sua candidatura, porque é necessário ${failed
        .filter((key): key is "q2" | "q3" | "q4" => key !== "age")
        .map((key) => REQUIREMENT_TEXT[key])
        .join("; ")}. Se respondeu por engano, escreva 'voltar' para corrigir a resposta. Desejamos-lhe muito sucesso!`;

  return { replies: [text], nextStep: "declined", handoff: false, candidacyFails: fails };
}

/** Sem experiência (e nada mais a impedir): redireciona para o menu de formação da DAR+ Academia. */
function academyDecision(): MenuDecision {
  return {
    replies: [`${ACADEMY_MESSAGE}\n\n${OPTION_REPLIES[2]}`],
    nextStep: "awaiting_2",
    handoff: false,
    list: { ...COURSE_LIST, text: `${ACADEMY_MESSAGE}\n${COURSE_LIST.text}` }
  };
}

function advanceCandidacy(index: number, fails: CandidacyKey[], night: boolean, recruitmentFormUrl?: string | null): MenuDecision {
  if (index === LAST_ELIMINATORY_INDEX) {
    const hard = fails.filter((key): key is "q2" | "q3" | "q4" => key === "q2" || key === "q3" || key === "q4");

    if (hard.length) return declineDecision(hard, fails);
    if (fails.includes("q1")) return academyDecision();

    return askCandidacy(index + 1, fails, PASSED_INTRO);
  }

  if (index === CANDIDACY.length - 1) {
    return closing({ night, choice: 3, recruitmentFormUrl });
  }

  return askCandidacy(index + 1, fails);
}

function decideCandidacy({
  index,
  lastStep,
  text,
  choiceId,
  other,
  mediaRetry,
  fails,
  night,
  recruitmentFormUrl
}: {
  index: number;
  lastStep: MenuStep;
  text: string;
  choiceId?: string | null;
  other: boolean;
  mediaRetry: boolean;
  fails: CandidacyKey[];
  night: boolean;
  recruitmentFormUrl?: string | null;
}): MenuDecision {
  const item = CANDIDACY[index];

  if (item.kind === "text") {
    if (hasWords(text)) {
      return advanceCandidacy(index, fails, night, recruitmentFormUrl);
    }

    if (lastStep.endsWith("_retry")) {
      return closing({ night, choice: null, gaveUp: true });
    }

    return { replies: [textAgain(item)], nextStep: `${item.step}_retry` as MenuStep, handoff: false, candidacyFails: fails };
  }

  if (other) {
    return closing({ night, choice: null });
  }

  const answer = item.kind === "avail" ? availAnswer(choiceId, text) : yesNoAnswer(choiceId, text);

  if (!answer) {
    if (mediaRetry) {
      return closing({ night, choice: null, gaveUp: true });
    }

    const prompt = candidacyPrompt(index);

    return {
      replies: [`${UNCLEAR_PREFIX} ${prompt.text}`],
      nextStep: item.step,
      handoff: false,
      mediaRetry: true,
      candidacyFails: fails,
      ...(prompt.list ? { list: { ...prompt.list, text: `${UNCLEAR_PREFIX}\n${prompt.list.text}` } } : {})
    };
  }

  if (answer === "no" && item.key) {
    // Idade: encerra já. As demais eliminatórias só são avaliadas depois da quarta.
    if (item.key === "age") {
      return declineDecision(["age"], [...fails, "age"]);
    }

    return advanceCandidacy(index, [...fails, item.key], night, recruitmentFormUrl);
  }

  return advanceCandidacy(index, fails, night, recruitmentFormUrl);
}

const ZONE_FORMAT = "Responda neste formato: (bairro ou freguesia, cidade). Exemplo: (Benfica, Lisboa).";
const ASK_ZONE = `Por fim, em que localidade reside a pessoa a apoiar? ${ZONE_FORMAT} Para corrigir a resposta anterior, escreva 'voltar'.`;
const ASK_ZONE_AGAIN = "Não consegui perceber a localidade. Escreva neste formato: (bairro ou freguesia, cidade). Exemplo: (Benfica, Lisboa).";

/** Resposta de texto livre válida: pelo menos duas letras seguidas (emoji, números ou pontuação não servem). */
function hasWords(text: string) {
  return /\p{L}{2,}/u.test(text);
}

const SMALL_TALK_WORDS = new Set([
  "ola", "oi", "hey", "hello", "hi", "boa", "bom", "bons", "dia", "dias", "tarde", "noite", "tudo", "bem", "bm", "td",
  "e", "ai", "como", "esta", "estas", "vai", "voce", "obrigada", "obrigado", "ok", "okay", "por", "favor", "prazer",
  "saudacoes", "boas"
]);

/** Só saudação/cortesia, sem pedido nenhum ("Olá", "Boa tarde", "Tudo bem?", "Olá, bom dia"). */
export function isSmallTalk(text: string) {
  const tokens = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/\p{L}+/gu);

  return Boolean(tokens && tokens.length <= 6 && tokens.every((token) => SMALL_TALK_WORDS.has(token)));
}

export type MenuIntent = 1 | 2 | 3;

const TRAINING_WORDS = new Set([
  "curso", "cursos", "formacao", "formacoes", "formar", "academia", "modulo", "modulos", "aula", "aulas", "geriatria"
]);
// "trabalho"/"trabalhar" sozinhos são ambíguos (colaboradoras falam do trabalho delas): só valem
// com um verbo de querer ("quero trabalhar", "procuro trabalho") ou "trabalhar convosco".
const RECRUITMENT_WORDS = new Set([
  "emprego", "vaga", "vagas", "recrutamento", "curriculo", "cv", "oportunidade", "oportunidades", "contratar", "contratam", "contratacao"
]);
const WORK_WORDS = new Set(["trabalhar", "trabalho"]);
const WANT_WORDS = new Set(["quero", "queria", "gostava", "gostaria", "procuro", "preciso", "busco", "interessada", "interessado", "disponivel"]);
// Parentes ("mãe", "pai") sozinhos não bastam: podem ser uma desculpa a explicar uma falta.
const SUPPORT_WORDS = new Set(["apoio", "cuidar", "cuidados"]);

/**
 * O que a pessoa escreveu em vez de tocar no menu, quando dá para saber com segurança:
 * 1 apoio domiciliário, 2 formação, 3 candidatura. Se as palavras apontam para mais de um
 * assunto (ex.: "apoio para a minha mãe fazer um curso"), não adivinha: devolve null.
 * Quem procura trabalho e menciona "apoio domiciliário" ganha como candidatura.
 */
export function detectMenuIntent(text: string): MenuIntent | null {
  const tokens =
    text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/\p{L}+/gu) ?? [];

  const training = tokens.some((token) => TRAINING_WORDS.has(token) || token.startsWith("inscri") || token.startsWith("certificad"));
  const recruitment =
    tokens.some((token) => RECRUITMENT_WORDS.has(token) || token.startsWith("candidat")) ||
    (tokens.some((token) => WORK_WORDS.has(token)) && tokens.some((token) => WANT_WORDS.has(token) || token === "convosco" || token === "connosco"));
  const support = tokens.some(
    (token) => SUPPORT_WORDS.has(token) || token.startsWith("domicili") || token.startsWith("idos") || token.startsWith("acamad")
  );

  if (recruitment && training) return null;
  if (recruitment) return 3;
  if (training && support) return null;
  if (training) return 2;
  if (support) return 1;

  return null;
}

const INTENT_ACK: Record<MenuIntent, string> = {
  1: "Percebi que procura apoio domiciliário.",
  2: "Percebi que procura formação.",
  3: "Percebi que quer trabalhar connosco."
};

/** Segue direto para a opção que a pessoa descreveu; "voltar" leva ao menu se o bot entendeu mal. */
function startOption(intent: MenuIntent): MenuDecision {
  const ack = INTENT_ACK[intent];

  if (intent === 3) {
    return askCandidacy(0, [], ack);
  }

  const list = OPTION_LISTS[intent];

  return {
    replies: [`${ack} ${OPTION_REPLIES[intent]}`],
    nextStep: `awaiting_${intent}` as MenuStep,
    handoff: false,
    list: { ...list, text: `${ack}\n${list.text}` }
  };
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
  const clean = value.replace(/\s+/g, " ").trim().replace(/^\(\s*([^()]+?)\s*\)$/, "$1");

  return clean.length > 200 ? `${clean.slice(0, 197)}…` : clean;
}

/** Pede para confirmar a localidade antes de encaminhar para a equipa. */
function confirmation(step: "awaiting_1_confirm", answer: string): MenuDecision {
  const question = `Confirma que a localidade é «${shorten(answer)}»?`;

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

export const OPTION_REPLIES: Record<1 | 2, string> = {
  1: "Obrigada! O apoio domiciliário é para quem (para si, pai ou mãe, outro familiar, amigo, conhecido ou outro)? Se se enganou, escreva 'voltar'.",
  2: [
    "Obrigada pelo interesse na nossa formação! Estes são os cursos disponíveis:",
    "• Técnico de Geriatria 360º com Estágio Prático: b-learning, 60h online + 120h de estágio",
    "• Animação Sociocultural com Idosos com Estágio Prático: b-learning, 40h online + 20h de prática",
    "• Gestão de ERPI, Centro de Dia e SAD: e-learning síncrono, 60h de aulas ao vivo + 15h de projeto final",
    "• Prevenção do Burnout no Cuidador de Idosos: e-learning assíncrono, 4h",
    "Alguns cursos também têm módulos avulsos. Qual destes lhe interessa (ou escreva 'outro')? Se se enganou, escreva 'voltar'."
  ].join("\n")
};

const OPTION_LISTS: Record<1 | 2, MenuList> = { 1: WHO_LIST, 2: COURSE_LIST };

/** Todas as linhas ("rótulo|id|descrição") das listas, para conferir o mapa de rótulos das respostas. */
export const MENU_CHOICE_ROWS = [
  ...MENU_LIST_CHOICES,
  ...WHO_LIST.choices,
  ...HELP_LIST.choices,
  ...URGENCY_LIST.choices,
  ...COURSE_LIST.choices,
  ...YES_NO_ROWS,
  ...AVAIL_ROWS
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
  const steps: MenuStep[] = [
    "menu",
    "menu_retry",
    "awaiting_1",
    "awaiting_1_type",
    "awaiting_1_urgency",
    "awaiting_1_zone",
    "awaiting_1_zone_retry",
    "awaiting_1_confirm",
    "awaiting_2",
    ...CANDIDACY.map((item) => item.step),
    "awaiting_3_name_retry",
    "awaiting_3_hours_retry",
    "declined",
    "done"
  ];

  return typeof value === "string" && (steps as string[]).includes(value) ? (value as MenuStep) : null;
}

type DecideInput = {
  /** A pessoa mandou áudio/imagem/vídeo/documento sem legenda (o texto é só um rótulo). */
  isMedia?: boolean;
  /** A última mensagem do bot já foi um pedido de texto por causa de uma mídia. */
  mediaRetry?: boolean;
  /** ID do item tocado na lista (ex.: "2"); tem prioridade sobre o texto. */
  choiceId?: string | null;
  /** menu_step da última mensagem enviada pelo bot nesta conversa (null = nunca houve). */
  lastStep: MenuStep | null;
  text: string;
  night: boolean;
  /** Link do formulário de recrutamento; sem ele, a candidatura só encaminha para a equipa. */
  recruitmentFormUrl?: string | null;
  /** Eliminatórias respondidas "Não" até agora (vem do payload da última mensagem do bot). */
  candidacyFails?: string[];
};

function closing({
  night,
  choice,
  recruitmentFormUrl,
  courseName,
  gaveUp = false
}: {
  night: boolean;
  choice: MenuChoice | null;
  recruitmentFormUrl?: string | null;
  courseName?: string | null;
  gaveUp?: boolean;
}): MenuDecision {
  const replies: string[] = [];

  if (choice === 2 && courseName) {
    replies.push(`Obrigada pelo interesse em ${courseName}!`);
  }

  if (choice === 3 && recruitmentFormUrl) {
    replies.push(`Preencha este formulário, por favor, de forma a darmos seguimento à sua candidatura: ${recruitmentFormUrl}`);
  }

  replies.push(night ? HANDOFF_NIGHT : HANDOFF_DAY);

  return { replies, nextStep: "done", handoff: true, ...(gaveUp ? { gaveUp: true } : {}) };
}

const MEDIA_PREFIX = "Só consigo ler mensagens de texto e as opções da lista.";
const CONFIRM_REASK = "Toque em “Sim, está certo” para confirmar ou em “Corrigir” para escrever de novo.";

/** A pergunta em curso, para repetir quando a pessoa manda mídia em vez de responder. */
function repeatQuestion(step: MenuStep | null): { text: string; list?: MenuList } | null {
  switch (step) {
    case "menu":
    case "menu_retry":
      return {
        text: "Indique por favor o número da opção que pretende: 1 apoio domiciliário, 2 formação, 3 candidatura, 4 outro assunto.",
        list: {
          text: "Para podermos ajudar, toque no botão e escolha a opção que pretende:",
          listButton: "Ver opções",
          choices: MENU_LIST_CHOICES
        }
      };
    case "awaiting_1":
      return { text: OPTION_REPLIES[1], list: WHO_LIST };
    case "awaiting_1_type":
      return { text: HELP_TEXT, list: HELP_LIST };
    case "awaiting_1_urgency":
      return { text: URGENCY_TEXT, list: URGENCY_LIST };
    case "awaiting_1_zone":
    case "awaiting_1_zone_retry":
      return { text: ASK_ZONE };
    case "awaiting_2":
      return { text: OPTION_REPLIES[2], list: COURSE_LIST };
    case "awaiting_1_confirm":
      return { text: CONFIRM_REASK, list: { text: CONFIRM_REASK, listButton: "Ver opções", choices: CONFIRM_ROWS } };
    default: {
      const index = candidacyIndexOf(step);

      return index >= 0 ? candidacyPrompt(index) : null;
    }
  }
}

/** Volta uma pergunta: a etapa anterior é repetida (ou o menu principal, se era a primeira). */
function goBack(step: MenuStep | null, fails: CandidacyKey[] = []): MenuDecision | null {
  switch (step) {
    case "awaiting_1":
    case "awaiting_2":
      return { replies: [MENU_WELCOME], nextStep: "menu", handoff: false, list: menuList() };
    case "awaiting_1_type":
      return { replies: [OPTION_REPLIES[1]], nextStep: "awaiting_1", handoff: false, list: WHO_LIST };
    case "awaiting_1_urgency":
      return { replies: [HELP_TEXT], nextStep: "awaiting_1_type", handoff: false, list: HELP_LIST };
    case "awaiting_1_zone":
    case "awaiting_1_zone_retry":
    case "awaiting_1_confirm":
      return { replies: [URGENCY_TEXT], nextStep: "awaiting_1_urgency", handoff: false, list: URGENCY_LIST };
    case "declined": {
      // Recusa pela idade volta à idade; as demais voltam à última eliminatória (a quarta).
      const index = fails.includes("age") ? AGE_INDEX : LAST_ELIMINATORY_INDEX;
      const key = CANDIDACY[index].key;

      return askCandidacy(index, fails.filter((item) => item !== key));
    }
    default: {
      const index = candidacyIndexOf(step);

      if (index === 0) {
        return { replies: [MENU_WELCOME], nextStep: "menu", handoff: false, list: menuList() };
      }

      if (index > 0) {
        // A resposta da pergunta que vai ser repetida deixa de valer (inclusive o "Não" guardado).
        const previousKey = CANDIDACY[index - 1].key;

        return askCandidacy(index - 1, fails.filter((item) => item !== previousKey));
      }

      return null;
    }
  }
}

export function decideMenuReply({
  lastStep,
  text,
  choiceId,
  isMedia = false,
  mediaRetry = false,
  candidacyFails,
  night,
  recruitmentFormUrl
}: DecideInput): MenuDecision {
  const fails = sanitizeFails(candidacyFails);

  // Áudio/imagem no meio do fluxo: a primeira vez pede texto ou opção e repete a pergunta;
  // se insistir, a equipa assume.
  if (isMedia) {
    const question = repeatQuestion(lastStep);

    if (question) {
      if (mediaRetry) {
        return closing({ night, choice: null, gaveUp: true });
      }

      return {
        replies: [`${MEDIA_PREFIX} ${question.text}`],
        nextStep: lastStep as MenuStep,
        handoff: false,
        mediaRetry: true,
        ...(fails.length ? { candidacyFails: fails } : {}),
        ...(question.list ? { list: { ...question.list, text: `${MEDIA_PREFIX}\n${question.list.text}` } } : {})
      };
    }
  }

  if (lastStep === "menu" || lastStep === "menu_retry") {
    const choice = (choiceId ? parseMenuChoice(choiceId) : null) ?? parseMenuChoice(text);

    // Saudação ("Boa tarde") não é resposta errada: repete o menu sem gastar a nova tentativa.
    if (!choice && isSmallTalk(text)) {
      const again = repeatQuestion(lastStep);

      if (again) {
        return {
          replies: [again.text],
          nextStep: lastStep,
          handoff: false,
          smallTalk: true,
          ...(again.list ? { list: again.list } : {})
        };
      }
    }

    // Escreveu o que quer ("quero saber os cursos"): vai direto à opção, sem gastar tentativa.
    if (!choice) {
      const intent = detectMenuIntent(text);

      if (intent) {
        return startOption(intent);
      }
    }

    if (choice === 4) {
      return closing({ night, choice });
    }

    if (choice === 3) {
      return askCandidacy(0, [], CANDIDACY_INTRO);
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

    return closing({ night, choice: null, gaveUp: true });
  }

  if (isBack(choiceId, text)) {
    const back = goBack(lastStep, fails);

    if (back) {
      return back;
    }
  }

  const other = isOther(choiceId, text);
  const candidacyIndex = candidacyIndexOf(lastStep);

  if (candidacyIndex >= 0) {
    return decideCandidacy({
      index: candidacyIndex,
      lastStep: lastStep as MenuStep,
      text,
      choiceId,
      other,
      mediaRetry,
      fails,
      night,
      recruitmentFormUrl
    });
  }

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
      return hasWords(text) ? confirmation("awaiting_1_confirm", text) : closing({ night, choice: 1, gaveUp: true });
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
    case "declined":
      return normalizeWord(text) === "menu"
        ? { replies: [MENU_WELCOME], nextStep: "menu", handoff: false, list: menuList() }
        : { replies: [DECLINED_HINT], nextStep: "declined", handoff: false, candidacyFails: fails };
    default:
      return { replies: [MENU_WELCOME], nextStep: "menu", handoff: false, list: menuList() };
  }
}
