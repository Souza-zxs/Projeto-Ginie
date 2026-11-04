// Trava de segurança sobre a resposta do modelo, para as regras que não podem depender
// dele obedecer instrução. Modelos pequenos (3B, em CPU) seguem prompt de forma
// inconsistente: já vimos o agente escrever "Vamos marcar uma consulta" mesmo com o
// agendamento desligado e a instrução explícita de nunca confirmar visita.
//
// Isto não substitui o prompt (continua a orientar o tom e o conteúdo), é a última
// barreira antes de a mensagem sair para o cliente. Roda sempre, LLM ou heurística.

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    // "vamos marcar uma consulta/visita", "confirmo a visita", "a visita ficou marcada",
    // "fica confirmado", nas duas ordens possíveis.
    pattern:
      /\b(vamos|posso) marcar\b|\bmarc(o|amos|ada|ado)\b.{0,15}\b(visita|consulta)\b|\b(visita|consulta)\b.{0,20}\b(marcad[oa]|confirmad[oa])\b|\bconfirm(o|amos|ada|ado)\b.{0,20}\b(visita|agendamento|consulta)\b|\bfica(ou)? (confirmad[oa]|marcad[oa])\b/i,
    reason: "confirmacao_agendamento"
  },
  {
    // "posso dar um desconto", "faço um desconto de X%"
    pattern: /\b(posso|consigo) (lhe |te )?dar (um )?desconto\b|\bfa[çc]o um desconto\b|\bdesconto de\b/i,
    reason: "oferta_desconto"
  },
  {
    // "o orçamento fica em torno de 200€", preço concreto que o agente não deveria fixar
    pattern: /\bor[çc]amento (fica|é|ronda|anda)\b.{0,25}(\d|€)/i,
    reason: "preco_fechado"
  },
  {
    // aconselhamento médico direto ("deve tomar", "recomendo consultar" já é ok, mas "tome" é imperativo médico)
    pattern: /\b(deve|deves) tomar\b.{0,20}\b(medica[çc][ãa]o|comprimido|rem[ée]dio)\b/i,
    reason: "conselho_medico"
  }
];


// Pares de parentesco (feminino/masculino). O modelo pequeno às vezes "completa" o par: a
// pessoa diz "avó" e a resposta sai com "avó e avô". `reply*` = o que a resposta não pode
// inventar; `user*` = o que conta como a pessoa já ter mencionado (plurais e grafias sem
// acento cobrem os dois géneros, porque não dá para distinguir).
const L = "(?<![\\p{L}])";
const R = "(?![\\p{L}])";
const re = (alts: string) => new RegExp(`${L}(?:${alts})${R}`, "iu");

const KINSHIP_PAIRS: Array<{ replyF: RegExp; replyM: RegExp; userF: RegExp; userM: RegExp }> = [
  { replyF: re("avó|avozinha"), replyM: re("avô|avozinho"), userF: re("avó|avozinha|avo|avos|avós|avôs"), userM: re("avô|avozinho|avo|avos|avós|avôs") },
  { replyF: re("tia"), replyM: re("tio"), userF: re("tias?|tios"), userM: re("tios?") },
  { replyF: re("mãe"), replyM: re("pai"), userF: re("mãe|mae|mães|maes|pais"), userM: re("pai|pais") },
  { replyF: re("sogra"), replyM: re("sogro"), userF: re("sogras?|sogros"), userM: re("sogros?") },
  { replyF: re("esposa"), replyM: re("marido|esposo"), userF: re("esposas?"), userM: re("marido|esposo") },
  { replyF: re("irmã"), replyM: re("irmão"), userF: re("irmã|irma|irmãs|irmas|irmãos|irmaos"), userM: re("irmão|irmao|irmãos|irmaos") },
  { replyF: re("filha"), replyM: re("filho"), userF: re("filhas?|filhos"), userM: re("filhos?") },
  { replyF: re("prima"), replyM: re("primo"), userF: re("primas?|primos"), userM: re("primos?") }
];

