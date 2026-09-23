"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/organization";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { configString } from "@/services/integrations/config";
import type { UazapiConnectionState } from "@/services/uazapi/connection-state";
import {
  configureUazapiWebhook,
  connectUazapiInstance,
  disconnectUazapiInstance,
  getUazapiConnection,
  type UazapiCredentials
} from "@/services/uazapi/instance";

export type UazapiConnectionResult =
  | { ok: true; connection: UazapiConnectionState }
  | { ok: false; error: string };

const idSchema = z.string().uuid();

/**
 * Carrega as credenciais da conexão no servidor. Só admin e gestor podem mexer na
 * conexão: o QR code dá acesso ao número, e quem o ler com outro celular assume a linha.
 */
async function loadCredentials(
  integrationId: string
): Promise<{ ok: true; credentials: UazapiCredentials } | { ok: false; error: string }> {
  if (!idSchema.safeParse(integrationId).success) {
    return { ok: false, error: "Conexão inválida." };
  }

  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);

  if (!profile) {
    return { ok: false, error: "Sessão expirada. Entre novamente." };
  }

  if (profile.role !== "admin" && profile.role !== "manager") {
    return { ok: false, error: "Só administradores e gestores podem conectar números." };
  }

  const { data: integration } = await supabase
    .from("integrations")
    .select("config")
    .eq("id", integrationId)
    .eq("organization_id", profile.organization_id)
    .eq("provider", "uazapi")
    .maybeSingle<{ config: Record<string, unknown> | null }>();

  if (!integration) {
    return { ok: false, error: "Conexão não encontrada." };
  }

  const config = integration.config ?? {};
  const baseUrl = configString(config, ["baseUrl", "base_url"], process.env.UAZAPI_BASE_URL);
  const token = configString(config, ["token", "apiKey", "api_key"]);

  if (!baseUrl || !token) {
    return { ok: false, error: "Falta a URL ou o token da instância nesta conexão." };
  }

  return { ok: true, credentials: { baseUrl, token } };
}

async function getWebhookUrl() {
  const secret = process.env.UAZAPI_WEBHOOK_SECRET;

  if (!secret) {
    return null;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    return null;
  }

  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");

  return `${protocol}://${host}/api/webhooks/uazapi?token=${encodeURIComponent(secret)}`;
}

function toError(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : "Erro ao falar com a Uazapi." };
}

export async function getUazapiConnectionAction(integrationId: string): Promise<UazapiConnectionResult> {
  const loaded = await loadCredentials(integrationId);
  if (!loaded.ok) return loaded;

  try {
    return { ok: true, connection: await getUazapiConnection(loaded.credentials) };
  } catch (error) {
    return toError(error);
  }
}

/**
 * Configura o webhook da instância e pede o QR code (ou o código de pareamento, se
 * vier um telefone). O webhook vem antes para as mensagens já chegarem assim que o
 * celular parear.
 */
export async function startUazapiConnectionAction(
  integrationId: string,
  phone?: string
): Promise<UazapiConnectionResult> {
  const loaded = await loadCredentials(integrationId);
  if (!loaded.ok) return loaded;

  const webhookUrl = await getWebhookUrl();

  if (!webhookUrl) {
    return { ok: false, error: "Defina UAZAPI_WEBHOOK_SECRET no .env do servidor antes de conectar." };
  }

  const pairingPhone = phone ? normalizePhone(phone) : null;

  if (phone && !pairingPhone) {
    return { ok: false, error: "Telefone inválido. Use o número com código do país, ex.: 351912345678." };
  }

  try {
    await configureUazapiWebhook(loaded.credentials, webhookUrl);
    return { ok: true, connection: await connectUazapiInstance(loaded.credentials, pairingPhone) };
  } catch (error) {
    return toError(error);
  }
}

export async function disconnectUazapiAction(integrationId: string): Promise<UazapiConnectionResult> {
  const loaded = await loadCredentials(integrationId);
  if (!loaded.ok) return loaded;

  try {
    await disconnectUazapiInstance(loaded.credentials);
    return { ok: true, connection: await getUazapiConnection(loaded.credentials) };
  } catch (error) {
    return toError(error);
  }
}
