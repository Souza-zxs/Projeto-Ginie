import type { SupabaseClient } from "@supabase/supabase-js";
import { runLeadAgent } from "@/agents/lead-agent";
import { normalizePhone } from "@/lib/phone";
import {
  configString,
  getActiveIntegrationConfig,
  getUazapiIntegrationConfig,
  getUazapiIntegrationRow,
  type UazapiInstanceRef
} from "@/services/integrations/config";
import { getKnownLeadFacts, upsertLeadFromQualification } from "@/services/leads/workflow";
import { isNightTime } from "@/lib/service-hours";
import { shouldResumeBot } from "@/services/uazapi/bot-resume";
import { DEFAULT_RECRUITMENT_FORM_URL, decideMenuReply, readMenuStep, withTapHint } from "@/services/uazapi/menu-bot";
import { sendUazapiList, sendUazapiMessage } from "@/services/uazapi/send-message";

type AgentConfig = {
  id: string;
  name: string;
  description: string | null;
  openai_model: string;
  system_prompt: string;
  greeting_template: string | null;
  humanization_rules: string | null;
  forbidden_phrases: string | null;
  conversation_examples: string | null;
  agent_skills: string | null;
  qualification_criteria: string | null;
  handoff_instructions: string | null;
};

type LeadMessageInput = {
  supabase: SupabaseClient;
  organizationId: string;
  phone: string;
  text: string;
  /** ID do item tocado numa lista interativa (menu do bot). */
  choiceId?: string | null;
  /** Áudio/imagem/vídeo/documento sem legenda: o texto é só um rótulo, como "[áudio]". */
  mediaType?: "audio" | "image" | "video" | "document" | null;
  payload: unknown;
  /** Instância (número) que recebeu a mensagem; a resposta sai por ela. */
  instance?: UazapiInstanceRef;
  /** ID da mensagem no WhatsApp; gravado para descartar reenvios do webhook. */
  externalMessageId?: string | null;
  senderName?: string | null;
  hauzappClienteId?: string | null;
};