/** true se a resposta cita um familiar (avô, tio…) que a pessoa não mencionou, mas cujo par ela mencionou. */
function inventsRelative(reply: string, inboundText: string): boolean {
  return KINSHIP_PAIRS.some(
    (p) =>
      (p.replyF.test(reply) && !p.userF.test(inboundText) && p.userM.test(inboundText)) ||
      (p.replyM.test(reply) && !p.userM.test(inboundText) && p.userF.test(inboundText))
  );
}


// ---------------------------------------------------------------------------------------
// Português de Portugal garantido em código. O prompt já pede pt-PT, mas o modelo pequeno
// escorrega para o Brasil ("você", "celular", "estou fazendo"). Isto corrige o que dá para
// corrigir com segurança, palavra inteira, mantendo a maiúscula inicial.
// ---------------------------------------------------------------------------------------
const W = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";

const LEXICON: Array<[string, string]> = [
  ["celulares", "telemóveis"],
  ["celular", "telemóvel"],
  ["equipes", "equipas"],
  ["equipe", "equipa"],
  ["ônibus", "autocarro"],
  ["café da manhã", "pequeno-almoço"],
  ["cadastrar", "registar"],
  ["cadastro", "registo"],
  ["contato", "contacto"],
  ["contatos", "contactos"],
  ["gerenciar", "gerir"],
  ["agendar", "marcar"],
  ["tá bom", "está bem"],
  ["tá", "está"],
  ["pra", "para"],
  ["pro", "para o"],
  ["a gente", "nós"],
  ["a seu", "ao seu"],
  ["de repente", "talvez"],
  ["remédios", "medicamentos"],
  ["remédio", "medicamento"],
  ["sucos", "sumos"],
  ["suco", "sumo"],
  ["meninas", "raparigas"],
  ["menina", "rapariga"],
  ["meninos", "rapazes"],
  ["menino", "rapaz"],
  ["arquivos", "ficheiros"],
  ["arquivo", "ficheiro"],
  ["tela", "ecrã"],
  ["baixar", "descarregar"],
  ["registro", "registo"],
  ["xícara", "chávena"],
  ["bacana", "porreiro"]
];

function keepCase(original: string, replacement: string) {
  return original.charAt(0) !== original.charAt(0).toLowerCase()
    ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
    : replacement;
}

