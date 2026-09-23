-- Qual conexão Uazapi (número) uma conversa pertence. Sem isso, a resposta manual pelo
-- Inbox escolhia "a integração Uazapi ativa mais recente" (services/integrations/config.ts),
-- que com mais de uma linha cadastrada podia ser uma linha desconectada — e o envio
-- falhava com uma exceção não tratada, derrubando a página com erro de servidor.
alter table public.conversations
  add column if not exists uazapi_integration_id uuid references public.integrations(id) on delete set null;

create index if not exists conversations_uazapi_integration_idx
  on public.conversations(uazapi_integration_id);
