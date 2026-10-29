import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";
import {
  configString,
  getActiveIntegrationConfig,
  getUazapiIntegrationConfig,
  getUazapiIntegrationRow,
  type UazapiInstanceRef
} from "@/services/integrations/config";
import { isNightTime } from "@/lib/service-hours";
import { shouldResumeBot } from "@/services/uazapi/bot-resume";
import { hasRecentWhatsappHistory } from "@/services/uazapi/new-contact-check";
import { DEFAULT_RECRUITMENT_FORM_URL, decideMenuReply, readMenuStep, withTapHint } from "@/services/uazapi/menu-bot";
import { TOPIC_LABELS, type MenuAnswer } from "@/services/uazapi/menu-answers";
import { sendUazapiList, sendUazapiMessage } from "@/services/uazapi/send-message";
import {
  ageAnswer as recognizeAge,
  yesNoAnswer as recognizeYesNo
} from "@/agents/candidacy-answer-recognizers";
import {
  ELIGIBILITY_ORDER,
  decideCandidacyOutcome,
  declineReasonLabel,
  mergeCandidacyFacts,
  type CandidacyFacts,
  type CandidacyKey
} from "@/agents/candidacy-eligibility";
import { runWhatsappAgent, type WhatsappTopic } from "@/agents/whatsapp-agent";
import type { KnownLeadFacts } from "@/agents/known-facts";

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
    hauzappClienteId,
    // Só aqui (entrada automática): se a conversa for mesmo nova, confere se já havia
    // histórico real no WhatsApp antes de o bot assumir. Na pausa manual (pauseBotForHumanMessage)
    // não faz sentido — a conversa já fica pausada de qualquer forma.
    checkHistoryWith: instance
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

  // Última mensagem enviada (bot ou pessoa), para duas coisas: saber se dá para retomar sozinho
  // (só quando quem pausou foi o bot, nunca quando foi uma pessoa) e, tocando numa opção do menu
  // depois de o bot ter desistido sozinho, retomar nessa escolha.
  const { data: lastOutboundAny } = await supabase
    .from("messages")
    .select("payload")
    .eq("conversation_id", conversation.id)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ payload: Record<string, unknown> | null }>();
  const lastOutboundWasBot = Boolean(lastOutboundAny?.payload?.menu_step);

  // O bot desistiu sozinho (não entendeu a pessoa) e ninguém da equipa respondeu: se ela toca numa
  // opção do menu (as listas continuam no chat), é sinal de que quer o menu. Retoma nessa escolha.
  const resumeByTap = Boolean(
    !conversation.ai_enabled && choiceId && /^[1-4]$/.test(choiceId) && lastOutboundAny?.payload?.gave_up === true
  );

  // Bot pausado por ele mesmo (desistiu ou já encaminhou, sem a equipa ter respondido): volta se
  // a conversa ficou 24h em silêncio. Pausado por uma pessoa: fica assim até "Ativar bot".
  const resumeBot =
    resumeByTap ||
    shouldResumeBot({
      botActive: conversation.ai_enabled,
      lastMessageAt: previousMessage?.created_at,
      lastOutboundWasBot
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

  // "menu" (padrão) usa o bot por botões, sem mudança; "free" usa o novo bot conversacional
  // livre. Dá para reverter em produção sem deploy, só trocando a variável de ambiente.
  const botMode = process.env.UAZAPI_BOT_MODE === "free" ? "free" : "menu";

  if (botMode === "menu") {
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

  return runFreeAgentBot({
    supabase,
    organizationId,
    conversationId: conversation.id,
    contactId: contact.id,
    contactName: contact.name,
    phone: normalizedPhone,
    text,
    isMedia: Boolean(mediaType),
    instance,
    restart: resumeBot
  });
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

type FreeAgentStep = "menu" | "in_progress" | "declined" | "done";

type FreeAgentState = {
  topic: WhatsappTopic | null;
  support: KnownLeadFacts;
  candidateName: string | null;
  eligibility: CandidacyFacts;
  unclearCount: number;
};

const EMPTY_FREE_AGENT_STATE: FreeAgentState = {
  topic: null,
  support: {},
  candidateName: null,
  eligibility: {},
  unclearCount: 0
};

function readFreeAgentState(payload: Record<string, unknown> | null | undefined): FreeAgentState {
  if (!payload) {
    return EMPTY_FREE_AGENT_STATE;
  }

  return {
    topic: (payload.topic as WhatsappTopic | undefined) ?? null,
    support: (payload.support as KnownLeadFacts | undefined) ?? {},
    candidateName: (payload.candidate_name as string | undefined) ?? null,
    eligibility: (payload.eligibility as CandidacyFacts | undefined) ?? {},
    unclearCount: Number(payload.eligibility_unclear_count) || 0
  };
}

const SUPPORT_FIELD_LABELS: Record<keyof KnownLeadFacts, string> = {
  interest: "Interesse",
  region: "Localidade",
  urgency: "Urgência",
  budget: "Orçamento",
  paymentMethod: "Forma de pagamento"
};

const ELIGIBILITY_FIELD_LABELS: Record<CandidacyKey, string> = {
  age: "Tem 18 anos ou mais",
  q1: "Experiência como cuidador(a)",
  q2: "Autorização para trabalhar em Portugal",
  q3: "Recibos verdes",
  q4: "Vive em Lisboa ou Grande Lisboa"
};

/** Para mostrar nas páginas de Clientes/Inbox (ver MenuAnswer em menu-answers.ts). */
function buildCollectedInfo(state: FreeAgentState): MenuAnswer[] {
  const answers: MenuAnswer[] = [];

  if (state.topic) {
    answers.push({ question: "Assunto", answer: TOPIC_LABELS[state.topic] });
  }

  if (state.candidateName) {
    answers.push({ question: "Nome", answer: state.candidateName });
  }

  for (const key of ["interest", "region", "urgency", "budget", "paymentMethod"] as const) {
    const value = state.support[key];

    if (value !== null && value !== undefined) {
      answers.push({ question: SUPPORT_FIELD_LABELS[key], answer: String(value) });
    }
  }

  for (const key of ELIGIBILITY_ORDER) {
    const value = state.eligibility[key];

    if (value === "yes" || value === "no") {
      answers.push({ question: ELIGIBILITY_FIELD_LABELS[key], answer: value === "yes" ? "Sim" : "Não" });
    }
  }

  return answers;
}

const MEDIA_NOT_SUPPORTED_REPLY = "De momento só consigo ler mensagens em texto — pode escrever por favor?";

// Mesmo limite do bot de menu: 2 respostas não entendidas na mesma pergunta de elegibilidade
// e o bot desiste e chama a equipa, em vez de insistir indefinidamente numa pergunta com
// consequência legal (idade, autorização de trabalho).
const CANDIDACY_UNCLEAR_LIMIT = 2;
const CANDIDACY_UNCLEAR_HANDOFF_REPLY =
  "Peço desculpa, não consegui perceber bem a sua resposta. Vou pedir a alguém da nossa equipa para continuar consigo, já responde por aqui.";

/**
 * Bot conversacional livre (UAZAPI_BOT_MODE=free). O modelo conduz a conversa à vontade, mas a
 * elegibilidade da candidatura é SEMPRE decidida por decideCandidacyOutcome/os reconhecedores de
 * texto — nunca pela interpretação livre do modelo (ver candidacy-eligibility.ts). Mesmo padrão
 * de envio/registo de falha de runMenuBot, mas com uma única mensagem de texto por turno (sem
 * listas: o modo livre não usa menus clicáveis).
 */
async function runFreeAgentBot({
  supabase,
  organizationId,
  conversationId,
  contactId,
  contactName,
  phone,
  text,
  isMedia = false,
  instance,
  restart = false
}: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  contactId: string;
  contactName: string | null;
  phone: string;
  text: string;
  isMedia?: boolean;
  instance?: UazapiInstanceRef;
  restart?: boolean;
}) {
  const { data: lastOutbound } = await supabase
    .from("messages")
    .select("payload")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .not("payload->>menu_step", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ payload: Record<string, unknown> | null }>();

  const lastStep = lastOutbound?.payload?.menu_step as FreeAgentStep | undefined;
  // Depois de uma recusa ou de um encaminhamento concluído, qualquer mensagem nova começa um
  // atendimento do zero — não há "voltar ao menu" no modo livre, a conversa simplesmente reabre.
  const effectiveRestart = restart || lastStep === "done" || lastStep === "declined";
  const state = effectiveRestart ? EMPTY_FREE_AGENT_STATE : readFreeAgentState(lastOutbound?.payload);

  let reply = "";
  let nextTopic = state.topic;
  let nextSupport = state.support;
  let nextCandidateName = state.candidateName;
  let nextEligibility = state.eligibility;
  let nextUnclearCount = 0;
  let nextStep: FreeAgentStep = !lastOutbound || effectiveRestart ? "menu" : "in_progress";
  let declineReason: string | null = null;
  let handoff = false;

  if (isMedia) {
    reply = MEDIA_NOT_SUPPORTED_REPLY;
    nextUnclearCount = state.unclearCount;
    nextStep = state.topic ? "in_progress" : "menu";
  } else {
    const gateOutcome = state.topic === "recruitment" ? decideCandidacyOutcome(state.eligibility) : null;
    let eligibilityPendingField: CandidacyKey | null = null;
    let eligibilityQuestion: string | null = null;
    let skipLlm = false;

    if (gateOutcome?.status === "pending") {
      const recognized =
        gateOutcome.nextField === "age"
          ? recognizeAge(text, new Date().getFullYear()) ?? recognizeYesNo(text)
          : recognizeYesNo(text);

      if (recognized === null) {
        nextUnclearCount = state.unclearCount + 1;

        if (nextUnclearCount >= CANDIDACY_UNCLEAR_LIMIT + 1) {
          reply = CANDIDACY_UNCLEAR_HANDOFF_REPLY;
          handoff = true;
          nextStep = "in_progress";
          skipLlm = true;
        } else {
          eligibilityPendingField = gateOutcome.nextField;
          eligibilityQuestion = gateOutcome.question;
        }
      } else {
        nextEligibility = mergeCandidacyFacts({ [gateOutcome.nextField]: recognized }, state.eligibility);
        const resolved = decideCandidacyOutcome(nextEligibility);

        if (resolved.status === "declined") {
          reply = resolved.message;
          declineReason = declineReasonLabel(nextEligibility);
          nextStep = "declined";
          skipLlm = true;
        } else if (resolved.status === "academy") {
          reply = resolved.message;
          nextTopic = "training";
          nextStep = "in_progress";
          skipLlm = true;
        } else if (resolved.status === "pending") {
          eligibilityPendingField = resolved.nextField;
          eligibilityQuestion = resolved.question;
        }
        // "passed": segue para o modelo com eligibilityPendingField=null (perfil livre).
      }
    }

    if (!skipLlm) {
      const agent = await getUazapiLeadAgent(supabase, organizationId, instance);
      // Mesma ordem decrescente + limit de recentMessages no caminho antigo: as 30 mais
      // RECENTES, depois de volta à ordem cronológica, para a mensagem que acabou de
      // chegar nunca ficar fora da janela numa conversa longa.
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("direction, content")
        .eq("organization_id", organizationId)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<Array<{ direction: "inbound" | "outbound"; content: string | null }>>();

      const result = await runWhatsappAgent({
        contact: { name: contactName, phone },
        agent,
        known: {
          topic: state.topic,
          support: state.support,
          candidateName: state.candidateName,
          eligibility: nextEligibility,
          eligibilityPendingField,
          eligibilityQuestion
        },
        messages: [...(recentMessages ?? [])].reverse(),
        night: isNightTime()
      });

      reply = result.reply;
      nextTopic = result.topic;
      nextSupport = result.support;
      nextCandidateName = result.candidateName;
      handoff = result.handoffRequested;
      nextStep = handoff ? "done" : "in_progress";

      // O modelo só sabe perguntar a pergunta de elegibilidade pendente quando o prompt já a
      // traz (eligibilityBlock, ativo só quando a conversa JÁ era "recruitment" neste turno).
      // Na própria mensagem em que a pessoa entra na candidatura, o prompt ainda não sabia —
      // o código garante a primeira pergunta aqui, para o portão nunca ser saltado.
      if (result.topic === "recruitment" && state.topic !== "recruitment") {
        const firstOutcome = decideCandidacyOutcome(nextEligibility);

        if (firstOutcome.status === "pending") {
          reply = `${reply}\n\n${firstOutcome.question}`;
        }
      }

      // Candidatura aprovada e o modelo achou que já recolheu o suficiente: antes de
      // encaminhar, entrega o link do formulário (mesmo link e momento de closing() no
      // bot de menu) — isto o código garante, nunca fica a cargo do modelo inventar o link.
      if (handoff && nextTopic === "recruitment" && decideCandidacyOutcome(nextEligibility).status === "passed") {
        const formUrl = process.env.RECRUITMENT_FORM_URL || DEFAULT_RECRUITMENT_FORM_URL;
        reply = `${reply}\n\n${formUrl}`;
      }
    }
  }

  const finalState: FreeAgentState = {
    topic: nextTopic,
    support: nextSupport,
    candidateName: nextCandidateName,
    eligibility: nextEligibility,
    unclearCount: nextUnclearCount
  };

  const uazapiConfig = await getUazapiIntegrationConfig(supabase, organizationId, instance);
  const integrationConfig = {
    baseUrl: configString(uazapiConfig, ["baseUrl", "base_url"], process.env.UAZAPI_BASE_URL) ?? undefined,
    token: configString(uazapiConfig, ["token", "apiKey", "api_key"], process.env.UAZAPI_TOKEN) ?? undefined
  };

  try {
    const result = await sendUazapiMessage({ phone, text: reply, integrationConfig });

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
        menu_step: nextStep,
        topic: finalState.topic,
        support: finalState.support,
        candidate_name: finalState.candidateName,
        eligibility: finalState.eligibility,
        eligibility_unclear_count: finalState.unclearCount,
        collected_info: buildCollectedInfo(finalState),
        decline_reason: declineReason,
        sent_as: "text",
        result
      }
    });

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        ...(handoff ? { ai_enabled: false, current_stage: "human_handoff" } : {})
      })
      .eq("id", conversationId);

    return { processed: true, ai: false, menu: nextStep, conversationId };
  } catch (error) {
    const sendError = error instanceof Error ? error.message : "Erro desconhecido.";

    // Igual ao bot de menu: fica visível no Inbox como "não enviada", sem menu_step — o
    // estado não avança para uma pergunta que a pessoa nunca recebeu.
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

    await supabase.from("webhook_logs").insert({
      organization_id: organizationId,
      provider: "uazapi",
      event_type: "send_failed",
      payload: { conversationId, error: sendError.slice(0, 300) },
      status: "failed"
    });

    return { processed: true, ai: false, menu: "send_failed", conversationId };
  }
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
  hauzappClienteId,
  checkHistoryWith
}: {
  supabase: SupabaseClient;
  organizationId: string;
  phone: string;
  payload: unknown;
  senderName?: string | null;
  hauzappClienteId?: string | null;
  /** Presente só na entrada automática: se a conversa for nova, confere histórico real no WhatsApp. */
  checkHistoryWith?: UazapiInstanceRef;
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
    // Conversa mesmo nova: se já havia histórico real no WhatsApp (a equipa pode já conhecer
    // esta pessoa de antes deste sistema existir), o bot não assume — nasce pausada, como uma
    // conversa que uma pessoa já estivesse a atender. Falha aberta: erro/demora = assume normal.
    const priorHistory = checkHistoryWith
      ? await hasRecentWhatsappHistory({ supabase, organizationId, instance: checkHistoryWith, phone })
      : false;

    const { data: insertedConversation, error } = await supabase
      .from("conversations")
      .insert({
        organization_id: organizationId,
        contact_id: contactId,
        campaign_id: null,
        status: "open",
        current_stage: "hauzapp_prospection",
        ai_enabled: !priorHistory,
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

    if (priorHistory) {
      await supabase.from("webhook_logs").insert({
        organization_id: organizationId,
        provider: "uazapi",
        event_type: "prior_history_detected",
        payload: { conversationId },
        status: "skipped_auto_engage"
      });
    }
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