/** Corrige brasileirismos comuns. Não mexe em nomes próprios nem em frases já corretas. */
export function toEuropeanPortuguese(text: string): string {
  let out = text;

  // Tratamento: "com você" -> "consigo", "para você" -> "para si"; o resto, "você" sai.
  out = out.replace(new RegExp(`${W}com você${E}`, "giu"), (m) => keepCase(m, "consigo"));
  out = out.replace(new RegExp(`${W}(para|por|de|a|sem|em) você${E}`, "giu"), (m, prep: string) => `${prep} si`);
  out = out.replace(new RegExp(`${W}você ${E}`, "giu"), "");
  out = out.replace(new RegExp(`${W}você${E}`, "giu"), "");

  // Substantivos que mudam de género ao passar para Portugal: acerta o artigo e o possessivo.
  out = out.replace(
    new RegExp(`${W}(?:(o|os|do|dos|no|nos|ao|aos|pelo|pelos|um|este|esse)\\s+)?(?:(nosso|nossos|seu|seus|meu|meus)\\s+)?(times?|endereços?|agendamentos?|banheiros?)${E}`, "giu"),
    (_m, det: string | undefined, poss: string | undefined, noun: string) => {
      const lower = noun.toLowerCase();
      const plural = lower.endsWith("s");
      const base = lower.replace(/s$/, "");
      const fem = base === "time" ? "equipa" : base === "endereço" ? "morada" : base === "agendamento" ? "marcação" : "casa de banho";
      const femNoun = plural ? (fem === "marcação" ? "marcações" : fem === "casa de banho" ? "casas de banho" : `${fem}s`) : fem;
      const DET: Record<string, string> = { o: "a", os: "as", do: "da", dos: "das", no: "na", nos: "nas", ao: "à", aos: "às", pelo: "pela", pelos: "pelas", um: "uma", este: "esta", esse: "essa" };
      const POSS: Record<string, string> = { nosso: "nossa", nossos: "nossas", seu: "sua", seus: "suas", meu: "minha", meus: "minhas" };
      const parts = [
        det ? keepCase(det, DET[det.toLowerCase()] ?? det) : "",
        poss ? keepCase(poss, POSS[poss.toLowerCase()] ?? poss) : "",
        femNoun
      ].filter(Boolean);
      return parts.join(" ");
    }
  );

  for (const [br, pt] of LEXICON) {
    out = out.replace(new RegExp(`${W}${br}${E}`, "giu"), (m) => keepCase(m, pt));
  }

  // Tratamento no plural ("Deixo-vos", "informamos-vos"): a conversa é com uma pessoa só.
  out = out.replace(/-vos(?![\p{L}])/giu, "-lhe").replace(/(?<![\p{L}-])vos(?![\p{L}])/giu, (m) => keepCase(m, "lhe"));

  // Gerúndio brasileiro: "estou fazendo" -> "estou a fazer", "estamos indo" -> "estamos a ir".
  out = out.replace(
    new RegExp(`${W}(estou|estás|está|estamos|estão|estava|estavam|estarei|estará|continuo|continua|continuamos|continuam)\\s+(?:(\\p{L}+?)(ando|endo|indo)|(indo))${E}`, "giu"),
    (_m, aux: string, stem: string | undefined, ending: string | undefined) => {
      if (!stem || !ending) return `${aux} a ir`;
      const infinitive = ending.toLowerCase() === "ando" ? "ar" : ending.toLowerCase() === "endo" ? "er" : "ir";
      return `${aux} a ${stem}${infinitive}`;
    }
  );

  // Horas à portuguesa: "8:10" -> "8h10".
  out = out.replace(/(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g, "$1h$2");

  // Sobrou um espaço duplo ou uma frase que começa em minúscula depois de tirar "você".
  out = out.replace(/ {2,}/g, " ").trim().replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_m, pre: string, ch: string) => pre + ch.toUpperCase());

  return out;
}


// O modelo às vezes promete a visita com data por conta própria ("Poderá marcar uma visita
// no dia útil seguinte"). Os horários reais só podem vir do sistema (agenda), por isso a
// frase com data inventada sai; se não sobrar nada, usa a frase de reserva.
const INVENTED_VISIT_DATE = new RegExp(
  "(?:visita|marca[çc][ãa]o|marcar).{0,90}(?:dia [úu]til seguinte|amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|hoje|\\b[àa]s? \\d)" +
    "|(?:dia [úu]til seguinte|amanh[ãa]|hoje).{0,60}(?:visita|marcar)",
  "iu"
);

export function dropInventedVisitDates(reply: string): { reply: string; changed: boolean } {
  const sentences = reply.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => !INVENTED_VISIT_DATE.test(sentence));

  if (kept.length === sentences.length) {
    return { reply, changed: false };
  }

  return { reply: kept.join(" ").trim(), changed: true };
}

/** Frase de reserva quando a resposta viola uma regra crítica. Não promete nada. */
export const GUARDRAIL_FALLBACK_REPLY =
  "Compreendo. Vou passar o seu pedido à nossa equipa, que trata desse ponto consigo em breve.";

/**
 * Se `reply` violar alguma regra crítica, devolve a frase de reserva; senão devolve
 * `reply` sem alteração. `reason`, quando presente, identifica qual regra foi violada
 * (para registo/depuração).
 */