export async function processUazapiLeadMessage({
  supabase,
  organizationId,
  phone,
  text,
  choiceId,
  mediaType,
  payload,
  instance,
  externalMessageId,
  senderName,
  hauzappClienteId
}: LeadMessageInput) {
  const normalizedPhone = normalizePhone(phone) ?? phone.replace(/\D/g, "");
  const { contact, conversation } = await findOrCreateUazapiConversation({
    supabase,
    organizationId,
    phone: normalizedPhone,
    payload,
    senderName,
    hauzappClienteId
  });

  // Marca por qual linha esta conversa está a falar agora: a resposta manual pelo Inbox
  // usa isto para responder pela mesma linha, em vez de adivinhar. Atualiza a cada
  // mensagem — se o lead trocar de linha, a marcação acompanha. É "best-effort": se a
  // migration da coluna ainda não foi aplicada, o erro é ignorado e o atendimento segue.
  const integrationRow = await getUazapiIntegrationRow(supabase, organizationId, instance);

  if (integrationRow) {
    await supabase
      .from("conversations")
      .update({ uazapi_integration_id: integrationRow.id })
      .eq("id", conversation.id);
  }

  // Última mensagem da conversa antes desta (de qualquer lado): base da regra das 24h.
  const { data: previousMessage } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();

  await supabase.from("messages").insert({
    organization_id: organizationId,
    conversation_id: conversation.id,
    contact_id: contact.id,
    direction: "inbound",
    channel: "uazapi",
    type: mediaType ?? "text",
    content: text,
    status: "received",
    external_message_id: externalMessageId ?? null,
    payload
  });

  // O bot desistiu sozinho (não entendeu a pessoa) e ninguém da equipa respondeu: se ela toca numa
  // opção do menu (as listas continuam no chat), é sinal de que quer o menu. Retoma nessa escolha.
  let resumeByTap = false;

  if (!conversation.ai_enabled && choiceId && /^[1-4]$/.test(choiceId)) {
    const { data: lastOutboundAny } = await supabase
      .from("messages")
      .select("payload")
      .eq("conversation_id", conversation.id)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ payload: Record<string, unknown> | null }>();

    resumeByTap = lastOutboundAny?.payload?.gave_up === true;
  }

  // Bot pausado (equipa respondeu ou já encaminhou): volta se a conversa ficou 24h em
  // silêncio. Cada mensagem da equipa reinicia essa contagem. Ao voltar, recomeça pelo menu.
  const resumeBot =
    resumeByTap ||
    shouldResumeBot({
      botActive: conversation.ai_enabled,
      lastMessageAt: previousMessage?.created_at
    });

  // A mensagem que chegou sobe a conversa na lista do Inbox, mesmo com o bot pausado.
  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      ...(resumeBot ? { ai_enabled: true } : {})
    })
    .eq("id", conversation.id);

  if (!conversation.ai_enabled && !resumeBot) {
    return { processed: true, ai: false, conversationId: conversation.id };
  }

  if (process.env.UAZAPI_MENU_BOT !== "off") {
    return runMenuBot({
      supabase,
      organizationId,
      conversationId: conversation.id,
      contactId: contact.id,
      phone: normalizedPhone,
      text,
      choiceId,
      isMedia: Boolean(mediaType),
      instance,
      restart: resumeBot && !resumeByTap,
      forceMenuStep: resumeByTap
    });
  }

  const agent = await getUazapiLeadAgent(supabase, organizationId, instance);
  // Ordem decrescente + limit traz as 30 mais RECENTES; depois volta à ordem cronológica.
  // Em ordem crescente viriam as 30 mais antigas e, numa conversa longa, o agente não
  // veria a mensagem que acabou de chegar.
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("direction, content")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<Array<{ direction: "inbound" | "outbound"; content: string | null }>>();
  const messages = [...(recentMessages ?? [])].reverse();
  const known = await getKnownLeadFacts(supabase, organizationId, conversation.id);

  const qualification = await runLeadAgent({
    contact: {
      name: contact.name,
      phone: normalizedPhone
    },
    known,
    campaign: {
      property_description:
        "Pessoa que contactou a DAR+ pelo WhatsApp. Percebe a necessidade, qualifica e, quando fizer sentido, conduz para o passo seguinte.",
      // O prompt do agente já vai no system (runLeadAgent). Repeti-lo aqui dobrava o
      // tamanho e empurrava a conversa para fora da janela de contexto do modelo local.
      agent_prompt: null
    },
    agent,
    messages
  });

  const lead = await upsertLeadFromQualification({
    supabase,
    organizationId,
    contactId: contact.id,
    campaignId: null,
    conversationId: conversation.id,
    qualification,
    source: "hauzapp"
  });
  const uazapiConfig = await getUazapiIntegrationConfig(supabase, organizationId, instance);
  const result = await sendUazapiMessage({
    phone: normalizedPhone,
    text: qualification.reply,
    integrationConfig: {
      baseUrl: configString(uazapiConfig, ["baseUrl", "base_url"], process.env.UAZAPI_BASE_URL) ?? undefined,
      token: configString(uazapiConfig, ["token", "apiKey", "api_key"], process.env.UAZAPI_TOKEN) ?? undefined
    }
  });
  const sentAt = new Date().toISOString();

  await Promise.all([
    supabase.from("messages").insert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      direction: "outbound",
      channel: "uazapi",
      type: "text",
      content: qualification.reply,
      status: "sent",
      payload: result
    }),
    supabase
      .from("conversations")
      .update({
        current_stage: qualification.stage,
        last_message_at: sentAt
      })
      .eq("id", conversation.id)
  ]);

  return { processed: true, ai: true, leadId: lead.id, conversationId: conversation.id };
}

type HumanMessageInput = {
  supabase: SupabaseClient;
  organizationId: string;
  phone: string;
  text: string;
  payload: unknown;
  instance?: UazapiInstanceRef;
  externalMessageId?: string | null;
};

/**
 * A equipa escreveu à pessoa pelo WhatsApp do próprio número. Grava a mensagem no Inbox e
 * pausa o bot nessa conversa, para ele não responder por cima do atendimento humano. Se a
 * conversa ainda não existia (a equipa falou primeiro), ela nasce com o bot pausado.
 */
export async function pauseBotForHumanMessage({
  supabase,
  organizationId,
  phone,
  text,
  payload,
  instance,
  externalMessageId
}: HumanMessageInput) {
  const normalizedPhone = normalizePhone(phone) ?? phone.replace(/\D/g, "");
  const { contact, conversation } = await findOrCreateUazapiConversation({
    supabase,
    organizationId,
    phone: normalizedPhone,
    payload
  });
  const integrationRow = await getUazapiIntegrationRow(supabase, organizationId, instance);
  const now = new Date().toISOString();

  await supabase.from("messages").insert({
    organization_id: organizationId,
    conversation_id: conversation.id,
    contact_id: contact.id,
    direction: "outbound",
    channel: "uazapi",
    type: "text",
    content: text,
    status: "sent",
    external_message_id: externalMessageId ?? null,
    payload: { source: "phone" }
  });

  await supabase
    .from("conversations")
    .update({ ai_enabled: false, last_message_at: now })
    .eq("id", conversation.id);

  // Best-effort, como no fluxo de entrada: se a coluna não existir, o atendimento segue.
  if (integrationRow) {
    await supabase
      .from("conversations")
      .update({ uazapi_integration_id: integrationRow.id })
      .eq("id", conversation.id);
  }

  return { conversationId: conversation.id, paused: true };
}

