import Link from "next/link";
import type { Route } from "next";
import {
  Bot,
  Clock3,
  FileText,
  MessageCircle,
  Phone,
  Search,
  Send,
  UserRound
} from "lucide-react";
import { Badge } from "@/components/badge";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/auth/organization";
import { formatPhoneForDisplay } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import {
  TOPIC_LABELS,
  detectMenuProgress,
  detectMenuTopic,
  extractMenuAnswers
} from "@/services/uazapi/menu-answers";
import { AgentTester } from "./agent-tester";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChatMessages } from "./chat-messages";
import { ManualReplyForm } from "./manual-reply-form";
import { toggleAiAction } from "./actions";

type ConversationRow = {
  id: string;
  status: string;
  current_stage: string;
  channel: string | null;
  ai_enabled: boolean;
  last_message_at: string | null;
  contacts: {
    name: string | null;
    phone: string;
  } | null;
};

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "audio" | "video" | "document" | "template";
  content: string | null;
  media_url: string | null;
  status: string;
  created_at: string;
  menu_step: string | null;
};

type SearchParams = {
  conversation?: string;
  q?: string;
  channel?: string;
};

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const selectedConversationId = params.conversation;
  const searchQuery = (params.q ?? "").trim();
  const channelFilter = params.channel ?? "all";
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);

  if (!profile) {
    return (
      <>
        <PageHeader title="Inbox" description="Conversas recebidas pelo WhatsApp e canais integrados." />
        <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Crie um perfil vinculado a uma organizacao para usar a Inbox.
        </section>
      </>
    );
  }

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, status, current_stage, channel, ai_enabled, last_message_at, contacts(name, phone)")
    .eq("organization_id", profile.organization_id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100)
    .returns<ConversationRow[]>();

  const { data: testableAgents } = await supabase
    .from("ai_agents")
    .select("id, name, agent_type")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .returns<Array<{ id: string; name: string; agent_type: string }>>();

  const allConversations = conversations ?? [];
  const filteredConversations = allConversations.filter((conversation) => {
    const haystack = [
      conversation.contacts?.name,
      conversation.contacts?.phone,
      conversation.current_stage,
      conversation.status
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
    const matchesChannel =
      channelFilter === "all" ||
      (channelFilter === "ai" && conversation.ai_enabled) ||
      conversation.channel === channelFilter;

    return matchesSearch && matchesChannel;
  });

  const selected = filteredConversations.find((conversation) => conversation.id === selectedConversationId);
  const activeConversation = selected ?? filteredConversations[0] ?? allConversations[0] ?? null;

  const { data: messages } = activeConversation
    ? await supabase
        .from("messages")
        .select("id, direction, type, content, media_url, status, created_at, menu_step:payload->>menu_step")
        .eq("organization_id", profile.organization_id)
        .eq("conversation_id", activeConversation.id)
        .order("created_at", { ascending: true })
        .returns<MessageRow[]>()
    : { data: [] };

  const openCount = allConversations.filter((conversation) => conversation.status !== "closed").length;
  const aiCount = allConversations.filter((conversation) => conversation.ai_enabled).length;
  const metaCount = allConversations.filter((conversation) => conversation.channel === "meta").length;
  const uazapiCount = allConversations.filter((conversation) => conversation.channel === "uazapi").length;

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Conversas de WhatsApp. A página atualiza sozinha a cada 5 segundos."
      />
      <AutoRefresh intervalMs={5_000} />

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <Metric icon={<MessageCircle className="h-4 w-4" />} label="Abertas" value={String(openCount)} />
        <Metric icon={<Bot className="h-4 w-4" />} label="IA ativa" value={String(aiCount)} />
        <Metric icon={<Send className="h-4 w-4" />} label="Meta" value={String(metaCount)} />
        <Metric icon={<Phone className="h-4 w-4" />} label="Uazapi" value={String(uazapiCount)} />
      </section>

      <div className="mb-5">
        <AgentTester agents={testableAgents ?? []} />
      </div>

      <section className="grid overflow-hidden rounded-lg border bg-card shadow-sm xl:h-[calc(100vh-9rem)] xl:min-h-[600px] xl:grid-cols-[360px_minmax(0,1fr)_340px]">
        <aside className="flex min-h-0 flex-col border-r bg-white">
          <div className="shrink-0 border-b p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Conversas</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {filteredConversations.length} de {allConversations.length}
                </p>
              </div>
              <Badge tone="muted">{channelLabel(channelFilter)}</Badge>
            </div>

            <form className="mt-4" action="/inbox">
              {channelFilter !== "all" ? <input type="hidden" name="channel" value={channelFilter} /> : null}
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Buscar nome ou telefone"
                  className="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
                />
              </label>
            </form>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <FilterLink active={channelFilter === "all"} href={buildInboxHref({ q: searchQuery })}>
                Todas
              </FilterLink>
              <FilterLink active={channelFilter === "meta"} href={buildInboxHref({ q: searchQuery, channel: "meta" })}>
                Meta
              </FilterLink>
              <FilterLink active={channelFilter === "uazapi"} href={buildInboxHref({ q: searchQuery, channel: "uazapi" })}>
                Uazapi
              </FilterLink>
              <FilterLink active={channelFilter === "ai"} href={buildInboxHref({ q: searchQuery, channel: "ai" })}>
                IA ativa
              </FilterLink>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto xl:max-h-none xl:min-h-0 xl:flex-1">
            {filteredConversations.length ? (
              filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeConversation?.id}
                  href={buildInboxHref({
                    conversation: conversation.id,
                    q: searchQuery,
                    channel: channelFilter === "all" ? undefined : channelFilter
                  })}
                />
              ))
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                Nenhuma conversa encontrada com esses filtros.
              </div>
            )}
          </div>
        </aside>

        <main className="flex min-h-[480px] min-w-0 flex-col bg-slate-50 xl:min-h-0">
          {activeConversation ? (
            <>
              <ChatHeader conversation={activeConversation} />
              <ConversationActions conversation={activeConversation} />

              <ChatMessages conversationId={activeConversation.id} messageCount={messages?.length ?? 0}>
                {messages?.length ? (
                  messages.map((message) => <MessageBubble key={message.id} message={message} />)
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem mensagens nesta conversa.
                  </div>
                )}
              </ChatMessages>

              <ManualReplyForm conversationId={activeConversation.id} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Selecione uma conversa para visualizar as mensagens.
            </div>
          )}
        </main>

        <aside className="min-h-0 overflow-hidden border-l bg-white">
          {activeConversation ? (
            <ClientPanel conversation={activeConversation} messages={messages ?? []} />
          ) : (
            <div className="p-5 text-sm text-muted-foreground">Nenhum atendimento selecionado.</div>
          )}
        </aside>
      </section>
    </>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <span className="rounded-md bg-muted p-2 text-slate-700">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function FilterLink({
  active,
  href,
  children
}: {
  active: boolean;
  href: Route;
  children: React.ReactNode;
}) {
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

function ConversationItem({
  conversation,
  active,
  href
}: {
  conversation: ConversationRow;
  active: boolean;
  href: Route;
}) {
  const name = conversation.contacts?.name || "Sem nome";
  const initials = getInitials(name);

  return (
    <Link
      href={href}
      className={cn(
        "block border-b px-4 py-4 transition hover:bg-slate-50",
        active && "border-l-4 border-l-teal-700 bg-teal-50/70 pl-3"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{conversation.contacts?.phone}</p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatShortDate(conversation.last_message_at)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={conversation.channel === "uazapi" ? "success" : "muted"}>
              {channelLabel(conversation.channel)}
            </Badge>
            <Badge tone={conversation.ai_enabled ? "success" : "muted"}>
              IA {conversation.ai_enabled ? "on" : "off"}
            </Badge>
            <Badge tone="muted">{conversation.current_stage}</Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ChatHeader({ conversation }: { conversation: ConversationRow }) {
  const name = conversation.contacts?.name || "Sem nome";

  return (
    <header className="border-b bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-950">{name}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {conversation.contacts?.phone}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge tone={conversation.channel === "uazapi" ? "success" : "muted"}>{channelLabel(conversation.channel)}</Badge>
          <Badge tone={conversation.ai_enabled ? "success" : "muted"}>
            IA {conversation.ai_enabled ? "ativa" : "pausada"}
          </Badge>
          <Badge tone="muted">{conversation.status}</Badge>
        </div>
      </div>
    </header>
  );
}

function ConversationActions({ conversation }: { conversation: ConversationRow }) {
  return (
    <div className="flex flex-wrap gap-2 border-b bg-white px-5 py-3">
      <form action={toggleAiAction}>
        <input type="hidden" name="conversation_id" value={conversation.id} />
        <input type="hidden" name="ai_enabled" value={String(conversation.ai_enabled)} />
        <button className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-muted">
          <Bot className="h-3.5 w-3.5" />
          {conversation.ai_enabled ? "Pausar bot" : "Ativar bot"}
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageRow }) {
  const outbound = message.direction === "outbound";

  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-lg px-4 py-3 text-sm shadow-sm",
          outbound
            ? "bg-teal-700 text-white"
            : "border border-slate-200 bg-white text-slate-900"
        )}
      >
        <MessageBody message={message} />
        <div
          className={cn(
            "mt-2 flex items-center gap-2 text-[11px]",
            outbound ? "text-teal-50/80" : "text-muted-foreground"
          )}
        >
          <Clock3 className="h-3 w-3" />
          <span>{formatMessageTime(message.created_at)}</span>
          <span>{message.status}</span>
        </div>
      </div>
    </div>
  );
}

function ClientPanel({
  conversation,
  messages
}: {
  conversation: ConversationRow;
  messages: MessageRow[];
}) {
  const answers = extractMenuAnswers(messages);
  const topic = detectMenuTopic(messages);
  const progress = detectMenuProgress(messages);
  const name = conversation.contacts?.name || "Sem nome";

  return (
    <div className="max-h-[740px] overflow-y-auto p-5 xl:h-full xl:max-h-none">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950">{name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {conversation.contacts?.phone ? formatPhoneForDisplay(conversation.contacts.phone) : "Sem número"}
          </p>
        </div>
      </div>

      <div className="space-y-4 py-4">
        <PanelSection title="Pedido">
          <div className="flex flex-wrap gap-2">
            {topic ? <Badge tone="muted">{TOPIC_LABELS[topic]}</Badge> : null}
            {progress !== "no_menu" ? (
              <Badge tone={progress === "handed_off" ? "warning" : "default"}>
                {progress === "handed_off" ? "Encaminhado para a equipa" : "A responder ao bot"}
              </Badge>
            ) : null}
          </div>
        </PanelSection>

        <PanelSection title="Respostas do menu">
          {answers.length ? (
            answers.map((item, index) => (
              <div key={`${item.question}-${index}`} className="rounded-md border bg-white px-3 py-2">
                <p className="text-xs text-muted-foreground">{item.question}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-900">{item.answer}</p>
              </div>
            ))
          ) : (
            <p className="rounded-md bg-slate-50 p-3 text-sm text-muted-foreground">
              Ainda não respondeu a nenhuma pergunta do menu.
            </p>
          )}
        </PanelSection>

        <PanelSection title="Atendimento">
          <InfoRow label="Canal" value={channelLabel(conversation.channel)} />
          <InfoRow label="Última interação" value={formatLongDate(conversation.last_message_at)} />
          <InfoRow label="Bot" value={conversation.ai_enabled ? "Ativo" : "Pausado"} />
        </PanelSection>
      </div>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border bg-white px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[180px] text-right text-xs font-medium text-slate-800">{value}</span>
    </div>
  );
}

function MessageBody({ message }: { message: MessageRow }) {
  const mediaSrc = message.media_url ? `/api/messages/${message.id}/media` : null;

  if (message.type === "image" && mediaSrc) {
    return (
      <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaSrc} alt={message.content || "Imagem recebida"} className="max-h-80 rounded-md object-contain" />
        {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
      </div>
    );
  }

  if (message.type === "video" && mediaSrc) {
    return (
      <div className="space-y-2">
        <video src={mediaSrc} controls className="max-h-80 w-full rounded-md" />
        {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
      </div>
    );
  }

  if (message.type === "audio" && mediaSrc) {
    return (
      <div className="space-y-2">
        <audio src={mediaSrc} controls className="w-full" />
        {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}
      </div>
    );
  }

  if (message.type === "document" && mediaSrc) {
    return (
      <a href={mediaSrc} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline">
        <FileText className="h-4 w-4" />
        {message.content || "Abrir documento"}
      </a>
    );
  }

  return <p className="whitespace-pre-wrap leading-6">{message.content || "Midia recebida"}</p>;
}

function buildInboxHref(params: { conversation?: string; q?: string; channel?: string }) {
  const search = new URLSearchParams();

  if (params.conversation) {
    search.set("conversation", params.conversation);
  }

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.channel && params.channel !== "all") {
    search.set("channel", params.channel);
  }

  const query = search.toString();
  return `/inbox${query ? `?${query}` : ""}` as Route;
}

function channelLabel(channel?: string | null) {
  if (channel === "uazapi") {
    return "Uazapi";
  }

  if (channel === "meta") {
    return "Meta";
  }

  if (channel === "ai") {
    return "IA ativa";
  }

  if (channel === "all") {
    return "Todos";
  }

  return channel || "WhatsApp";
}

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "LD";
}

function formatShortDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatLongDate(value: string | null) {
  if (!value) {
    return "Nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
