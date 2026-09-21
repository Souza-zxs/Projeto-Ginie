// Lógica pura de horários de visita: formatação no fuso do cliente e leitura da
// escolha do lead. Sem imports de propósito, para poder ser testada sem o Next.

export const VISIT_TIMEZONE = "Europe/Lisbon";

export type OfferedSlot = { startsAt: string; endsAt: string };

export type Availability = Record<string, Array<{ start: string; end: string }>>;

type WeekdayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

const weekdayKeyByShortName: Record<string, WeekdayKey> = {
  Sun: "sunday",
  Mon: "monday",
  Tue: "tuesday",
  Wed: "wednesday",
  Thu: "thursday",
  Fri: "friday",
  Sat: "saturday"
};

// As janelas de disponibilidade (weekly_availability) são horário de Lisboa, independente
// de em que fuso o servidor está configurado — por isso os horários são calculados via
// Intl.DateTimeFormat (cobre o horário de verão) em vez de Date.setHours(), que usaria o
// fuso local do servidor.
export function getAvailableWindows({
  start,
  now = new Date(),
  days = 7,
  durationMinutes = 30,
  granularityMinutes = 30,
  availability,
  busy = []
}: {
  start?: Date;
  /** Instante de referência para descartar horários passados (injetável para testes). */
  now?: Date;
  days?: number;
  durationMinutes?: number;
  granularityMinutes?: number;
  availability: Availability;
  /** Visitas já confirmadas: os horários que se sobrepõem a elas não são oferecidos. */
  busy?: OfferedSlot[];
}) {
  const base = start ?? now;
  const windows: OfferedSlot[] = [];
  const busyRanges = busy.map((slot) => ({
    from: new Date(slot.startsAt).getTime(),
    to: new Date(slot.endsAt).getTime()
  }));

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const dayInstant = new Date(base.getTime() + dayOffset * 24 * 60 * 60_000);
    const { year, month, day, weekdayShort } = getZonedDateParts(dayInstant, VISIT_TIMEZONE);
    const weekdayKey = weekdayKeyByShortName[weekdayShort];
    const periods = weekdayKey ? availability[weekdayKey] ?? [] : [];

    for (const period of periods) {
      const cursor = zonedTimeToUtc(year, month, day, period.start, VISIT_TIMEZONE);
      const periodEnd = zonedTimeToUtc(year, month, day, period.end, VISIT_TIMEZONE);

      while (cursor.getTime() + durationMinutes * 60_000 <= periodEnd.getTime()) {
        const end = new Date(cursor.getTime() + durationMinutes * 60_000);
        const isBusy = busyRanges.some(
          (range) => range.from < end.getTime() && range.to > cursor.getTime()
        );

        if (cursor.getTime() > now.getTime() && !isBusy) {
          windows.push({
            startsAt: cursor.toISOString(),
            endsAt: end.toISOString()
          });
        }

        cursor.setUTCMinutes(cursor.getUTCMinutes() + granularityMinutes);
      }
    }
  }

  return windows.slice(0, 6);
}

/** Ano/mes/dia e nome curto do dia da semana (en-US: Mon, Tue...), lidos no fuso informado. */
function getZonedDateParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekdayShort: parts.weekday
  };
}

/** Converte "ano-mes-dia HH:mm" NO FUSO informado (ex.: Europe/Lisbon) para o instante UTC correspondente. */
function zonedTimeToUtc(year: number, month: number, day: number, time: string, timeZone: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    })
      .formatToParts(new Date(utcGuess))
      .map((part) => [part.type, part.value])
  );

  const readHour = parts.hour === "24" ? 0 : Number(parts.hour);
  const tzGuess = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), readHour, Number(parts.minute));

  return new Date(utcGuess - (tzGuess - utcGuess));
}

/** Ex.: "terça-feira, 22 de setembro, às 10:00" (sempre no fuso de Lisboa, não no do servidor). */
export function formatVisitDateTime(value: string | Date, timeZone: string = VISIT_TIMEZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-PT", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value])
  );

  return `${parts.weekday}, ${parts.day} de ${parts.month}, às ${parts.hour}:${parts.minute}`;
}

