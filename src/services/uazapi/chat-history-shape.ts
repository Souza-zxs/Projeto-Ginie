// Leitura tolerante da resposta de `POST /message/find` da Uazapi, usada para decidir se um
// contacto já tinha histórico real no WhatsApp antes de o bot falar pela primeira vez. O
// formato exato dessa resposta NÃO está documentado publicamente (confirmado ao desenhar esta
// checagem) — por isso esta leitura aceita várias formas plausíveis, e qualquer formato não
// reconhecido conta como "sem histórico" (o lado que chama decide o resto e falha aberto; ver
// new-contact-check.ts). Precisa de confirmação com uma chamada real antes de confiar cegamente.
// Sem imports do projeto, para ser testável sem o Next (chat-history-shape.test.mjs).

export function hasUazapiChatHistory(payload: unknown): boolean {
  if (Array.isArray(payload)) {
    return payload.length > 0;
  }

  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const arrayField = (["data", "messages", "chats"] as const)
    .map((key) => record[key])
    .find((value): value is unknown[] => Array.isArray(value));

  if (arrayField) {
    return arrayField.length > 0;
  }

  const total = (record.pagination as { total?: unknown } | undefined)?.total;

  return typeof total === "number" && total > 0;
}
