// Pontuação de qualificação calculada no código a partir de fatos confirmados, nunca do
// número que o modelo "acha" que deveria ser.
//
// Observado em produção: com UMA mensagem só ("olá" ou "teste"), o modelo devolveu
// score=100 e 80, "qualificado", sem nenhum dado real da pessoa. O interesse não entra
// na conta porque, no caminho de reserva, ele tem um valor fixo por campanha (a
// descrição do serviço) que está sempre presente — usá-lo daria pontos de graça.
// Sem imports de propósito, para ser testável sem o Next.

export type ScoringFacts = {
  region?: string | null;
  budget?: number | null;
  paymentMethod?: string | null;
};

const SCORED_FIELDS = ["region", "budget", "paymentMethod"] as const;

export function computeDeterministicScore(facts: ScoringFacts): number {
  const knownCount = SCORED_FIELDS.filter((field) => facts[field] !== null && facts[field] !== undefined).length;

  return Math.round((knownCount / SCORED_FIELDS.length) * 100);
}

/** Qualificado com pelo menos 2 dos 3 fatos confirmados, ou se a pessoa pediu visita. */
export function isDeterministicallyQualified(score: number, wantsVisit: boolean) {
  return score >= 50 || wantsVisit;
}
