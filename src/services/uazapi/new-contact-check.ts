import type { SupabaseClient } from "@supabase/supabase-js";
import { withTimeout } from "@/lib/async/with-timeout";
import { configString, getUazapiIntegrationConfig, type UazapiInstanceRef } from "@/services/integrations/config";
import { findUazapiChatHistory } from "@/services/uazapi/instance";

const CHECK_TIMEOUT_MS = 4_000;

/**
 * Antes de o bot falar pela primeira vez com um número novo, verifica se já existia uma
 * conversa real no WhatsApp (a equipa pode já o conhecer de antes deste sistema existir).
 * Falha aberta em 3 camadas (credenciais ausentes, erro de rede, demora) — nunca trava um
 * lead novo por causa de uma falha da Uazapi; o pior caso é o bot assumir sem precisar.
 */
export async function hasRecentWhatsappHistory({
  supabase,
  organizationId,
  instance,
  phone
}: {
  supabase: SupabaseClient;
  organizationId: string;
  instance?: UazapiInstanceRef;
  /** Telefone já normalizado (só dígitos, com código do país). */
  phone: string;
}): Promise<boolean> {
  const config = await getUazapiIntegrationConfig(supabase, organizationId, instance);
  const baseUrl = configString(config, ["baseUrl", "base_url"], process.env.UAZAPI_BASE_URL);
  const token = configString(config, ["token", "apiKey", "api_key"], process.env.UAZAPI_TOKEN);

  if (!baseUrl || !token) {
    return false;
  }

  const chatId = `${phone}@s.whatsapp.net`;

  return withTimeout(
    findUazapiChatHistory({ baseUrl, token }, chatId).then(
      (result) => result.hasHistory,
      () => false
    ),
    CHECK_TIMEOUT_MS,
    false
  );
}
