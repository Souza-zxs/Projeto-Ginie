import { after, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { scheduleBrokerProgressChecks } from "@/services/broker-sla/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { isIgnoredPhone } from "@/services/contacts/ignored-numbers";
import { findUazapiOrganizationByToken } from "@/services/integrations/config";
import { pauseBotForHumanMessage, processUazapiLeadMessage } from "@/services/uazapi/lead-workflow";
import {
  describeUazapiPayloadShape,
  parseUazapiWebhook,
  redactUazapiPayload,
  type ParsedUazapiWebhook,
  type UazapiWebhookPayload
} from "@/services/uazapi/webhook-payload";

type IncomingMessage = Extract<ParsedUazapiWebhook, { kind: "message" }>;
type OwnMessage = Extract<ParsedUazapiWebhook, { kind: "own_message" }>;
type AdminClient = ReturnType<typeof createAdminClient>;

export async function POST(request: Request) {
  const webhookSecret = process.env.UAZAPI_WEBHOOK_SECRET;
  const providedSecret = new URL(request.url).searchParams.get("token");

  // Em produção, sem UAZAPI_WEBHOOK_SECRET o webhook recusa tudo (fail-closed).
  if ((webhookSecret || process.env.NODE_ENV === "production") && providedSecret !== webhookSecret) {
    return NextResponse.json({ error: "Invalid webhook token." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as UazapiWebhookPayload;
  const message = parseUazapiWebhook(payload);

  // Eventos que não interessam (status, conexão, mensagens nossas, grupos) respondem 200:
  // um erro faria a Uazapi reenviar o mesmo evento várias vezes.
  if (message.kind === "ignored") {
    // Registra o descarte para diagnóstico (Configurações > Logs), sem telefone nem texto.
    after(() => logIgnoredWebhook(payload, message.reason));
    return NextResponse.json({ processed: false, reason: message.reason });
  }

  const phone = normalizePhone(message.rawPhone);

  if (!phone) {
    return NextResponse.json({ processed: false, reason: "invalid_phone" });
  }

  const supabase = createAdminClient();

  if (message.externalMessageId) {
    const { data: duplicate } = await supabase
      .from("messages")
      .select("id")
      .eq("external_message_id", message.externalMessageId)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (duplicate) {
      return NextResponse.json({ processed: false, reason: "duplicate_message" });
    }
  }

  const safePayload = redactUazapiPayload(payload);

  // A equipa respondeu pelo próprio WhatsApp: grava e pausa o bot nessa conversa.
  if (message.kind === "own_message") {
    after(async () => {
      try {
        await handleOwnMessage(supabase, message, phone, safePayload);
      } catch (error) {
        await supabase.from("webhook_logs").insert({
          organization_id: null,
          provider: "uazapi",
          event_type: "processing_error",
          payload: {
            error: error instanceof Error ? error.message : "Erro desconhecido.",
            externalMessageId: message.externalMessageId,
            instanceName: message.instanceName
          },
          status: "failed"
        });
      }
    });

    return NextResponse.json({ received: true, own: true });
  }

  // A Uazapi pede resposta 200 imediata. O agente roda num modelo local que pode levar
  // mais de um minuto; segurar a requisição até lá faria a Uazapi reenviar a mensagem
  // e o lead receberia a resposta em dobro. `after` processa depois de responder.
  after(async () => {
    try {
      await handleIncomingMessage(supabase, message, phone, safePayload);
    } catch (error) {
      await supabase.from("webhook_logs").insert({
        organization_id: null,
        provider: "uazapi",
        event_type: "processing_error",
        payload: {
          error: error instanceof Error ? error.message : "Erro desconhecido.",
          externalMessageId: message.externalMessageId,
          instanceName: message.instanceName
        },
        status: "failed"
      });
    }
  });

  return NextResponse.json({ received: true });
}

async function logIgnoredWebhook(payload: UazapiWebhookPayload, reason: string) {
  try {
    await createAdminClient()
      .from("webhook_logs")
      .insert({
        organization_id: null,
        provider: "uazapi",
        event_type: "ignored",
        payload: describeUazapiPayloadShape(payload, reason),
        status: reason
      });
  } catch {
    // Diagnóstico não pode derrubar o webhook.
  }
}

async function handleOwnMessage(
  supabase: AdminClient,
  message: OwnMessage,
  phone: string,
  payload: UazapiWebhookPayload
) {
  const organizationId =
    (await findUazapiOrganizationByToken(supabase, message.instanceToken)) ??
    (await resolveLeadOrganization(supabase, phone));

  if (!organizationId || (await isIgnoredPhone(supabase, phone, organizationId))) {
    return;
  }

  await pauseBotForHumanMessage({
    supabase,
    organizationId,
    phone,
    text: message.text,
    payload,
    instance: { token: message.instanceToken, name: message.instanceName },
    externalMessageId: message.externalMessageId
  });
}

async function handleIncomingMessage(
  supabase: AdminClient,
  message: IncomingMessage,
  phone: string,
  payload: UazapiWebhookPayload
) {
  const tokenOrganizationId = await findUazapiOrganizationByToken(supabase, message.instanceToken);

  // Números da lista de ignorados (Configurações > Números ignorados): descarta sem gravar
  // nada, nem no Inbox nem nos logs. Pedido explícito do cliente.
  if (await isIgnoredPhone(supabase, phone, tokenOrganizationId)) {
    return;
  }

  const { data: broker } = await supabase
    .from("brokers")
    .select("id, organization_id")
    .eq("phone", phone)
    .maybeSingle<{ id: string; organization_id: string }>();

  if (!broker) {
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("phone", phone)
      .in("role", ["admin", "manager"])
      .limit(1)
      .maybeSingle<{ id: string; organization_id: string }>();

    if (adminProfile) {
      const adminResult = await processAdminMessage({
        supabase,
        organizationId: adminProfile.organization_id,
        text: message.text,
        payload
      });
      await supabase.from("webhook_logs").insert({
        organization_id: adminProfile.organization_id,
        provider: "uazapi",
        event_type: "admin_message",
        payload,
        status: adminResult.updated ? "processed_admin_update" : "processed_admin"
      });

      return;
    }
  }

  await supabase.from("webhook_logs").insert({
    organization_id: broker?.organization_id ?? null,
    provider: "uazapi",
    event_type: "broker_message",
    payload,
    status: broker ? "processed" : "ignored_no_broker"
  });

  if (!broker) {
    // Quem recebeu é a instância dona do token; só sem ela cai nas heurísticas antigas.
    const organizationId = tokenOrganizationId ?? (await resolveLeadOrganization(supabase, phone));

    if (!organizationId) {
      return;
    }

    await processUazapiLeadMessage({
      supabase,
      organizationId,
      phone,
      text: message.text,
      choiceId: message.choiceId,
      payload,
      instance: { token: message.instanceToken, name: message.instanceName },
      externalMessageId: message.externalMessageId,
      senderName: message.senderName,
      hauzappClienteId: message.hauzappClienteId
    });

    return;
  }

  const { data: assignment } = await supabase
    .from("broker_assignments")
    .select("id, lead_id, status, responded_at")
    .eq("organization_id", broker.organization_id)
    .eq("broker_id", broker.id)
    .in("status", ["assigned", "accepted", "no_response"])
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; lead_id: string; status: string; responded_at: string | null }>();

  if (!assignment) {
    return;
  }

  const now = new Date().toISOString();
  const firstBrokerReply = assignment.status === "assigned" || !assignment.responded_at;
  const stage = inferBrokerStage(message.text);

  await Promise.all([
    supabase
      .from("broker_assignments")
      .update({ status: "accepted", responded_at: assignment.responded_at ?? now })
      .eq("id", assignment.id),
    supabase
      .from("leads")
      .update({
        stage,
        last_stage_updated_at: now,
        last_broker_response_at: now
      })
      .eq("id", assignment.lead_id),
    supabase.from("messages").insert({
      organization_id: broker.organization_id,
      direction: "inbound",
      channel: "uazapi",
      type: "text",
      content: message.text,
      status: "received",
      external_message_id: message.externalMessageId,
      payload
    })
  ]);

  if (firstBrokerReply) {
    await scheduleBrokerProgressChecks({
      supabase,
      organizationId: broker.organization_id,
      assignmentId: assignment.id,
      leadId: assignment.lead_id,
      brokerId: broker.id
    });
  }
}

async function resolveLeadOrganization(supabase: AdminClient, phone: string) {
  const { data: contact } = await supabase
    .from("contacts")
    .select("organization_id")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ organization_id: string }>();

  if (contact?.organization_id) {
    return contact.organization_id;
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("organization_id")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ organization_id: string }>();

  if (lead?.organization_id) {
    return lead.organization_id;
  }

  const { data: integration } = await supabase
    .from("integrations")
    .select("organization_id")
    .eq("provider", "uazapi")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ organization_id: string }>();

  return integration?.organization_id ?? null;
}

async function processAdminMessage({
  supabase,
  organizationId,
  text,
  payload
}: {
  supabase: AdminClient;
  organizationId: string;
  text: string;
  payload: unknown;
}) {
  const stage = inferAdminStage(text);

  if (!stage) {
    return { updated: false, reason: "no_stage_command" };
  }

  const { data: assignment } = await supabase
    .from("broker_assignments")
    .select("id, lead_id")
    .eq("organization_id", organizationId)
    .in("status", ["assigned", "accepted", "no_response"])
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; lead_id: string }>();

  if (!assignment) {
    return { updated: false, reason: "no_assignment_to_update" };
  }

  const now = new Date().toISOString();
  await Promise.all([
    supabase
      .from("leads")
      .update({
        stage,
        last_stage_updated_at: now,
        last_broker_response_at: now,
        summary: `Atualizacao da Cris/Admin via WhatsApp: ${text}`
      })
      .eq("id", assignment.lead_id),
    supabase.from("integration_logs").insert({
      organization_id: organizationId,
      provider: "uazapi",
      target_type: "admin_lead_update",
      target_id: assignment.lead_id,
      status: "done",
      request_payload: { text, payload },
      response_payload: { stage },
      error_message: null
    })
  ]);

  return { updated: true, leadId: assignment.lead_id, stage };
}

function inferAdminStage(text: string) {
  return inferStageFromText(text, false);
}

function inferBrokerStage(text: string) {
  return inferStageFromText(text, true) ?? "broker_attending";
}

function inferStageFromText(text: string, fallbackToAttending: boolean) {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  if (normalized.includes("ganhou") || normalized.includes("fechou")) return "won";
  if (normalized.includes("perdeu") || normalized.includes("sem interesse")) return "lost";
  if (normalized.includes("proposta")) return "proposal";
  if (normalized.includes("visita")) return "visit";
  if (normalized.includes("cliente quente") || normalized.includes("quente")) return "cliente_quente";
  if (normalized.includes("reaquecer")) return "reaquecer";
  if (normalized.includes("atendimento")) return "broker_attending";
  if (normalized.includes("iniciei") || normalized.includes("iniciado")) return "broker_attending";
  if (normalized.includes("contato") || normalized.includes("falei")) return "broker_attending";

  return fallbackToAttending ? "broker_attending" : null;
}