export function enforceReplyGuardrails(
  reply: string,
  /** Tudo o que a pessoa escreveu até agora; ativa a regra de parentesco inventado. */
  inboundText?: string
): { reply: string; reason: string | null } {
  // Converte antes de verificar: "vamos agendar" vira "vamos marcar" e é apanhado abaixo.
  reply = toEuropeanPortuguese(reply);

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(reply)) {
      return { reply: GUARDRAIL_FALLBACK_REPLY, reason };
    }
  }

  const dated = dropInventedVisitDates(reply);

  if (dated.changed) {
    return { reply: dated.reply || GUARDRAIL_FALLBACK_REPLY, reason: null };
  }

  if (inboundText && inventsRelative(reply, inboundText)) {
    return { reply: GUARDRAIL_FALLBACK_REPLY, reason: "parentesco_inventado" };
  }

  return { reply, reason: null };
}

// Cumprimento no início da resposta: "Boa tarde.", "Olá, João.", "Bom dia, Maria!".
const LEADING_GREETING = /^\s*(?:bom dia|boa tarde|boa noite|ol[áa])(?:\s*,\s*[\p{Lu}][\p{L}'-]*(?=\s*[.!]))?\s*[.,!]+\s*/iu;
const ANY_GREETING = /(?<![\p{L}])(?:bom dia|boa tarde|boa noite|ol[áa])(?![\p{L}])/iu;

/**
 * Se a conversa já teve um cumprimento do nosso lado, tira o cumprimento do início da
 * nova resposta (o modelo repete "Boa tarde" em quase todas as mensagens). Se sobrar
 * texto vazio, mantém a resposta original.
 */
export function stripRepeatedGreeting(reply: string, previousOutboundTexts: string[]): string {
  if (!previousOutboundTexts.some((text) => ANY_GREETING.test(text))) {
    return reply;
  }

  const stripped = reply.replace(LEADING_GREETING, "").trim();

  if (!stripped) {
    return reply;
  }

  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}


// Frases das instruções internas que o modelo pequeno às vezes copia para a resposta.
const LEAKED_INSTRUCTION = /recolher os dados|estar(?:ei|emos) em contacto amanh[ãa]|dia [úu]til seguinte.{0,40}recolh|informa[çc][ãa]o interna/i;

export function dropLeakedInstructions(reply: string): string {
  const sentences = reply.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => !LEAKED_INSTRUCTION.test(sentence));

  return kept.length === 0 ? reply : kept.join(" ").trim();
}

/** Pergunta aberta usada quando a resposta inteira já tinha sido dita antes. */
export const REPEATED_REPLY_REASK =
  "Claro, com todo o gosto. Pode contar-me um pouco mais sobre o que precisa, para podermos ajudar da melhor forma?";

function sentenceKey(sentence: string) {
  return sentence
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O modelo pequeno repete o mesmo parágrafo a cada pergunta. Tira as frases (com mais de
 * 25 letras) que já foram ditas antes, palavra por palavra. Se não sobrar nada, faz uma
 * pergunta aberta em vez de repetir tudo outra vez.
 */
export function dropRepeatedSentences(reply: string, previousOutboundTexts: string[]): string {
  const already = new Set<string>();

  for (const text of previousOutboundTexts) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      const key = sentenceKey(sentence);
      if (key.length > 25) already.add(key);
    }
  }

  if (already.size === 0) {
    return reply;
  }

  const sentences = reply.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => {
    const key = sentenceKey(sentence);
    return !(key.length > 25 && already.has(key));
  });

  if (kept.length === sentences.length) {
    return reply;
  }

  return kept.length === 0 ? REPEATED_REPLY_REASK : kept.join(" ").trim();
}


// ---------------------------------------------------------------------------------------
// Os horários de visita só podem vir do sistema (agenda). O modelo pequeno copia a lista do
// histórico e escreve horários próprios, que não existem na agenda. Estas funções tiram
// qualquer lista de horários escrita pelo modelo.
// ---------------------------------------------------------------------------------------
const SLOT_LINE = /^\s*\d[).]\s.*\d{1,2}\s*(?::|h)\s*\d{2}/i;
const SLOT_CHATTER = /responda com o n[úu]mero|(?:tenho|temos|consigo)\b.{0,30}\bhor[áa]rios?\b.{0,40}(?:visita|dispon[ií]ve|livres)|hoje j[áa] n[ãa]o (?:h[áa]|tenho)\b.{0,30}hor[áa]rios?/i;

