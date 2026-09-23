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

/** Como o webhook da Uazapi identifica a instância (número) que recebeu a mensagem. */
export type UazapiInstanceRef = {
  /** `token` do payload: é o mesmo token da instância usado para enviar mensagens. */
  token?: string | null;
  /** `instanceName` do payload, comparado com o "Instance ID" cadastrado (opcional). */
  name?: string | null;
};

type UazapiIntegrationRow = { id: string; organization_id: string; config: IntegrationConfig | null };

function matchUazapiRow<T extends { config: IntegrationConfig | null }>(rows: T[], instance?: UazapiInstanceRef) {
  if (instance?.token) {
    const byToken = rows.find((row) => configString(row.config ?? {}, ["token", "apiKey", "api_key"]) === instance.token);
    if (byToken) return byToken;
  }

  if (instance?.name) {
    const byName = rows.find((row) => configString(row.config ?? {}, ["instanceId"]) === instance.name);
    if (byName) return byName;
  }

  return null;
}

/**
 * Uazapi permite várias instâncias (números) por organização, cada uma com seu
 * agente. Para responder pelo MESMO número que recebeu, casa a integração pelo
 * token da instância (vem em todo webhook, sem configuração manual) e, em
 * seguida, pelo Instance ID cadastrado. Sem nenhum dos dois, usa a integração
 * Uazapi ativa mais recente — o que mantém organizações com um número só
 * funcionando sem configurar nada.
 */
export async function getUazapiIntegrationRow(
  supabase: SupabaseClient,
  organizationId: string,
  instance?: UazapiInstanceRef
): Promise<UazapiIntegrationRow | null> {
  const { data } = await supabase
    .from("integrations")
    .select("id, organization_id, config")
    .eq("organization_id", organizationId)
    .eq("provider", "uazapi")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .returns<UazapiIntegrationRow[]>();

  const rows = data ?? [];

  return matchUazapiRow(rows, instance) ?? rows[0] ?? null;
}

export async function getUazapiIntegrationConfig(
  supabase: SupabaseClient,
  organizationId: string,
  instance?: UazapiInstanceRef
) {
  return (await getUazapiIntegrationRow(supabase, organizationId, instance))?.config ?? {};
}

/** Config de uma integração Uazapi específica, pelo id salvo na conversa. */
export async function getIntegrationConfigById(supabase: SupabaseClient, organizationId: string, integrationId: string) {
  const { data } = await supabase
    .from("integrations")
    .select("config")
    .eq("id", integrationId)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .maybeSingle<{ config: IntegrationConfig | null }>();

  return data?.config ?? null;
}

/**
 * Descobre a organização dona da instância que recebeu a mensagem. Precisa do
 * client admin (busca em todas as organizações). Casa SÓ pelo token: o nome da
 * instância pode se repetir entre organizações ("Atendimento") e mandaria a
 * mensagem para a organização errada.
 */
export async function findUazapiOrganizationByToken(supabase: SupabaseClient, token: string | null) {
  if (!token) {
    return null;
  }

  const { data } = await supabase
    .from("integrations")
    .select("id, organization_id, config")
    .eq("provider", "uazapi")
    .eq("active", true)
    .returns<UazapiIntegrationRow[]>();

  return matchUazapiRow(data ?? [], { token })?.organization_id ?? null;
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
