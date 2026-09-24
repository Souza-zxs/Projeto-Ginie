import { withTimeout } from "@/lib/async/with-timeout";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTtlCache } from "@/lib/ttl-cache";
import { configString } from "@/services/integrations/config";
import type { UazapiConnectionState } from "@/services/uazapi/connection-state";
import { getUazapiConnection } from "@/services/uazapi/instance";

export type LineStatus = {
  id: string;
  name: string;
  state: UazapiConnectionState["state"];
};

// O Inbox atualiza a cada 5 s; sem cache, cada atualização iria perguntar à Uazapi.
const stateCache = createTtlCache<LineStatus["state"]>(60_000);
const CHECK_TIMEOUT_MS = 3_000;

/**
 * Estado das linhas (números) Uazapi que já foram usadas em conversas. Linha cadastrada mas
 * nunca usada (ex.: a segunda, ainda por conectar) fica de fora, para o aviso de "desconectada"
 * não ficar sempre aceso. Usa a chave de serviço porque lê o token da instância; o token nunca
 * sai daqui, só o estado volta.
 */
export async function getUazapiLinesStatus(organizationId: string): Promise<LineStatus[]> {
  const admin = createAdminClient();
  const [{ data: integrations }, { data: used }] = await Promise.all([
    admin
      .from("integrations")
      .select("id, name, config")
      .eq("organization_id", organizationId)
      .eq("provider", "uazapi")
      .eq("active", true)
      .returns<Array<{ id: string; name: string | null; config: Record<string, unknown> | null }>>(),
    admin
      .from("conversations")
      .select("uazapi_integration_id")
      .eq("organization_id", organizationId)
      .not("uazapi_integration_id", "is", null)
      .limit(500)
      .returns<Array<{ uazapi_integration_id: string }>>()
  ]);

  const usedIds = new Set((used ?? []).map((row) => row.uazapi_integration_id));

  return Promise.all(
    (integrations ?? [])
      .filter((row) => usedIds.has(row.id))
      .map(async (row): Promise<LineStatus> => {
        const name = row.name || "Linha";
        const cached = stateCache.get(row.id);

        if (cached) {
          return { id: row.id, name, state: cached };
        }

        const config = row.config ?? {};
        const baseUrl = configString(config, ["baseUrl", "base_url"], process.env.UAZAPI_BASE_URL);
        const token = configString(config, ["token", "apiKey", "api_key"]);

        if (!baseUrl || !token) {
          return { id: row.id, name, state: "unknown" };
        }

        const state = await withTimeout<LineStatus["state"]>(
          getUazapiConnection({ baseUrl, token }).then(
            (connection) => connection.state,
            () => "unknown" as const
          ),
          CHECK_TIMEOUT_MS,
          "unknown"
        );

        if (state !== "unknown") {
          stateCache.set(row.id, state);
        }

        return { id: row.id, name, state };
      })
  );
}
