import Link from "next/link";
import type { Route } from "next";
import { Contact, MessageCircle, Phone, Search } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getCurrentProfile } from "@/lib/auth/organization";
import { formatDateTime, nowMs } from "@/lib/datetime";
import { formatPhoneForDisplay } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { computeAwaitingSince, formatWaiting } from "@/services/uazapi/awaiting-team";
import { loadConversationHistory } from "@/services/uazapi/history";
import {
  TOPIC_LABELS,
  describeClientStatus,
  splitMenuRequests,
  type MenuRequest,
  type MenuTopic
} from "@/services/uazapi/menu-answers";
import { DeleteClientButton } from "./delete-client-button";

type ClientConversation = {
  id: string;
  ai_enabled: boolean;
  last_message_at: string | null;
  contacts: { name: string | null; phone: string } | null;
};

type SearchParams = { q?: string; topic?: string };

const MAX_CONVERSATIONS = 60;

const TOPICS = Object.keys(TOPIC_LABELS) as MenuTopic[];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const searchQuery = (params.q ?? "").trim().toLowerCase();
  const topicFilter = TOPICS.find((topic) => topic === params.topic) ?? null;
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);

  if (!profile) {
    return (
      <>
        <PageHeader title="Clientes" description="Pessoas que passaram pelo menu do WhatsApp e as respostas que deram." />
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Crie um perfil vinculado a uma organização para ver os clientes.
        </section>
      </>
    );
  }

  const canManage = profile.role === "admin" || profile.role === "manager";

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, ai_enabled, last_message_at, contacts(name, phone)")
    .eq("organization_id", profile.organization_id)
    .eq("channel", "uazapi")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(MAX_CONVERSATIONS)
    .returns<ClientConversation[]>();

  const messagesByConversation = await loadConversationHistory(
    supabase,
    profile.organization_id,
    (conversations ?? []).map((conversation) => conversation.id)
  );
  const renderedAt = nowMs();

  const clients = (conversations ?? [])
    .map((conversation) => {
      const history = messagesByConversation.get(conversation.id) ?? [];
      const requests = splitMenuRequests(history);
      const latest = requests[requests.length - 1] ?? null;

      return {
        conversation,
        latest,
        previous: requests.slice(0, -1).reverse(),
        awaitingSince: computeAwaitingSince(history, !conversation.ai_enabled)
      };
    })
    .filter((client) => client.latest && client.latest.progress !== "no_menu")
    .filter((client) => !topicFilter || client.latest?.topic === topicFilter)
    .filter((client) => {
      if (!searchQuery) {
        return true;
      }

      const haystack = `${client.conversation.contacts?.name ?? ""} ${client.conversation.contacts?.phone ?? ""}`.toLowerCase();

      return haystack.includes(searchQuery);
    });

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Pessoas que passaram pelo menu do WhatsApp, com o número, o nome e as respostas de cada pedido. A página atualiza sozinha."
      />
      <AutoRefresh intervalMs={15_000} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterLink active={!topicFilter} href={buildHref({ q: params.q })}>
            Todos
          </FilterLink>
          {TOPICS.map((topic) => (
            <FilterLink key={topic} active={topicFilter === topic} href={buildHref({ q: params.q, topic })}>
              {TOPIC_LABELS[topic]}
            </FilterLink>
          ))}
        </div>

        <form action="/clients" className="w-full sm:w-72">
          {topicFilter ? <input type="hidden" name="topic" value={topicFilter} /> : null}
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar nome ou telefone"
              className="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
            />
          </label>
        </form>
      </div>

      {clients.length ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {clients.map(({ conversation, latest, previous, awaitingSince }) => {
            const status = describeClientStatus(latest?.progress ?? "no_menu", conversation.ai_enabled);
            const waitingMs = awaitingSince ? renderedAt - awaitingSince.getTime() : null;

            return (
              <article key={conversation.id} className="rounded-lg border bg-card p-5 shadow-sm">
                <header className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-950">
                      {conversation.contacts?.name || "Sem nome"}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {conversation.contacts?.phone ? formatPhoneForDisplay(conversation.contacts.phone) : "Sem número"}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {latest?.topic ? <Badge tone="muted">{TOPIC_LABELS[latest.topic]}</Badge> : null}
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {waitingMs !== null ? (
                      <Badge tone={waitingMs >= 2 * 3_600_000 ? "danger" : "warning"}>
                        Sem resposta há {formatWaiting(waitingMs)}
                      </Badge>
                    ) : null}
                  </div>
                </header>

                {latest ? <RequestAnswers request={latest} className="mt-4" /> : null}

                {previous.length ? (
                  <details className="mt-3 rounded-md border bg-slate-50 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-700">
                      Pedidos anteriores ({previous.length})
                    </summary>
                    <div className="mt-3 space-y-4">
                      {previous.map((request, index) => (
                        <div key={`${request.startedAt}-${index}`}>
                          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDateTime(request.startedAt)}</span>
                            {request.topic ? <Badge tone="muted">{TOPIC_LABELS[request.topic]}</Badge> : null}
                          </div>
                          <RequestAnswers request={request} />
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Última mensagem: {formatDateTime(conversation.last_message_at)}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/inbox?conversation=${conversation.id}` as Route}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-muted"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Abrir conversa
                    </Link>
                    {canManage ? <DeleteClientButton conversationId={conversation.id} /> : null}
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Contact}
          title="Nenhum cliente ainda"
          description="Quando alguém responder ao menu do WhatsApp, aparece aqui com o número, o nome e as respostas."
        />
      )}
    </>
  );
}

function RequestAnswers({ request, className }: { request: MenuRequest; className?: string }) {
  return (
    <div className={className}>
      {request.answers.length ? (
        <dl className="divide-y rounded-md border bg-white">
          {request.answers.map((item, index) => (
            <div key={`${item.question}-${index}`} className="flex items-start justify-between gap-4 px-3 py-2">
              <dt className="shrink-0 text-xs text-muted-foreground">{item.question}</dt>
              <dd className="whitespace-pre-wrap break-words text-right text-sm font-medium text-slate-900">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
          Ainda não respondeu a nenhuma pergunta do menu.
        </p>
      )}
      {request.afterHandoff ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {request.afterHandoff} {request.afterHandoff === 1 ? "mensagem" : "mensagens"} depois do encaminhamento. Veja na
          conversa.
        </p>
      ) : null}
    </div>
  );
}

function FilterLink({ active, href, children }: { active: boolean; href: Route; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-teal-700 bg-teal-700 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50"
      )}
    >
      {children}
    </Link>
  );
}

function buildHref(params: { q?: string; topic?: string }) {
  const search = new URLSearchParams();

  if (params.q) search.set("q", params.q);
  if (params.topic) search.set("topic", params.topic);

  const query = search.toString();

  return `/clients${query ? `?${query}` : ""}` as Route;
}
