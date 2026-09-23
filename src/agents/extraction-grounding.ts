// Confere se um dado que o modelo extraiu (interest, region, paymentMethod, budget)
// aparece de verdade no que a pessoa escreveu, antes de confiar nele.
//
// Por que isto existe: observado em produção — com UMA mensagem só ("olá" ou "teste"),
// o modelo (3B, CPU) devolveu interest="apoio domiciliário", region="Lisboa", score=100,
// "qualificado", e um summary descrevendo uma conversa que nunca aconteceu. Ele não erra
// só a fase (repetir pergunta): ele inventa dado que vai para o CRM como se fosse fato.
// JSON com campos obrigatórios incentiva isso — o modelo prefere um "chute plausível" a
// devolver null. Sem imports de propósito, para ser testável sem o Next.

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Concatena as mensagens do lead (inbound) numa só string normalizada para conferência. */
export function buildGroundingText(messages: Array<{ direction: "inbound" | "outbound"; content: string | null }>) {
  return normalize(
    messages
      .filter((message) => message.direction === "inbound")
      .map((message) => message.content ?? "")
      .join(" ")
  );
}

/**
 * Um valor de texto está "fundamentado" se ele mesmo, ou pelo menos uma palavra
 * significativa dele (4+ letras), aparecer no que a pessoa escreveu. Também aceita se
 * o valor já era conhecido de um turno anterior (aí a fonte é a conversa passada, não
 * uma invenção deste turno).
 */
export function isGroundedText(value: string | null | undefined, groundingText: string, previouslyKnown?: string | null) {
  if (!value) {
    return true;
  }

  if (previouslyKnown && normalize(previouslyKnown) === normalize(value)) {
    return true;
  }

  const normalizedValue = normalize(value);

  if (groundingText.includes(normalizedValue)) {
    return true;
  }

  return normalizedValue
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .some((word) => groundingText.includes(word));
}

/** Mesma ideia para um valor numérico (budget): os dígitos precisam aparecer no texto. */
export function isGroundedNumber(value: number | null | undefined, groundingText: string, previouslyKnown?: number | null) {
  if (value === null || value === undefined) {
    return true;
  }

  if (previouslyKnown === value) {
    return true;
  }

  return groundingText.includes(String(value));
}
