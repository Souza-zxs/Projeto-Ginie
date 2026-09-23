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
  opensAt: 9 * 60, // 09h00
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

/** Cumprimento de Portugal: Bom dia até às 12h, Boa tarde até às 20h, Boa noite depois. */
export function getGreeting(date: Date = new Date(), timeZone: string = SERVICE_TIMEZONE) {
  const { minutes } = getLocalParts(date, timeZone);

  if (minutes >= 5 * 60 && minutes < 12 * 60) return "Bom dia";
  if (minutes >= 12 * 60 && minutes < 20 * 60) return "Boa tarde";
  return "Boa noite";
}

const PERIOD_INSTRUCTION: Record<ServicePeriod, string> = {
  business:
    "DENTRO do horário de atendimento (2ª a 6ª, 09h00-16h30). Atenda normalmente.",
  evening:
    "FORA do horário da equipa (terminou às 16h30), mas antes das 20h00. Continue a atender e a recolher os dados, e diga que a equipa dá seguimento no dia útil seguinte.",
  closed:
    "FORA do horário de atendimento (entre 20h00 e 09h00, ou fim de semana). Se ainda não enviou a mensagem de fora de horário nesta conversa hoje, envie-a. Pode recolher dados, mas não prometa contacto hoje."
};

/** Texto único para o agente: período, instrução e cumprimento, já calculados. */
export function describeServicePeriod(date: Date = new Date(), timeZone: string = SERVICE_TIMEZONE) {
  return `${PERIOD_INSTRUCTION[getServicePeriod(date, timeZone)]} Cumprimento adequado agora: "${getGreeting(date, timeZone)}".`;
}
