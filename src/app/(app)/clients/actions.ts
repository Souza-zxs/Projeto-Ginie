"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/organization";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Apaga um cliente: a conversa (as mensagens saem junto, por cascata), o contacto se não tiver
 * outras conversas, as tarefas agendadas dela e os registos do webhook com o telefone. É o
 * pedido de apagamento do RGPD e a limpeza de testes. Só admin e gestor. Não dá para desfazer.
 */
export async function deleteClientAction(formData: FormData) {
  const conversationId = String(formData.get("conversation_id") ?? "");
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);

  if (!profile || !conversationId || (profile.role !== "admin" && profile.role !== "manager")) {
    return;
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, contact_id, contacts(phone)")
    .eq("id", conversationId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle<{ id: string; contact_id: string | null; contacts: { phone: string } | null }>();

  if (!conversation) {
    return;
  }

  const phone = conversation.contacts?.phone ?? null;

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversation.id)
    .eq("organization_id", profile.organization_id);

  if (error) {
    return;
  }

  if (conversation.contact_id) {
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", conversation.contact_id);

    if (!count) {
      await supabase
        .from("contacts")
        .delete()
        .eq("id", conversation.contact_id)
        .eq("organization_id", profile.organization_id);
    }
  }

  // Limpeza complementar, com a chave de serviço (essas tabelas não têm política de exclusão
  // para o utilizador). Se falhar, o essencial já foi apagado.
  try {
    const admin = createAdminClient();

    await admin.from("scheduled_jobs").delete().eq("organization_id", profile.organization_id).eq("target_id", conversation.id);

    if (phone) {
      await admin
        .from("webhook_logs")
        .delete()
        .eq("provider", "uazapi")
        .or(`organization_id.eq.${profile.organization_id},organization_id.is.null`)
        .like("payload->message->>chatid", `${phone}@%`);
    }
  } catch {
    // Não derruba a ação: a conversa e as mensagens já foram removidas.
  }

  revalidatePath("/clients");
  revalidatePath("/inbox");
}
