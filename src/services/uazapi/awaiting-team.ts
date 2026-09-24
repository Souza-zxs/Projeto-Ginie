// "Aguardando a equipa": a pessoa foi encaminhada (ou o bot foi pausado por uma resposta
// manual) e ainda ninguém da equipa respondeu. Módulo puro, sem imports do projeto, para ser
// testável sem o Next (awaiting-team.test.mjs).

export type TimedMessage = {
  direction: "inbound" | "outbound";
  /** payload->>menu_step: só o bot preenche; mensagem manual da equipa não tem. */
  menu_step: string | null;
  created_at: string;
};

/**
 * Desde quando a conversa espera resposta humana, ou null se não espera.
 * - O encaminhamento pelo bot ("done") começa a espera.
 * - Mensagem da equipa (outbound sem menu_step) zera a espera.
 * - Mensagem da pessoa depois de encaminhada, ou com o bot pausado por resposta manual,
 *   começa a espera de novo.
 * - O menu recomeçando (retomada em 24h) zera tudo: é um novo ciclo.
 */
export function computeAwaitingSince(messages: TimedMessage[], botPaused: boolean): Date | null {
  let handedOff = false;
  let humanActed = false;
  let waitingSince: Date | null = null;

  for (const message of messages) {
    const at = new Date(message.created_at);

    if (Number.isNaN(at.getTime())) {
      continue;
    }

    if (message.direction === "outbound") {
      if (message.menu_step === "done") {
        handedOff = true;
        waitingSince ??= at;
      } else if (message.menu_step === "menu") {
        handedOff = false;
        humanActed = false;
        waitingSince = null;
      } else if (!message.menu_step) {
        humanActed = true;
        waitingSince = null;
      }

      continue;
    }

    if (!waitingSince && (handedOff || (botPaused && humanActed))) {
      waitingSince = at;
    }
  }

  return waitingSince;
}

/** "instantes", "12 min", "2 h 15 min", "3 d" — para escrever "há …". */
export function formatWaiting(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);

  if (minutes < 1) return "instantes";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    const rest = minutes % 60;

    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }

  return `${Math.floor(hours / 24)} d`;
}