async function runMenuBot({
  supabase,
  organizationId,
  conversationId,
  contactId,
  phone,
  text,
  choiceId,
  isMedia = false,
  instance,
  restart = false,
  forceMenuStep = false
}: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  contactId: string;
  phone: string;
  text: string;
  choiceId?: string | null;
  isMedia?: boolean;
  instance?: UazapiInstanceRef;
  /** O bot acabou de ser retomado: ignora a etapa antiga e começa pelo menu. */
  restart?: boolean;
  /** O bot desistiu antes e a pessoa tocou no menu: trata a mensagem como resposta ao menu. */
  forceMenuStep?: boolean;
}) {
  // O estado do menu vive no payload da última mensagem que o bot enviou.
  const { data: lastOutbound } = await supabase
    .from("messages")
    .select("payload, created_at")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    // Só mensagens do bot com etapa: uma que falhou no envio ou a da equipa não mudam o estado.
    .not("payload->>menu_step", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ payload: Record<string, unknown> | null; created_at: string }>();

  const decision = decideMenuReply({
    lastStep: forceMenuStep ? "menu" : restart ? null : readMenuStep(lastOutbound?.payload?.menu_step),
    text,
    choiceId,
    isMedia,
    mediaRetry: !restart && lastOutbound?.payload?.media_retry === true,
    night: isNightTime(),
    unclearCount: restart || forceMenuStep ? 0 : Number(lastOutbound?.payload?.unclear_count) || 0,
    candidacyFails: restart ? [] : (Array.isArray(lastOutbound?.payload?.candidacy_fails) ? (lastOutbound?.payload?.candidacy_fails as string[]) : []),
    recruitmentFormUrl: process.env.RECRUITMENT_FORM_URL || DEFAULT_RECRUITMENT_FORM_URL
  });

  // Saudação logo depois do menu: ele ainda está na tela dela. Não manda outro nem conta como erro.
  if (
    decision.smallTalk &&
    lastOutbound?.created_at &&
    Date.now() - new Date(lastOutbound.created_at).getTime() < 60_000
  ) {
    return { processed: true, ai: false, menu: "small_talk_ignored", conversationId };
  }

  const uazapiConfig = await getUazapiIntegrationConfig(supabase, organizationId, instance);

  const integrationConfig = {
    baseUrl: configString(uazapiConfig, ["baseUrl", "base_url"], process.env.UAZAPI_BASE_URL) ?? undefined,
    token: configString(uazapiConfig, ["token", "apiKey", "api_key"], process.env.UAZAPI_TOKEN) ?? undefined
  };

  let sentCount = 0;
  let sendError: string | null = null;

  for (const reply of decision.replies) {
    try {
      let result: unknown;
      let sentAs = "text";

      if (decision.list) {
        // Lista clicável; se a Uazapi recusar (ou o aparelho não a suportar no envio), cai no
        // menu numerado em texto, que a pessoa responde digitando.
        try {
          result = await sendUazapiList({ phone, ...withTapHint(decision.list), integrationConfig });
          sentAs = "list";
        } catch {
          result = null;
        }
      }

      if (result === null || result === undefined) {
        result = await sendUazapiMessage({ phone, text: reply, integrationConfig });
      }

      await supabase.from("messages").insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        contact_id: contactId,
        direction: "outbound",
        channel: "uazapi",
        type: "text",
        content: reply,
        status: "sent",
        payload: {
          menu_step: decision.nextStep,
          sent_as: sentAs,
          media_retry: decision.mediaRetry === true,
          ...(decision.candidacyFails ? { candidacy_fails: decision.candidacyFails } : {}),
          ...(decision.gaveUp ? { gave_up: true } : {}),
          ...(decision.unclearCount ? { unclear_count: decision.unclearCount } : {}),
          result
        }
      });
      sentCount += 1;
    } catch (error) {
      sendError = error instanceof Error ? error.message : "Erro desconhecido.";

      // Fica visível no Inbox como "não enviada". Sem menu_step de propósito: o estado do
      // menu não avança para uma pergunta que a pessoa nunca recebeu.
      await supabase.from("messages").insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        contact_id: contactId,
        direction: "outbound",
        channel: "uazapi",
        type: "text",
        content: reply,
        status: "failed",
        payload: { send_error: sendError.slice(0, 300) }
      });
      break;
    }
  }

  if (sendError) {
    await supabase.from("webhook_logs").insert({
      organization_id: organizationId,
      provider: "uazapi",
      event_type: "send_failed",
      payload: { conversationId, error: sendError.slice(0, 300) },
      status: "failed"
    });
  }

  // Nada chegou à pessoa: não avança o estado nem encaminha. Só a equipa, vendo o aviso, resolve.
  if (sentCount === 0 && sendError) {
    return { processed: true, ai: false, menu: "send_failed", conversationId };
  }

  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      ...(decision.handoff ? { ai_enabled: false, current_stage: "human_handoff" } : {})
    })
    .eq("id", conversationId);

  return { processed: true, ai: false, menu: decision.nextStep, conversationId };
}

