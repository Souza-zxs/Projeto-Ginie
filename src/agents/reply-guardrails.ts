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

/** Frase de reserva quando a resposta viola uma regra crítica. Não promete nada. */
export const GUARDRAIL_FALLBACK_REPLY =
  "Compreendo. Vou passar o seu pedido à nossa equipa, que trata desse ponto consigo em breve.";

/**
 * Se `reply` violar alguma regra crítica, devolve a frase de reserva; senão devolve
 * `reply` sem alteração. `reason`, quando presente, identifica qual regra foi violada
 * (para registo/depuração).
 */
export function enforceReplyGuardrails(reply: string): { reply: string; reason: string | null } {
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(reply)) {
      return { reply: GUARDRAIL_FALLBACK_REPLY, reason };
    }
  }

  return { reply, reason: null };
}