/** Texto numerado com as opções, para o lead responder com "1", "2" ou "3". */
export function formatSlotOptions(slots: OfferedSlot[]) {
  const lines = slots.map((slot, index) => `${index + 1}) ${formatVisitDateTime(slot.startsAt)}`);
  const numbers = slots.map((_, index) => index + 1).join(", ");

  return [
    "Tenho estes horários disponíveis para a visita:",
    ...lines,
    "",
    `Responda com o número da opção (${numbers}) ou diga o dia e a hora que prefere.`
  ].join("\n");
}

export function formatVisitConfirmation(slot: OfferedSlot) {
  return `Combinado! A sua visita ficou marcada para ${formatVisitDateTime(slot.startsAt)}. Se precisar de remarcar, é só avisar.`;
}

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6
};

const SHORT_WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function getLocalTime(value: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value])
  );

  return {
    weekday: SHORT_WEEKDAY_INDEX[parts.weekday] ?? -1,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const PREFIX = "(?:(?:pode ser|quero|prefiro|fica|vai ser|escolho|pode marcar)\\s+)?";
const NUMBER_ONLY = new RegExp(
  `^${PREFIX}(?:(?:a\\s+)?opcao\\s+|numero\\s+|n[o\\u00ba]?\\s*|o\\s+|a\\s+)?(\\d)(?:\\s*(?:mesmo|por favor|obrigad[oa]))?[\\s.!)]*$`
);
const ORDINAL = new RegExp(
  `^${PREFIX}(?:o\\s+|a\\s+)?(primeir[oa]|segundo|segunda(?=\\s+opcao)|terceir[oa]|ultim[oa])(?:\\s+(?:horario|opcao))?[\\s.!)]*$`
);
const YES_ONLY = /^(sim|ok|pode|pode ser|combinado|confirmo|fechado|perfeito|claro)[\s.!]*$/;
const WEEKDAY = /\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/;
const TIME = /\b([01]?\d|2[0-3])\s*(?:h(?:oras?)?|:)\s*([0-5]\d)?/;

/**
 * Descobre qual das opções oferecidas o lead escolheu. Devolve o índice ou `null`
 * quando não há certeza (ambíguo, fora das opções ou conversa comum). Prefere não
 * decidir a decidir errado: um horário marcado errado gera lembrete errado.
 */
export function parseSlotChoice(text: string, slots: OfferedSlot[], timeZone: string = VISIT_TIMEZONE) {
  if (slots.length === 0) {
    return null;
  }

  const normalized = normalize(text);

  if (!normalized) {
    return null;
  }

  const numberMatch = normalized.match(NUMBER_ONLY);

  if (numberMatch) {
    const chosen = Number(numberMatch[1]);

    return chosen >= 1 && chosen <= slots.length ? chosen - 1 : null;
  }

  const ordinalMatch = normalized.match(ORDINAL);

  if (ordinalMatch) {
    const word = ordinalMatch[1];
    const index = word.startsWith("primeir")
      ? 0
      : word.startsWith("segund")
        ? 1
        : word.startsWith("terceir")
          ? 2
          : slots.length - 1;

    return index < slots.length ? index : null;
  }

  if (slots.length === 1 && YES_ONLY.test(normalized)) {
    return 0;
  }

  const weekdayMatch = normalized.match(WEEKDAY);
  const timeMatch = normalized.match(TIME);

  if (!weekdayMatch && !timeMatch) {
    return null;
  }

  const weekday = weekdayMatch ? WEEKDAY_INDEX[weekdayMatch[1]] : null;
  const hour = timeMatch ? Number(timeMatch[1]) : null;
  const minute = timeMatch ? Number(timeMatch[2] ?? 0) : null;

  const matches = slots
    .map((slot, index) => ({ index, local: getLocalTime(slot.startsAt, timeZone) }))
    .filter(
      ({ local }) =>
        (weekday === null || local.weekday === weekday) &&
        (hour === null || (local.hour === hour && local.minute === minute))
    );

  return matches.length === 1 ? matches[0].index : null;
}
