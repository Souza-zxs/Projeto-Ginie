import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * true se o número está na lista de ignorados da organização (tabela ignored_phone_numbers).
 *
 * Sem organização identificada (token da instância não bateu com nenhuma conexão), confere
 * em todas: na dúvida, ignorar um número que alguém pediu para ignorar é o lado seguro.
 *
 * Se a consulta falhar (ex.: migration ainda não aplicada), responde false: melhor atender
 * do que deixar de responder a todo mundo por causa de uma tabela que não existe.
 */
export async function isIgnoredPhone(supabase: SupabaseClient, phone: string, organizationId: string | null) {
  let query = supabase.from("ignored_phone_numbers").select("id").eq("phone", phone).limit(1);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query.maybeSingle<{ id: string }>();

  return !error && Boolean(data);
}
