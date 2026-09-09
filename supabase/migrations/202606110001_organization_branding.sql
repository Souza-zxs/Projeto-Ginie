-- White-label: cada organização pode customizar logo, nome (já existia) e cor primária.
-- RLS de UPDATE em public.organizations já restringe isso a admin/manager
-- (ver policy "admins can update their organization" em 202605090001_initial_schema.sql).

alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists primary_color text,
  add constraint organizations_primary_color_format
    check (primary_color is null or primary_color ~* '^#[0-9a-f]{6}$');

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do update set public = true;

create policy "organization members can upload org logo"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'org-logos'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
);

create policy "organization members can update org logo"
on storage.objects for update
to authenticated
using (
  bucket_id = 'org-logos'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
)
with check (
  bucket_id = 'org-logos'
  and (storage.foldername(name))[1] = public.current_user_organization_id()::text
);

create policy "public can read org logos"
on storage.objects for select
to public
using (bucket_id = 'org-logos');
