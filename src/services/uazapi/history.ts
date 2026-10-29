import type { SupabaseClient } from "@supabase/supabase-js";
import type { MenuTopic } from "@/services/uazapi/menu-answers";

const PAGE_SIZE = 1000;
const MAX_PAGES = 5;

export type ConversationHistoryRow = {
  conversation_id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  menu_step: string | null;
  created_at: string;
  /** Só o agente conversacional livre preenche estes três (ver menu-answers.ts). */
  collected_info: { question: string; answer: string }[] | null;
  topic: MenuTopic | null;
  decline_reason: string | null;
};

/**
 * Mensagens de várias conversas, em ordem cronológica e agrupadas por conversa, só com o que
 * o bot de menu precisa (inclui a etapa do menu, que vem de payload->>menu_step). O PostgREST
 * devolve no máximo ~1000 linhas por pedido, por isso pagina até acabar (limite de segurança).
 */
export async function loadConversationHistory(
  supabase: SupabaseClient,
  organizationId: string,
  conversationIds: string[],
  options: { sinceDays?: number } = {}
) {
  const byConversation = new Map<string, ConversationHistoryRow[]>();

  if (!conversationIds.length) {
    return byConversation;
  }

  const since = options.sinceDays ? new Date(Date.now() - options.sinceDays * 86_400_000).toISOString() : null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabase
      .from("messages")
      .select(
        "conversation_id, direction, content, created_at, menu_step:payload->>menu_step, collected_info:payload->collected_info, topic:payload->>topic, decline_reason:payload->>decline_reason"
      )
      .eq("organization_id", organizationId)
      .in("conversation_id", conversationIds);

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data } = await query
      .order("created_at", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .returns<ConversationHistoryRow[]>();

    for (const row of data ?? []) {
      const list = byConversation.get(row.conversation_id) ?? [];
      list.push(row);
      byConversation.set(row.conversation_id, list);
    }

    if ((data?.length ?? 0) < PAGE_SIZE) {
      break;
    }
  }

  return byConversation;
}