export function stripSlotOptions(text: string): string {
  return text
    .split("\n")
    .filter((line) => !SLOT_LINE.test(line) && !SLOT_CHATTER.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texto do histórico mostrado ao modelo: sem as listas de horários, para ele não as copiar. */
export function historyTextForModel(text: string | null): string {
  const raw = text ?? "";
  const cleaned = stripSlotOptions(raw);

  return cleaned || (raw.trim() ? "(enviei as opções de horário para a visita)" : "");
}

/** Se a resposta é só um cumprimento, não serve de abertura para o convite à visita. */
export function leadInForOffer(reply: string): string {
  const letters = reply
    .replace(/(?<![\p{L}])(?:bom dia|boa tarde|boa noite|ol[áa]|obrigad[oa])(?![\p{L}])/giu, "")
    .replace(/[^\p{L}]/gu, "");

  return letters.length < 15 ? "Perfeito, vamos então tratar da visita de avaliação em sua casa." : reply;
}

/**
 * Primeira mensagem da conversa: a agente apresenta-se pelo nome e diz que vai iniciar o
 * atendimento, como uma pessoa faria. O cumprimento do modelo (se houver) é substituído.
 */
export function introduceAgent(reply: string, agentName: string | null | undefined, greeting: string): string {
  const raw = (agentName || "Cecília").trim();
  const display = /^cec[ií]lia$/i.test(raw) ? "Cecília" : raw;
  const plain = display.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const flat = reply.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // Só dispensa a apresentação se a resposta JÁ se apresenta ("chamo-me Cecília", "sou a Cecília").
  if (new RegExp(`chamo-me ${plain}|sou (?:a )?${plain}|sou da dar`).test(flat)) {
    return reply;
  }

  const body = reply.replace(LEADING_GREETING, "").trim();

  return `${greeting}! Chamo-me ${display}, sou da DAR+ e vou iniciar o seu atendimento. ${body}`.trim();
}

/** Guarda-corpo completo para uma resposta de modelo, com o histórico da conversa. */
export function applyConversationGuardrails(
  reply: string,
  messages: Array<{ direction: "inbound" | "outbound"; content: string | null }>
): { reply: string; reason: string | null } {
  const inbound = messages.filter((m) => m.direction === "inbound").map((m) => m.content ?? "");
  const outbound = messages.filter((m) => m.direction === "outbound").map((m) => m.content ?? "");
  const checked = enforceReplyGuardrails(reply, inbound.join("\n"));

  if (checked.reason) {
    // A frase de reserva não leva cumprimento, e só se tira o que o modelo escreveu.
    return checked;
  }

  const clean = dropRepeatedSentences(
    dropFalseFree(dropUnmentionedRelatives(flattenBullets(dropLeakedInstructions(stripSlotOptions(checked.reply) || checked.reply)), inbound.join("\n"))),
    outbound
  );

  return { reply: tidyReply(stripRepeatedGreeting(clean, outbound)), reason: null };
}


/** Mensagem que é só um cumprimento ("Olá", "boa tarde", "oi tudo bem?"): não precisa do modelo. */
export function isGreetingOnly(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /^(?:oi+|ola+|ei|hey|hello|e ai|bom dia|boa tarde|boa noite)(?: (?:cecilia|tudo bem|tudo bom|como vai|td bem))*$/.test(t);
}

/** Resposta pronta a um cumprimento: apresenta-se se for o início, senão convida a continuar. */
export function greetingReply(text: string, hasOutbound: boolean, agentName: string | null | undefined, greeting: string): string {
  const asksHowAreYou = /tudo bem|tudo bom|como vai|td bem/i.test(text.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const lead = asksHowAreYou ? "Tudo bem, obrigada! " : "";

  return hasOutbound
    ? `${lead}Diga, estou a ouvir. Em que posso ajudar?`
    : introduceAgent(`${lead}Em que posso ajudar?`, agentName, greeting);
}

/** Pergunta de seguimento quando a resposta de apoio domiciliário acaba sem pergunta nenhuma. */
export function followUpQuestion(known: { region?: string | null; urgency?: string | null }): string {
  if (!known.region) return "Em que zona fica a casa onde seria o apoio?";
  if (!known.urgency) return "Para quando é que precisaria de começar o apoio?";

  return "Há mais alguma coisa que queira contar-me, para podermos ajudar da melhor forma?";
}

/** Se a zona já é conhecida, tira da resposta a pergunta a repetir a zona. */
export function dropKnownRegionQuestion(reply: string, knownRegion: string | null | undefined): string {
  if (!knownRegion) return reply;

  const sentences = reply.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => !(/\?\s*$/.test(sentence) && /\b(?:zona|onde (?:vive|mora|fica)|localidade|concelho)\b/i.test(sentence)));

  return kept.length === 0 || kept.length === sentences.length ? reply : kept.join(" ").trim();
}


// ---------------------------------------------------------------------------------------
// Urgência: nunca depende do modelo. Resposta fixa, com o 112, e a conversa passa à equipa.
// ---------------------------------------------------------------------------------------
const EMERGENCY = /(?<![a-z])(?:caiu (?:hoje|agora|agorinha|ha pouco|neste momento)|desmai|nao (?:consegue|consigo|pode) (?:levantar|respirar|mexer)|nao respira|nao responde|nao acorda|dor no peito|sangr|ambulancia|emergencia|socorro|engasg)/;

export const EMERGENCY_REPLY =
  "Lamento muito, é urgente. Se houver risco de vida ou ferimentos, ligue já para o 112. Vou passar já esta conversa à nossa equipa, que fala consigo com a maior brevidade.";

export function isEmergency(text: string): boolean {
  return EMERGENCY.test(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );
}

// ---------------------------------------------------------------------------------------
// Familiar que ninguém citou: o modelo pequeno copia os exemplos ("a sua avó") para conversas
// em que a pessoa nunca falou de avó. Tira a frase; se não sobrar nada, faz pergunta aberta.
// ---------------------------------------------------------------------------------------
export function dropUnmentionedRelatives(reply: string, inboundText: string): string {
  const unmentioned = (sentence: string) =>
    KINSHIP_PAIRS.some(
      (p) =>
        (p.replyF.test(sentence) || p.replyM.test(sentence)) && !p.userF.test(inboundText) && !p.userM.test(inboundText)
    );

  const sentences = reply.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => !unmentioned(sentence));

  if (kept.length === sentences.length) {
    return reply;
  }

  return kept.length === 0 ? REPEATED_REPLY_REASK : kept.join(" ").trim();
}

// ---------------------------------------------------------------------------------------
// Listas com marcadores parecem menu de chatbot: transforma em frase corrida.
// ---------------------------------------------------------------------------------------
export function flattenBullets(reply: string): string {
  const bullets = reply.match(/(?:^|\n|\s)[-•]\s+\p{Lu}/gu) ?? [];

  if (bullets.length < 2) {
    return reply;
  }

  return reply
    .replace(/\s*\n\s*[-•]\s+/g, "; ")
    .replace(/\s+[-•]\s+(?=\p{Lu})/gu, "; ")
    .replace(/:\s*;\s*/g, ": ")
    .trim();
}

// ---------------------------------------------------------------------------------------
// Resposta sem pergunta deixa a conversa parada.
// ---------------------------------------------------------------------------------------
export function needsFollowUp(reply: string, lastInboundText: string): boolean {
  if (/\?/.test(reply)) return false;
  if (/n[ãa]o (?:temos|prestamos|atuamos|fazemos)|fora da nossa|nessa zona/i.test(reply)) return false;
  if (/(?:obrigad|tchau|adeus|at[ée] logo|at[ée] breve|bom fim|boa noite e)/i.test(lastInboundText)) return false;

  return true;
}

export function followUpFor(topic: string, known: { region?: string | null; urgency?: string | null }): string {
  if (topic === "training") {
    return "Algum destes cursos é o que procura, ou quer que lhe fale de algum em particular?";
  }

  return followUpQuestion(known);
}


// ---------------------------------------------------------------------------------------
// Arrumação final da resposta do modelo pequeno.
// ---------------------------------------------------------------------------------------
const VOCATIVE = /^\s*(?:querid[oa](?:\(a\))?|car[oa](?:\(a\))?|amig[oa](?:\(a\))?|prezad[oa](?:\(a\))?)\s*,\s*/iu;

/** Só a primeira pergunta fica: duas ou três perguntas seguidas parecem um formulário. */
export function keepFirstQuestion(reply: string): string {
  const sentences = reply.split(/(?<=[.!?])\s+/);
  const questions = sentences.filter((sentence) => /\?\s*$/.test(sentence));

  if (questions.length < 2) {
    return reply;
  }

  const first = questions[0];
  let seen = false;
  const kept = sentences.filter((sentence) => {
    if (!/\?\s*$/.test(sentence)) return true;
    if (!seen && sentence === first) {
      seen = true;
      return true;
    }
    return false;
  });

  return kept.join(" ").trim();
}

/** "à noite, à noite e ao fim de semana" -> "à noite e ao fim de semana". */
export function collapseStutter(reply: string): string {
  return reply.replace(/(?<![\p{L}])(\p{L}+(?: \p{L}+)?),\s+\1(?![\p{L}])/giu, "$1");
}

export function tidyReply(reply: string): string {
  const noVocative = reply.replace(VOCATIVE, "");
  const text = collapseStutter(keepFirstQuestion(noVocative)).trim();

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : reply;
}

// ---------------------------------------------------------------------------------------
// "É um robô?": a resposta é sempre sincera e sempre a mesma, em código.
// ---------------------------------------------------------------------------------------
export function isBotQuestion(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  return /(?<![a-z])(?:robo|chatbot|bot|inteligencia artificial|maquina)(?![a-z])|pessoa (?:real|de verdade)|(?<![a-z])(?:e|es|sao) (?:uma )?pessoa(?![a-z])/.test(t);
}

export const BOT_REPLY =
  "Sou a Cecília, a assistente virtual da DAR+. Posso esclarecer as suas dúvidas e, se preferir falar com uma pessoa da equipa, é só dizer. Como posso ajudar?";


// ---------------------------------------------------------------------------------------
// Fecho da recolha: já com zona e necessidade, o bot oferece que a equipa prepare o orçamento
// e combine a visita. Se a pessoa aceitar, a conversa passa à equipa (agendamento é só dela).
// ---------------------------------------------------------------------------------------
export const TEAM_OFFER_MARKER = "Quer que peça à equipa para entrar em contacto consigo";

export const TEAM_OFFER = `Com o que me contou, a nossa equipa já consegue preparar um orçamento e combinar uma visita de avaliação em sua casa. ${TEAM_OFFER_MARKER}?`;

export const TEAM_CONFIRM_REPLY =
  "Perfeito! Vou pedir à nossa equipa que entre em contacto consigo para preparar o orçamento e combinar o melhor dia e hora para a visita de avaliação. Fala consigo em breve.";

/** "sim", "pode ser", "claro, por favor": resposta curta e afirmativa, sem pergunta. */
export function isAffirmative(text: string): boolean {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return t.length > 0 && t.length <= 30 && !t.includes("?") && /^(?:sim|pode|podem|claro|quero|queria|ok|okay|combinado|com certeza|certo|fechado|isso|perfeito|por favor|bora|vamos)(?![a-z])/.test(t);
}

/** Tira as frases que são perguntas (a oferta da equipa passa a ser a única pergunta). */
export function stripQuestions(reply: string): string {
  return reply
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/\?\s*$/.test(sentence))
    .join(" ")
    .trim();
}

