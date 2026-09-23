-- Números que o sistema ignora por completo no WhatsApp: a mensagem não é gravada,
-- não aparece no Inbox e a IA não responde. Pedido da DAR+ (equipa e contactos que
-- não devem ser atendidos pelo agente).
create table if not exists public.ignored_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Normalizado: código do país + número, só dígitos (ex.: 351912345678).
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  note text,
  created_at timestamptz not null default now(),
  unique (organization_id, phone)
);

alter table public.ignored_phone_numbers enable row level security;

-- Telefone é dado pessoal: só admin e gestor leem e editam (LGPD/RGPD, minimização).
create policy "organization managers can read ignored phone numbers"
on public.ignored_phone_numbers for select
to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'manager')
);

create policy "organization managers can write ignored phone numbers"
on public.ignored_phone_numbers for all
to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'manager')
)
with check (organization_id = public.current_user_organization_id());
