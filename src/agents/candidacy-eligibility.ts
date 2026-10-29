// Portão de elegibilidade da candidatura (recrutamento): decide SEMPRE por código, nunca pelo
// julgamento livre do modelo — tem consequência legal real (menor de idade, autorização de
// trabalho). O bot conversacional só pergunta e relata; quem decide passa/recusa é este módulo.
// Sem imports do projeto, para ser testável sem o Next (candidacy-eligibility.test.mjs).

export type CandidacyKey = "age" | "q1" | "q2" | "q3" | "q4";

/** Uma pergunta por vez, nesta ordem fixa — confirmado: não tenta aproveitar várias respostas de uma vez. */
export const ELIGIBILITY_ORDER: CandidacyKey[] = ["age", "q1", "q2", "q3", "q4"];

export const ELIGIBILITY_QUESTIONS: Record<CandidacyKey, string> = {
  age: "Tem 18 anos ou mais?",
  q1: "Tem experiência como cuidador(a) de idosos?",
  q2: "Tem autorização para trabalhar em Portugal (legalizado/a ou com processo em curso)?",
  q3: "Pode trabalhar com contrato de prestação de serviços (recibos verdes)?",
  q4: "Vive em Lisboa ou Grande Lisboa, ou consegue deslocar-se até lá?"
};

export const REQUIREMENT_TEXT: Record<"q2" | "q3" | "q4", string> = {
  q2: "ter autorização para trabalhar em Portugal (legalizado/a ou com processo em curso)",
  q3: "poder trabalhar em prestação de serviços (recibos verdes)",
  q4: "viver em Lisboa ou Grande Lisboa, ou poder deslocar-se até lá"
};

/** Aviso fixo, enviado uma única vez, assim que a conversa entra na candidatura — antes da
 * primeira pergunta de elegibilidade (ver o ponto de transição em runFreeAgentBot, em
 * lead-workflow.ts). Explica à pessoa o que vem a seguir, já que no bot livre não há mais
 * botões a indicar isso. */
export const CANDIDACY_INTRO =
  "Antes de continuar, vou fazer algumas perguntas rápidas, uma de cada vez, para confirmar se a candidatura é possível — pode responder com as próprias palavras.";

export const DECLINE_AGE =
  "Obrigada pelo interesse na DAR+. Para trabalhar connosco é necessário ter 18 anos ou mais, por isso, de momento, não podemos dar seguimento à candidatura. Se respondeu por engano, escreva 'voltar' para corrigir a resposta.";

export const ACADEMY_MESSAGE =
  "Obrigada pela sua sinceridade! Para trabalhar como cuidador(a) connosco é preciso alguma experiência, mas pode adquiri-la: a DAR+ Academia tem formação com estágio prático, pensada para quem quer começar nesta área. Pode ser o primeiro passo! 💚";

/** Cada campo é "yes"/"no" quando já resolvido, ou ausente/`null`/`undefined` enquanto pendente. */
export type CandidacyFacts = Partial<Record<CandidacyKey, "yes" | "no" | null>>;

export type CandidacyOutcome =
  | { status: "pending"; nextField: CandidacyKey; question: string }
  | { status: "declined"; message: string }
  | { status: "academy"; message: string }
  | { status: "passed" };

/**
 * Decide o estado da elegibilidade a partir dos factos já resolvidos. Idade "não" decide na
 * hora (não se recolhe mais dado de um menor); as outras só são avaliadas depois de as 4
 * estarem resolvidas — um "não" isolado em q2/q3/q4 não encerra sozinho, espera as restantes.
 */
export function decideCandidacyOutcome(facts: CandidacyFacts): CandidacyOutcome {
  if (facts.age === "no") {
    return { status: "declined", message: DECLINE_AGE };
  }

  const pending = ELIGIBILITY_ORDER.find((key) => facts[key] !== "yes" && facts[key] !== "no");

  if (pending) {
    return { status: "pending", nextField: pending, question: ELIGIBILITY_QUESTIONS[pending] };
  }

  const failedHard = (["q2", "q3", "q4"] as const).filter((key) => facts[key] === "no");

  if (failedHard.length) {
    const message = `Obrigada pelo interesse na DAR+ e por ter respondido às nossas perguntas. De momento não podemos dar seguimento à sua candidatura, porque é necessário ${failedHard
      .map((key) => REQUIREMENT_TEXT[key])
      .join("; ")}. Se respondeu por engano, escreva 'voltar' para corrigir a resposta. Desejamos-lhe muito sucesso!`;

    return { status: "declined", message };
  }

  if (facts.q1 === "no") {
    return { status: "academy", message: ACADEMY_MESSAGE };
  }

  return { status: "passed" };
}

/**
 * Mescla os factos extraídos nesta mensagem com o que já era conhecido: um campo novo `null`/
 * ausente nunca apaga um campo já resolvido (mesma regra de src/agents/known-facts.ts).
 */
export function mergeCandidacyFacts(
  extracted: CandidacyFacts,
  known: CandidacyFacts | null | undefined,
  fallback: CandidacyFacts = {}
): CandidacyFacts {
  const result: CandidacyFacts = {};

  for (const key of ELIGIBILITY_ORDER) {
    result[key] = extracted[key] ?? known?.[key] ?? fallback[key] ?? null;
  }

  return result;
}

// Mesmos rótulos curtos de DECLINE_REASONS em menu-answers.ts (mantém o "Não avança: ..." do
// Inbox/Clientes igual entre o bot de menu e o bot livre).
const SHORT_REASON: Record<"age" | "q2" | "q3" | "q4", string> = {
  age: "menos de 18 anos",
  q2: "sem autorização de trabalho",
  q3: "não aceita recibos verdes",
  q4: "fora de Lisboa"
};

/** Rótulo curto do motivo da recusa (para payload.decline_reason), ou null se não há recusa. */
export function declineReasonLabel(facts: CandidacyFacts): string | null {
  if (facts.age === "no") {
    return SHORT_REASON.age;
  }

  const failed = (["q2", "q3", "q4"] as const).filter((key) => facts[key] === "no");

  return failed.length ? failed.map((key) => SHORT_REASON[key]).join(", ") : null;
}

/** Desfaz um facto já resolvido (usado quando a pessoa pede para corrigir a resposta anterior). */
export function clearCandidacyFact(facts: CandidacyFacts, key: CandidacyKey): CandidacyFacts {
  const rest: CandidacyFacts = { ...facts };

  delete rest[key];

  return rest;
}
