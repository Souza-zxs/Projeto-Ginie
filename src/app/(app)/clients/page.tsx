import Link from "next/link";
import type { Route } from "next";
import { Contact, MessageCircle, Phone, Search } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getCurrentProfile } from "@/lib/auth/organization";
import { formatPhoneForDisplay } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  TOPIC_LABELS,
  detectMenuProgress,
  detectMenuTopic,
  extractMenuAnswers,
  type MenuHistoryMessage,
  type MenuTopic
} from "@/services/uazapi/menu-answers";

type ClientConversation = {
  id: string;
  ai_enabled: boolean;
  last_message_at: string | null;
  contacts: { name: string | null; phone: string } | null;
};

type MessageRow = MenuHistoryMessage & { conversation_id: string };

type SearchParams = { q?: string; topic?: string };

const PAGE_SIZE = 1000;
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

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, ai_enabled, last_message_at, contacts(name, phone)")
    .eq("organization_id", profile.organization_id)
    .eq("channel", "uazapi")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(MAX_CONVERSATIONS)
    .returns<ClientConversation[]>();

  const messagesByConversation = new Map<string, MenuHistoryMessage[]>();
  const ids = (conversations ?? []).map((conversation) => conversation.id);

  // O PostgREST devolve no máximo ~1000 linhas por pedido; pagina até acabar.
  for (let from = 0; ids.length && from < PAGE_SIZE * 5; from += PAGE_SIZE) {
    const { data: page } = await supabase
      .from("messages")
      .select("conversation_id, direction, content, menu_step:payload->>menu_step")
      .eq("organization_id", profile.organization_id)
      .in("conversation_id", ids)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
      .returns<MessageRow[]>();

    for (const row of page ?? []) {
      const list = messagesByConversation.get(row.conversation_id) ?? [];
      list.push(row);
      messagesByConversation.set(row.conversation_id, list);
    }

    if ((page?.length ?? 0) < PAGE_SIZE) {
      break;
    }
  }

  const clients = (conversations ?? [])
    .map((conversation) => {
      const history = messagesByConversation.get(conversation.id) ?? [];

      return {
        conversation,
        answers: extractMenuAnswers(history),
        topic: detectMenuTopic(history),
        progress: detectMenuProgress(history)
      };
    })
    .filter((client) => client.progress !== "no_menu")
    .filter((client) => !topicFilter || client.topic === topicFilter)
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
        description="Pessoas que passaram pelo menu do WhatsApp, com o número, o nome e todas as respostas que deram. A página atualiza sozinha."
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
        <div className="grid gap-4 lg:grid-cols-2">
          {clients.map(({ conversation, answers, topic, progress }) => (
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
                  {topic ? <Badge tone="muted">{TOPIC_LABELS[topic]}</Badge> : null}
                  <Badge tone={progress === "handed_off" ? "warning" : "default"}>
                    {progress === "handed_off" ? "Encaminhado para a equipa" : "A responder ao bot"}
                  </Badge>
                </div>
              </header>

              {answers.length ? (
                <dl className="mt-4 divide-y rounded-md border bg-white">
                  {answers.map((item, index) => (
                    <div key={`${item.question}-${index}`} className="flex items-start justify-between gap-4 px-3 py-2">
                      <dt className="shrink-0 text-xs text-muted-foreground">{item.question}</dt>
                      <dd className="whitespace-pre-wrap break-words text-right text-sm font-medium text-slate-900">
                        {item.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
                  Ainda não respondeu a nenhuma pergunta do menu.
                </p>
              )}

              <footer className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Última mensagem: {formatDate(conversation.last_message_at)}</span>
                <Link
                  href={`/inbox?conversation=${conversation.id}` as Route}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-muted"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Abrir conversa
                </Link>
              </footer>
            </article>
          ))}
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

function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
