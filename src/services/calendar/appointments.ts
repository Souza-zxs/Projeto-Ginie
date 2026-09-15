import type { SupabaseClient } from "@supabase/supabase-js";
import { publishJobProcessor } from "@/services/qstash/jobs";

type Availability = Record<string, Array<{ start: string; end: string }>>;

// Cliente atual (DAR+ / Paisagens Serenas) é de Portugal. As janelas de
// disponibilidade (weekly_availability) são horário de Lisboa, independente
// de em que fuso a VPS está configurada — por isso os horários são
// calculados via Intl.DateTimeFormat (cobre horário de verão automaticamente)
// em vez de Date.setHours(), que usaria o fuso local do servidor.
const AGENT_TIMEZONE = "Europe/Lisbon";

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

export function getAvailableWindows({
  start,
  days = 7,
  durationMinutes = 30,
  granularityMinutes = 30,
  availability
}: {
  start?: Date;
  days?: number;
  durationMinutes?: number;
  granularityMinutes?: number;
  availability: Availability;
}) {
  const base = start ?? new Date();
  const windows: Array<{ startsAt: string; endsAt: string }> = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const dayInstant = new Date(base.getTime() + dayOffset * 24 * 60 * 60_000);
    const { year, month, day, weekdayShort } = getZonedDateParts(dayInstant, AGENT_TIMEZONE);
    const weekdayKey = weekdayKeyByShortName[weekdayShort];
    const periods = weekdayKey ? availability[weekdayKey] ?? [] : [];

    for (const period of periods) {
      const cursor = zonedTimeToUtc(year, month, day, period.start, AGENT_TIMEZONE);
      const periodEnd = zonedTimeToUtc(year, month, day, period.end, AGENT_TIMEZONE);

      while (cursor.getTime() + durationMinutes * 60_000 <= periodEnd.getTime()) {
        const end = new Date(cursor.getTime() + durationMinutes * 60_000);

        if (cursor.getTime() > Date.now()) {
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

export async function createVisitAppointment({
  supabase,
  organizationId,
  leadId,
  conversationId,
  contactId,
  agentId,
  title,
  description,
  startsAt,
  durationMinutes
}: {
  supabase: SupabaseClient;
  organizationId: string;
  leadId?: string | null;
  conversationId: string;
  contactId: string;
  agentId?: string | null;
  title: string;
  description?: string | null;
  startsAt: string;
  durationMinutes: number;
}) {
  const starts = new Date(startsAt);
  const ends = new Date(starts.getTime() + durationMinutes * 60_000);

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      organization_id: organizationId,
      lead_id: leadId ?? null,
      conversation_id: conversationId,
      contact_id: contactId,
      agent_id: agentId ?? null,
      title,
      description,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      status: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL ? "pending_google" : "pending",
      payload: {
        googleCalendarId: process.env.GOOGLE_CALENDAR_ID ?? null
      }
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !appointment) {
    throw new Error(error?.message || "Nao foi possivel criar agendamento.");
  }

  const reminderAt = new Date(starts.getTime() - 3 * 60 * 60_000);
  const postVisitAt = new Date(ends.getTime() + 60 * 60_000);
  const jobs = [
    {
      organization_id: organizationId,
      job_type: "appointment_reminder",
      target_id: appointment.id,
      status: "pending",
      run_at: (reminderAt.getTime() > Date.now() ? reminderAt : new Date(Date.now() + 60_000)).toISOString(),
      payload: { leadId, conversationId, contactId }
    },
    {
      organization_id: organizationId,
      job_type: "appointment_post_visit_check",
      target_id: appointment.id,
      status: "pending",
      run_at: postVisitAt.toISOString(),
      payload: { leadId, conversationId, contactId }
    }
  ];

  await supabase.from("scheduled_jobs").insert(jobs);
  await publishJobProcessor({ runAt: jobs[0]?.run_at, reason: "appointment_jobs" }).catch(() => null);

  return appointment;
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
