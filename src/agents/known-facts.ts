// Mesclagem de "o que já sabemos" com o que o turno atual extraiu. Sem imports de
// propósito, para ser testável sem o Next (known-facts.test.mjs).
//
// Por que isto existe: a cada mensagem, o modelo tenta reextrair tudo do histórico de
// texto, e um modelo pequeno erra essa reconstrução (ex.: "esquece" que o interesse já
// foi dito 2 mensagens atrás e volta a perguntar). known guarda o que já foi salvo em
// turnos anteriores; a mesclagem garante que um novo null do modelo não apaga um dado
// bom que já tínhamos.

export type KnownLeadFacts = {
  interest?: string | null;
  region?: string | null;
  budget?: number | null;
  paymentMethod?: string | null;
  urgency?: string | null;
};

const KNOWN_FIELDS = ["interest", "region", "budget", "paymentMethod", "urgency"] as const;

type Extracted = Partial<Record<(typeof KNOWN_FIELDS)[number], unknown>>;

/**
 * Para cada campo em KNOWN_FIELDS: usa o valor extraído agora se não for nulo/undefined;
 * senão usa o que já era conhecido; senão o valor de reserva (heurística/regex).
 */
export function mergeKnownFacts<T extends Extracted>(
  extracted: T,
  known: KnownLeadFacts | null | undefined,
  fallback: T
): T {
  const merged = { ...extracted };

  for (const field of KNOWN_FIELDS) {
    merged[field] = (extracted[field] ?? known?.[field] ?? fallback[field] ?? null) as T[typeof field];
  }

  return merged;
}
