// Quando passar a conversa para uma pessoa da equipa. Decidido em código, não pelo modelo:
// o bot só se cala quando a pessoa pede um humano ou quando o assunto é daqueles que só um
// humano resolve (urgência, reclamação, negociação de preço, cancelamento) ou quando quer marcar
// visita/horário (agendamento é só pela equipa).
// Sem imports de propósito, para ser testável sem o Next.

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const HUMAN_NOUN = "(?:humano|pessoa|atendente|alguem|equipa|equipe|colaborador|colaboradora|responsavel|diretora|diretor|gerente|supervisor|supervisora)";

const REQUESTS_HUMAN = new RegExp(
  [
    `\\b(?:falar|conversar|passar|ligar|contactar|contatar|chamar)\\b.{0,30}\\b${HUMAN_NOUN}\\b`,
    `\\b(?:quero|preciso|gostava|gostaria|prefiro)\\b.{0,25}\\b(?:humano|atendente|pessoa real|pessoa de verdade|atendimento humano)\\b`,
    "\\b(?:atendimento humano|pessoa de verdade|pessoa real|robo)\\b.{0,20}\\b(?:por favor|pf|agora)\\b",
    "\\b(?:me|ligue|liguem|liga)[- ]?(?:me|lhe)?\\s*(?:ligar|liga|ligue)\\b",
    "\\bliguem[- ]me\\b|\\bligue[- ]me\\b|\\bme liga\\b|\\bme liguem\\b"
  ].join("|"),
  "i"
);

const ONLY_HUMAN_CAN_HELP = new RegExp(
  [
    "\\b(?:emergencia|urgente|urgencia|socorro|ambulancia|hospital)\\b",
    "\\b(?:caiu (?:hoje|agora|agorinha|ha pouco|neste momento)|desmaiou|desmaio|nao responde|nao acorda|nao respira|dor no peito|sangr\\w*|engasg\\w*)\\b",
    "\\bnao (?:consegue|consigo|pode) (?:levantar|respirar|mexer)\\b",
    "\\b(?:reclamacao|reclamar|nao apareceu|faltou|pessimo|inaceitavel|processar)\\b",
    "\\b(?:desconto|mais barato|muito caro|negociar|abater)\\b",
    "\\b(?:cancelar (?:o )?(?:contrato|servico)|rescindir|reembolso|devolucao)\\b"
  ].join("|"),
  "i"
);

// Marcar visita, horário ou chamada é sempre com a equipa: o bot não oferece nem marca horários.
const SCHEDULING = new RegExp(
  [
    "\\b(?:agendar|agendamento|agendem|agende|remarcar|marcar|marcacao|marquem|marque)\\b",
    "\\bhorarios?\\b.{0,30}\\b(?:disponiv|livre|visita|avaliacao|amanha|hoje|tarde|manha)",
    "\\b(?:visita|avaliacao)\\b.{0,25}\\b(?:amanha|hoje|semana|quando|dia|hora)",
    "\\bquando (?:podem|pode|conseguem|consegue|poderiam)\\b.{0,25}\\b(?:vir|visitar|passar|comecar|iniciar)\\b"
  ].join("|"),
  "i"
);

/** true se a pessoa quer marcar/combinar visita, horário ou chamada. */
export function wantsScheduling(text: string): boolean {
  return SCHEDULING.test(normalize(text));
}

/** Frase que acompanha o encaminhamento, conforme o motivo. */
export function handoffNote(text: string): string {
  return wantsScheduling(text)
    ? "A nossa equipa vai combinar consigo diretamente o melhor dia e hora, e fala consigo em breve."
    : "Vou passar a sua conversa à nossa equipa, que fala consigo em breve.";
}

/** true se a pessoa pediu um humano ou escreveu algo que só uma pessoa da equipa resolve. */
export function requiresHuman(text: string): boolean {
  const t = normalize(text);

  return t.length > 0 && (REQUESTS_HUMAN.test(t) || ONLY_HUMAN_CAN_HELP.test(t) || SCHEDULING.test(t));
}

const SCHEDULING_REPLY =
  "Claro! Vou pedir à nossa equipa que combine consigo diretamente o melhor dia e hora para a visita de avaliação em sua casa, e fala consigo em breve.";

/**
 * Resposta final quando a conversa passa para a equipa. Se é por causa de agendamento, ignora
 * o texto do modelo (que costuma prometer horários) e usa uma frase única e coerente; nos
 * outros casos mantém o texto do modelo e só acrescenta o aviso quando ele não o fez.
 */
export function composeHandoffReply(userText: string, modelReply: string): string {
  if (wantsScheduling(userText)) {
    return SCHEDULING_REPLY;
  }

  return /equipa|colaborador|diretora|pessoa/i.test(modelReply) ? modelReply : `${modelReply}\n\n${handoffNote(userText)}`;
}
