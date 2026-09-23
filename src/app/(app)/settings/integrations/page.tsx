import { Badge } from "@/components/badge";
import Link from "next/link";
import type { Route } from "next";
import { headers } from "next/headers";
import { PageHeader } from "@/components/page-header";
import { getCurrentProfile } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import {
  deleteUazapiIntegrationAction,
  enqueueHauzappProspectionSyncAction,
  saveHauzappIntegrationAction,
  saveUazapiIntegrationAction,
  toggleUazapiIntegrationAction
} from "./actions";
import { UazapiConnection } from "./uazapi-connection";

type IntegrationRow = {
  id: string;
  provider: string;
  name: string;
  config: Record<string, unknown> | null;
  active: boolean;
  created_at: string;
};

type AgentRow = {
  id: string;
  name: string;
  agent_type: string;
  active: boolean;
};

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);
  const [{ data: integrations }, { data: agents }] = profile
    ? await Promise.all([
        supabase
          .from("integrations")
          .select("id, provider, name, config, active, created_at")
          .eq("organization_id", profile.organization_id)
          .order("created_at", { ascending: false })
          .returns<IntegrationRow[]>(),
        supabase
          .from("ai_agents")
          .select("id, name, agent_type, active")
          .eq("organization_id", profile.organization_id)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .returns<AgentRow[]>()
      ])
    : [{ data: [] }, { data: [] }];
  const hauzapp = getLatestIntegration(integrations ?? [], "hauzapp");
  const uazapiConnections = (integrations ?? []).filter((integration) => integration.provider === "uazapi");
  const leadAgents = (agents ?? []).filter((agent) => agent.agent_type === "lead_meta");
  const agentNameById = new Map((agents ?? []).map((agent) => [agent.id, agent.name]));
  const uazapiWebhookUrl = await getUazapiWebhookUrl();
  // Conectar/desconectar número só para admin e gestor (o QR code dá acesso à linha).
  const canManageConnections = profile?.role === "admin" || profile?.role === "manager";

  return (
    <>
      <PageHeader
        title="Integrações"
        description="Conecte HauzApp e Uazapi sem mexer em JSON ou variáveis técnicas."
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <form action={saveHauzappIntegrationAction} className="space-y-5 rounded-lg border bg-card p-6 shadow-sm">
          <IntegrationTitle
            title="Conexão HauzApp"
            description="Chave da API e sincronização dos negócios do CRM."
            active={Boolean(hauzapp?.active)}
          />

          <Field
            name="apiKey"
            label="Chave de integração HauzApp"
            type="password"
            required={false}
            placeholder={hauzapp?.config?.apiKey ? "Chave salva. Preencha apenas para trocar." : "Cole a chave HauzApp"}
          />

          <input type="hidden" name="prospectionStageId" value={String(configNumber(hauzapp?.config, "prospectionStageId", 0))} />
          <input type="hidden" name="contactStageId" value={String(configNumber(hauzapp?.config, "contactStageId", 2))} />
          <input type="hidden" name="qualifiedStageId" value={String(configNumber(hauzapp?.config, "qualifiedStageId", 3))} />
          <input type="hidden" name="leadAgentId" value={configString(hauzapp?.config, "leadAgentId")} />
          <input type="hidden" name="autoAttendLeadNovo" value={configBoolean(hauzapp?.config, "autoAttendLeadNovo", true) ? "on" : ""} />
          <input type="hidden" name="autoGreetProspects" value={configBoolean(hauzapp?.config, "autoGreetProspects", false) ? "on" : ""} />

          <div className="rounded-md border bg-slate-50 p-4 text-sm text-muted-foreground">
            Funil, agente e follow-ups do inbound ficam no assistente de campanha.
            <Link href={"/campaigns/new" as Route} className="ml-2 font-semibold text-teal-700">
              Criar campanha inbound
            </Link>
          </div>

          <button className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            Salvar HauzApp
          </button>
        </form>

        <div className="space-y-5 rounded-lg border bg-card p-6 shadow-sm">
          <IntegrationTitle
            title="Uazapi WhatsApp"
            description="Cada número é uma conexão separada — dá pra ter várias linhas independentes, cada uma com seu agente."
            active={uazapiConnections.some((connection) => connection.active)}
          />

          {uazapiConnections.length ? (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Instance ID</th>
                    <th className="px-3 py-2">Agente</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {uazapiConnections.map((connection) => {
                    const agentId = configString(connection.config, "leadAgentId");
                    return (
                      <tr key={connection.id}>
                        <td className="px-3 py-2 font-medium text-slate-950">{connection.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">
                          {configString(connection.config, "instanceId") || "não definido"}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {agentId ? agentNameById.get(agentId) ?? "Agente removido" : "Mais recente ativo"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={connection.active ? "success" : "muted"}>
                            {connection.active ? "Ativa" : "Pausada"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <form action={toggleUazapiIntegrationAction}>
                              <input type="hidden" name="id" value={connection.id} />
                              <input type="hidden" name="active" value={String(connection.active)} />
                              <button className="rounded-md border px-2 py-1 text-xs font-semibold">
                                {connection.active ? "Pausar" : "Ativar"}
                              </button>
                            </form>
                            <form action={deleteUazapiIntegrationAction}>
                              <input type="hidden" name="id" value={connection.id} />
                              <button className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                                Excluir
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-md border bg-slate-50 p-3 text-sm text-muted-foreground">
              Nenhuma conexão Uazapi cadastrada ainda.
            </p>
          )}

          {canManageConnections && uazapiConnections.length ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-950">Conectar números</p>
              {uazapiConnections.map((connection) => (
                <UazapiConnection key={connection.id} integrationId={connection.id} name={connection.name} />
              ))}
            </div>
          ) : null}

          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Ao clicar em <b>Conectar</b>, o sistema já aponta o webhook da instância para cá. Não configure
            também o &quot;Webhook Global&quot; no painel da Uazapi: com os dois, cada mensagem chega duas
            vezes. Se precisar configurar à mão, o endereço é:
            <div className="mt-2 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-slate-700">
              {uazapiWebhookUrl}
            </div>
            <p className="mt-2">
              Cada número é reconhecido automaticamente pelo token da instância, então o
              &quot;Instance ID&quot; abaixo é opcional. Para conferir o que chegou, veja{" "}
              <Link href={"/settings/logs" as Route} className="font-semibold text-primary">
                Configurações &gt; Logs
              </Link>
              .
            </p>
          </div>

          <form action={saveUazapiIntegrationAction} className="space-y-4 border-t pt-5">
            <p className="text-sm font-semibold text-slate-950">Nova conexão (ou atualizar por nome)</p>
            <Field name="name" label="Nome interno" placeholder="Uazapi - Vendas" />
            <Field
              name="instanceId"
              label="Instance ID (opcional)"
              placeholder="Nome da instância na Uazapi — só se o token não bastar"
              required={false}
            />
            <Field name="baseUrl" label="URL da Uazapi" placeholder="https://sua-uazapi.com" />
            <Field
              name="token"
              label="Token da instância"
              type="password"
              required={false}
              placeholder="Cole o token dessa instância (obrigatório na primeira vez)"
            />
            <AgentSelect agents={leadAgents} name="leadAgentId" label="Agente que responde por essa linha" />
            <button className="h-10 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              Salvar conexão
            </button>
          </form>
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Sincronização de Prospecção</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Importa negócios em Lead Novo do HauzApp para o CRM e prepara atendimento por IA.
            </p>
          </div>
          <form action={enqueueHauzappProspectionSyncAction}>
            <button className="h-10 rounded-md border bg-white px-4 text-sm font-semibold">
              Sincronizar agora
            </button>
          </form>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Integração</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(integrations ?? []).map((integration) => (
              <tr key={integration.id}>
                <td className="px-4 py-3 font-medium">{integration.name}</td>
                <td className="px-4 py-3">{integration.provider}</td>
                <td className="px-4 py-3">
                  <Badge tone={integration.active ? "success" : "muted"}>
                    {integration.active ? "Ativa" : "Inativa"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function IntegrationTitle({
  title,
  description,
  active
}: {
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Badge tone={active ? "success" : "muted"}>{active ? "Conectada" : "Pendente"}</Badge>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  defaultValue,
  required = true
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        required={required}
        className="h-10 w-full rounded-md border bg-white px-3 text-sm"
      />
    </label>
  );
}

function AgentSelect({
  agents,
  name,
  label,
  selected
}: {
  agents: AgentRow[];
  name: string;
  label: string;
  selected?: string | null;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        name={name}
        defaultValue={selected ?? ""}
        className="h-10 w-full rounded-md border bg-white px-3 text-sm"
      >
        <option value="">Usar agente ativo mais recente</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Endereço do webhook a partir do domínio em que a página foi aberta (atrás do nginx,
 * vem em x-forwarded-host). Antes era um IP fixo em HTTP na porta 8080, que contorna o
 * HTTPS e quebra quando o servidor ou o domínio mudam.
 */
async function getUazapiWebhookUrl() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "app.darmais.pt";
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");

  return `${protocol}://${host}/api/webhooks/uazapi?token=SEU_UAZAPI_WEBHOOK_SECRET`;
}

function getLatestIntegration(integrations: IntegrationRow[], provider: string) {
  return integrations.find((integration) => integration.provider === provider && integration.active);
}

function configString(config: Record<string, unknown> | null | undefined, key: string) {
  const value = config?.[key];
  return typeof value === "string" ? value : "";
}

function configNumber(config: Record<string, unknown> | null | undefined, key: string, fallback: number) {
  const value = Number(config?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function configBoolean(config: Record<string, unknown> | null | undefined, key: string, fallback: boolean) {
  const value = config?.[key];

  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}
