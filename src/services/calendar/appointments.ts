import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfferedSlot } from "@/services/calendar/slots";
import { publishJobProcessor } from "@/services/qstash/jobs";

// A lógica pura (janelas de disponibilidade no fuso de Lisboa, formatação, leitura da
// escolha do lead) vive em slots.ts, que não depende do Next e por isso tem testes.
export { getAvailableWindows } from "@/services/calendar/slots";

/** Visitas já marcadas (e ainda por acontecer) da organização, para não oferecer o mesmo horário duas vezes. */
export async function getBusySlots(supabase: SupabaseClient, organizationId: string) {
  const { data } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("organization_id", organizationId)
    .in("status", ["confirmed", "pending", "pending_google"])
    .gt("ends_at", new Date().toISOString())
    .returns<Array<{ starts_at: string; ends_at: string }>>();

  return (data ?? []).map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at }));
}

type OpenProposal = { id: string; slots: OfferedSlot[] };

/** Oferta de horários ainda válida (com pelo menos uma opção no futuro) para a conversa, se houver. */
export async function getOpenProposal(
  supabase: SupabaseClient,
  conversationId: string
): Promise<OpenProposal | null> {
  const { data } = await supabase
    .from("appointments")
    .select("id, payload")
    .eq("conversation_id", conversationId)
    .eq("status", "proposed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; payload: { offeredSlots?: OfferedSlot[] } | null }>();

  const now = Date.now();
  const slots = (data?.payload?.offeredSlots ?? []).filter(
    (slot) => new Date(slot.startsAt).getTime() > now
  );

  return data && slots.length > 0 ? { id: data.id, slots } : null;
}

/**
 * Registra os horários oferecidos ao lead SEM marcar nada: a visita fica como
 * "proposed" e não gera lembretes. Uma conversa tem no máximo uma oferta aberta;
 * uma nova oferta atualiza a anterior em vez de criar outra.
 */
export async function proposeVisitSlots({
  supabase,
  organizationId,
  leadId,
  conversationId,
  contactId,
  agentId,
  title,
  description,
  slots
}: {
  supabase: SupabaseClient;
  organizationId: string;
  leadId?: string | null;
  conversationId: string;
  contactId: string;
  agentId?: string | null;
  title: string;
  description?: string | null;
  slots: OfferedSlot[];
}) {
  const first = slots[0];
  const fields = {
    title,
    description,
    starts_at: first.startsAt,
    ends_at: first.endsAt,
    payload: {
      offeredSlots: slots,
      googleCalendarId: process.env.GOOGLE_CALENDAR_ID ?? null
    }
  };

  const { data: existing } = await supabase
    .from("appointments")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("status", "proposed")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing) {
    await supabase.from("appointments").update(fields).eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("appointments")
    .insert({
      organization_id: organizationId,
      lead_id: leadId ?? null,
      conversation_id: conversationId,
      contact_id: contactId,
      agent_id: agentId ?? null,
      status: "proposed",
      ...fields
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !created) {
    throw new Error(error?.message || "Nao foi possivel registrar a proposta de visita.");
  }

  return created.id;
}

/**
 * Confirma o horário que o lead escolheu: só aqui a visita vira "confirmed" e os
 * lembretes são criados. A troca de status é condicional (`status = proposed`), então
 * uma mensagem repetida do webhook não confirma duas vezes nem duplica os lembretes.
 */
export async function confirmProposedVisit({
  supabase,
  organizationId,
  proposalId,
  slot
}: {
  supabase: SupabaseClient;
  organizationId: string;
  proposalId: string;
  slot: OfferedSlot;
}) {
  const { data: appointment } = await supabase
    .from("appointments")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      starts_at: slot.startsAt,
      ends_at: slot.endsAt
    })
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .eq("status", "proposed")
    .select("id, lead_id, conversation_id, contact_id")
    .maybeSingle<{
      id: string;
      lead_id: string | null;
      conversation_id: string | null;
      contact_id: string | null;
    }>();

  if (!appointment) {
    return null;
  }

  const starts = new Date(slot.startsAt);
  const ends = new Date(slot.endsAt);
  const reminderAt = new Date(starts.getTime() - 3 * 60 * 60_000);
  const postVisitAt = new Date(ends.getTime() + 60 * 60_000);
  const payload = {
    leadId: appointment.lead_id,
    conversationId: appointment.conversation_id,
    contactId: appointment.contact_id
  };
  const jobs = [
    {
      organization_id: organizationId,
      job_type: "appointment_reminder",
      target_id: appointment.id,
      status: "pending",
      run_at: (reminderAt.getTime() > Date.now() ? reminderAt : new Date(Date.now() + 60_000)).toISOString(),
      payload
    },
    {
      organization_id: organizationId,
      job_type: "appointment_post_visit_check",
      target_id: appointment.id,
      status: "pending",
      run_at: postVisitAt.toISOString(),
      payload
    }
  ];

  await supabase.from("scheduled_jobs").insert(jobs);
  await publishJobProcessor({ runAt: jobs[0]?.run_at, reason: "appointment_jobs" }).catch(() => null);

  return appointment;
}
