// Normaliza telefone para o formato "código do país + número", sem símbolos.
// Suporta Portugal (cliente atual: DAR+ / Paisagens Serenas, Lda.) e Brasil
// (formato original do projeto), distinguindo pela quantidade de dígitos —
// não há colisão: Portugal usa sempre 9 dígitos locais / 12 com código do
// país (351); Brasil usa 10-11 locais / 12-13 com código do país (55).
export function normalizePhone(value: unknown): string | null {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  // Remove zeros à esquerda (prefixo de discagem internacional "00" ou "0" de rede local)
  digits = digits.replace(/^0+/, "");

  // Já vem com código do país
  if (digits.startsWith("351") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  // Número local, sem código do país
  if (digits.length === 9) {
    return `351${digits}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return null;
}

/**
 * Lê uma lista colada (um número por linha, ou separados por vírgula/ponto e vírgula),
 * normaliza cada um e separa os válidos (sem repetição) dos que não foram reconhecidos.
 */
export function parsePhoneList(text: string) {
  const valid = new Set<string>();
  const invalid: string[] = [];

  for (const raw of text.split(/[\n,;]+/)) {
    const entry = raw.trim();
    if (!entry) continue;

    const phone = normalizePhone(entry);
    if (phone) {
      valid.add(phone);
    } else {
      invalid.push(entry);
    }
  }

  return { valid: [...valid], invalid };
}

/** Exibição legível: +351 937 513 951 (Portugal) ou +55 83 99999-9999 (Brasil). */
export function formatPhoneForDisplay(phone: string) {
  if (/^351\d{9}$/.test(phone)) {
    return `+351 ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;
  }

  if (/^55\d{10,11}$/.test(phone)) {
    const local = phone.slice(4);
    return `+55 ${phone.slice(2, 4)} ${local.slice(0, -4)}-${local.slice(-4)}`;
  }

  return `+${phone}`;
}
