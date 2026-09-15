import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationConfig = Record<string, unknown>;

export async function getActiveIntegrationConfig(
  supabase: SupabaseClient,
  organizationId: string,
  provider: string
) {
  const { data } = await supabase
    .from("integrations")
    .select("config")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ config: IntegrationConfig | null }>();

  return data?.config ?? {};
}

/**
 * Uazapi permite várias instâncias (números) por organização — diferente da
 * maioria dos providers, que têm uma config única. Quando o webhook informa
 * de qual instância veio a mensagem (`instanceId`), busca a integração cuja
 * config.instanceId bate com isso, para responder pelo MESMO número que
 * recebeu. Sem instanceId (ou sem bater com nenhuma), cai no comportamento
 * antigo — pega a integração Uazapi ativa mais recente — o que mantém
 * organizações com um único número funcionando sem precisar configurar nada.
 */
export async function getUazapiIntegrationConfig(
  supabase: SupabaseClient,
  organizationId: string,
  instanceId?: string | null
) {
  const { data } = await supabase
    .from("integrations")
    .select("config")
    .eq("organization_id", organizationId)
    .eq("provider", "uazapi")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .returns<Array<{ config: IntegrationConfig | null }>>();

  const rows = data ?? [];

  if (instanceId) {
    const match = rows.find((row) => configString(row.config ?? {}, ["instanceId"]) === instanceId);
    if (match) {
      return match.config ?? {};
    }
  }

  return rows[0]?.config ?? {};
}

export function configString(config: IntegrationConfig, keys: string[], fallback?: string | null) {
  for (const key of keys) {
    const value = config[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback ?? null;
}

export function configNumber(config: IntegrationConfig, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = config[key];
    const number = typeof value === "number" ? value : Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return fallback;
}

export function configBoolean(config: IntegrationConfig, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = config[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return ["1", "true", "yes", "sim"].includes(value.trim().toLowerCase());
    }
  }

  return fallback;
}
