// Período de atendimento calculado no código, na hora de Portugal. O modelo recebe o
// resultado pronto ("dentro do horário", "fora do horário"...) em vez de comparar horas
// sozinho: modelos pequenos erram essa conta (ex.: acham que 16h45 ainda é antes de 16h30).
// Sem imports de propósito, para ser testável sem o Next (service-hours.test.mjs).

export const SERVICE_TIMEZONE = "Europe/Lisbon";

/**
 * Horário da DAR+ (briefing, versão 2.0). Minutos desde a meia-noite.
 * Se o sistema passar a atender outro cliente, isto vira configuração por organização.
 */
export const SERVICE_HOURS = {
  opensAt: 8 * 60, // 08h00
  teamClosesAt: 16 * 60 + 30, // 16h30: fim do atendimento humano
  closesAt: 20 * 60 // 20h00: a partir daqui, mensagem de fora de horário
};

export type ServicePeriod = "business" | "evening" | "closed";

function getLocalParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  return {
    isWeekend: parts.weekday === "Sat" || parts.weekday === "Sun",
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

export function getServicePeriod(date: Date = new Date(), timeZone: string = SERVICE_TIMEZONE): ServicePeriod {
  const { isWeekend, minutes } = getLocalParts(date, timeZone);

  if (isWeekend || minutes < SERVICE_HOURS.opensAt || minutes >= SERVICE_HOURS.closesAt) {
    return "closed";
  }

  return minutes < SERVICE_HOURS.teamClosesAt ? "business" : "evening";
}

/** Noite segundo a cliente: das 20h às 08h do dia seguinte, sem regra de fim de semana. */
export function isNightTime(date: Date = new Date(), timeZone: string = SERVICE_TIMEZONE) {
  const { minutes } = getLocalParts(date, timeZone);

  return minutes < SERVICE_HOURS.opensAt || minutes >= SERVICE_HOURS.closesAt;
}

/** Cumprimento de Portugal: Bom dia até às 12h, Boa tarde até às 20h, Boa noite depois. */
export function getGreeting(date: Date = new Date(), timeZone: string = SERVICE_TIMEZONE) {
  const { minutes } = getLocalParts(date, timeZone);

  if (minutes >= 5 * 60 && minutes < 12 * 60) return "Bom dia";
  if (minutes >= 12 * 60 && minutes < 20 * 60) return "Boa tarde";
  return "Boa noite";
}

const PERIOD_INSTRUCTION: Record<ServicePeriod, string> = {
  business:
    "Estado atual: DENTRO do horário de atendimento (2ª a 6ª, 08h00-16h30). Conversa normalmente.",
  evening:
    "Estado atual: FORA do horário da equipa (terminou às 16h30), mas o atendimento continua até às 20h00. Isto é informação interna: NÃO a repitas à pessoa nem escrevas frases sobre recolher dados ou sobre contacto amanhã. Só se a pessoa perguntar quando fala com a equipa é que dizes que é no próximo dia útil.",
  closed:
    "Estado atual: FORA do horário de atendimento (20h00-08h00 ou fim de semana). Isto é informação interna: NÃO a repitas. Se for a primeira resposta desta conversa, avisa numa só frase que a equipa só responde no próximo dia útil; depois disso, não voltes a falar disso a menos que a pessoa pergunte."
};

/** Texto único para o agente: período, instrução e cumprimento, já calculados. */
export function describeServicePeriod(date: Date = new Date(), timeZone: string = SERVICE_TIMEZONE) {
  return `${PERIOD_INSTRUCTION[getServicePeriod(date, timeZone)]} Cumprimento adequado agora: "${getGreeting(date, timeZone)}".`;
}