/** Já há zona e pelo menos 3 mensagens reais (não só cumprimentos) e a oferta ainda não foi feita. */
export function shouldOfferTeam(
  messages: Array<{ direction: "inbound" | "outbound"; content: string | null }>,
  region: string | null | undefined
): boolean {
  if (!region) return false;
  if (messages.some((m) => m.direction === "outbound" && (m.content ?? "").includes(TEAM_OFFER_MARKER))) return false;

  const real = messages.filter((m) => m.direction === "inbound" && (m.content ?? "").trim() && !isGreetingOnly(m.content ?? ""));

  return real.length >= 3;
}


// ---------------------------------------------------------------------------------------
// Preço: a resposta é sempre a mesma e certa, em código. O modelo pequeno chegou a escrever
// "o preço é sempre personalizado e gratuito", misturando preço com orçamento gratuito.
// ---------------------------------------------------------------------------------------
function plain(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function isPriceQuestion(text: string): boolean {
  const t = plain(text);

  if (/curso|formacao|academia|candidatura|trabalhar|vaga|emprego/.test(t)) return false;

  return /(?<![a-z])(?:preco|precos|quanto custa|quanto custam|quanto e|quanto fica|quanto cobram|quanto cobra|valor|valores|custo|custos|orcamento|mensalidade|tabela)(?![a-z])/.test(t);
}

export function isFreeClarification(text: string): boolean {
  return /gratuit|de graca|sem custo|nao pago|nao paga/.test(plain(text));
}

export const PRICE_REPLY =
  "O valor depende das horas de apoio e das necessidades de cada pessoa, por isso é sempre personalizado. Quem prepara o orçamento é a nossa equipa, e esse orçamento é gratuito e sem compromisso.";

export const FREE_CLARIFICATION_REPLY =
  "Desculpe a confusão! O que é gratuito é o orçamento: a nossa equipa prepara-o sem qualquer custo nem compromisso para si. O valor do serviço depende depois das horas de apoio e das necessidades.";

export const HOURS_QUESTION = "Mais ou menos quantas horas por dia imagina que seriam precisas?";


// ---------------------------------------------------------------------------------------
// Só o ORÇAMENTO é gratuito. O modelo pequeno chegou a escrever que "os cuidados pessoais,
// tarefas domésticas e acompanhamento" eram gratuitos. Frase com "gratuito", "grátis" ou
// "sem custo" que não fale de orçamento sai da resposta.
// ---------------------------------------------------------------------------------------
const FREE_CLAIM = /gratuit|gr[áa]tis|sem custo|sem cobran[çc]a|de gra[çc]a/i;

export function dropFalseFree(reply: string): string {
  const sentences = reply.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => !(FREE_CLAIM.test(sentence) && !/or[çc]amento/i.test(sentence)));

  if (kept.length === sentences.length) {
    return reply;
  }

  return kept.length === 0 ? REPEATED_REPLY_REASK : kept.join(" ").trim();
}

// ---------------------------------------------------------------------------------------
// Zona: o modelo pequeno quase nunca preenche o campo. Detecta em código as zonas atendidas.
// ---------------------------------------------------------------------------------------
const ZONES = [
  "Cascais", "Oeiras", "Algés", "Linda-a-Velha", "Carcavelos", "Estoril", "Parede", "Carnaxide", "Paço de Arcos",
  "Lisboa", "Amadora", "Sintra", "Odivelas", "Loures", "Almada", "Seixal", "Barreiro", "Alcabideche", "Queijas", "Miraflores"
];

export function detectRegion(text: string): string | null {
  const flat = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const t = flat(text);

  for (const zone of ZONES) {
    if (new RegExp(`(?<![a-z])${flat(zone).replace(/[-\s]/g, "[-\\s]")}(?![a-z])`).test(t)) {
      return zone;
    }
  }

  return null;
}
