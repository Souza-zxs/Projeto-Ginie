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
