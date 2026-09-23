// Modelos de linguagem não sabem que horas são a menos que a gente diga.
// Usado para o agente decidir corretamente regras de "fora de horário".
export function formatNowForAgent(timeZone: string = "Europe/Lisbon") {
  const formatted = new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());

  return `${formatted} (hora de Lisboa)`;
}

// Toda data/hora mostrada na plataforma usa a hora de Portugal (Lisboa), qualquer que seja o
// fuso do servidor ou do navegador de quem olha.
export const DISPLAY_TIMEZONE = "Europe/Lisbon";
const DISPLAY_LOCALE = "pt-PT";

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWith(options: Intl.DateTimeFormatOptions, value: string | Date | null | undefined, fallback: string) {
  const date = toDate(value);

  return date ? new Intl.DateTimeFormat(DISPLAY_LOCALE, { timeZone: DISPLAY_TIMEZONE, ...options }).format(date) : fallback;
}

/** 23/09/2026, 16:11 */
export function formatDateTime(value: string | Date | null | undefined, fallback = "--") {
  return formatWith({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, value, fallback);
}

/** 23/09, 16:11 */
export function formatShortDateTime(value: string | Date | null | undefined, fallback = "--") {
  return formatWith({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, value, fallback);
}

/** 23/09/2026 */
export function formatDate(value: string | Date | null | undefined, fallback = "--") {
  return formatWith({ day: "2-digit", month: "2-digit", year: "numeric" }, value, fallback);
}

/** 16:11 */
export function formatTime(value: string | Date | null | undefined, fallback = "--") {
  return formatWith({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, value, fallback);
}

function lisbonOffsetMs(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DISPLAY_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Valor de <input type="datetime-local"> ("2026-09-23T16:00", sem fuso) lido como hora de
 * Lisboa. `new Date(valor)` no servidor usaria o fuso do servidor (UTC na VPS) e o lembrete
 * sairia uma hora fora no verão.
 */
export function parseLisbonLocalDateTime(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const wallAsUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0)
  );
  let instant = wallAsUtc;

  // Duas passagens acertam o deslocamento mesmo perto da mudança de hora.
  for (let i = 0; i < 2; i += 1) {
    instant = wallAsUtc - lisbonOffsetMs(new Date(instant));
  }

  return new Date(instant);
}
