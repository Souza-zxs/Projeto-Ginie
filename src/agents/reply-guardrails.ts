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

  // Gerúndio brasileiro: "estou fazendo" -> "estou a fazer", "estamos indo" -> "estamos a ir".
  out = out.replace(
    new RegExp(`${W}(estou|estás|está|estamos|estão|estava|estavam|estarei|estará|continuo|continua|continuamos|continuam)\\s+(?:(\\p{L}+?)(ando|endo|indo)|(indo))${E}`, "giu"),
    (_m, aux: string, stem: string | undefined, ending: string | undefined) => {
      if (!stem || !ending) return `${aux} a ir`;
      const infinitive = ending.toLowerCase() === "ando" ? "ar" : ending.toLowerCase() === "endo" ? "er" : "ir";
      return `${aux} a ${stem}${infinitive}`;
    }
  );

  // Sobrou um espaço duplo ou uma frase que começa em minúscula depois de tirar "você".
  out = out.replace(/ {2,}/g, " ").trim().replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_m, pre: string, ch: string) => pre + ch.toUpperCase());

  return out;
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

/** Guarda-corpo completo para uma resposta de modelo, com o histórico da conversa. */
export function applyConversationGuardrails(
  reply: string,
  messages: Array<{ direction: "inbound" | "outbound"; content: string | null }>
): { reply: string; reason: string | null } {
  const inbound = messages.filter((m) => m.direction === "inbound").map((m) => m.content ?? "");
  const outbound = messages.filter((m) => m.direction === "outbound").map((m) => m.content ?? "");
  const checked = enforceReplyGuardrails(reply, inbound.join("\n"));

  // A frase de reserva não leva cumprimento, e só se tira o que o modelo escreveu.
  return checked.reason ? checked : { reply: stripRepeatedGreeting(checked.reply, outbound), reason: null };
}