async function getUazapiLeadAgent(
  supabase: SupabaseClient,
  organizationId: string,
  instance?: UazapiInstanceRef
) {
  const hauzappConfig = await getActiveIntegrationConfig(supabase, organizationId, "hauzapp");
  const uazapiConfig = await getUazapiIntegrationConfig(supabase, organizationId, instance);
  const agentId =
    configString(hauzappConfig, ["leadAgentId", "lead_agent_id", "uazapiLeadAgentId"]) ||
    configString(uazapiConfig, ["leadAgentId", "lead_agent_id"]);

  let query = supabase
    .from("ai_agents")
    .select("id, name, description, openai_model, system_prompt, greeting_template, humanization_rules, forbidden_phrases, conversation_examples, agent_skills, qualification_criteria, handoff_instructions")
    .eq("organization_id", organizationId)
    .eq("agent_type", "lead_meta")
    .eq("active", true);

  if (agentId) {
    query = query.eq("id", agentId);
  }

  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<AgentConfig>();

  return data ?? null;
}

async function findOrCreateUazapiConversation({
  supabase,
  organizationId,
  phone,
  payload,
  senderName,
  hauzappClienteId
}: {
  supabase: SupabaseClient;
  organizationId: string;
  phone: string;
  payload: unknown;
  senderName?: string | null;
  hauzappClienteId?: string | null;
}) {
  const { data: existingLead } = await supabase
    .from("leads")
    .select("id, contact_id, conversation_id, name, hauzapp_cliente_id")
    .eq("organization_id", organizationId)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      contact_id: string | null;
      conversation_id: string | null;
      name: string | null;
      hauzapp_cliente_id: string | null;
    }>();

  let contactId = existingLead?.contact_id ?? null;

  if (!contactId) {
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; name: string | null }>();

    contactId = existingContact?.id ?? null;
  }

  if (!contactId) {
    const { data: insertedContact, error } = await supabase
      .from("contacts")
      .insert({
        organization_id: organizationId,
        campaign_id: null,
        name: existingLead?.name ?? senderName ?? null,
        phone,
        raw_data: { source: "uazapi", payload },
        status: "hauzapp_prospect",
        hauzapp_cliente_id: hauzappClienteId ?? existingLead?.hauzapp_cliente_id ?? null
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !insertedContact) {
      throw new Error(error?.message || "Nao foi possivel criar contato Uazapi.");
    }

    contactId = insertedContact.id;
  }

  let conversationId = existingLead?.conversation_id ?? null;

  if (!conversationId) {
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("id, ai_enabled")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .eq("channel", "uazapi")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; ai_enabled: boolean }>();

    conversationId = existingConversation?.id ?? null;
  }

  if (!conversationId) {
    const { data: insertedConversation, error } = await supabase
      .from("conversations")
      .insert({
        organization_id: organizationId,
        contact_id: contactId,
        campaign_id: null,
        status: "open",
        current_stage: "hauzapp_prospection",
        ai_enabled: true,
        channel: "uazapi",
        hauzapp_cliente_id: hauzappClienteId ?? existingLead?.hauzapp_cliente_id ?? null,
        last_message_at: new Date().toISOString()
      })
      .select("id, ai_enabled")
      .single<{ id: string; ai_enabled: boolean }>();

    if (error || !insertedConversation) {
      throw new Error(error?.message || "Nao foi possivel criar conversa Uazapi.");
    }

    conversationId = insertedConversation.id;
  }

  const [{ data: contact }, { data: conversation }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, phone")
      .eq("id", contactId)
      .single<{ id: string; name: string | null; phone: string }>(),
    supabase
      .from("conversations")
      .select("id, ai_enabled")
      .eq("id", conversationId)
      .single<{ id: string; ai_enabled: boolean }>()
  ]);

  if (!contact || !conversation) {
    throw new Error("Contato ou conversa Uazapi nao encontrado.");
  }

  return { contact, conversation };
}
