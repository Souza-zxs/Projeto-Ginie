import { PageHeader } from "@/components/page-header";
import { getCurrentProfile } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationSettingsPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);

  const { data: organization, error } = profile
    ? await supabase
        .from("organizations")
        .select("name, logo_url, primary_color")
        .eq("id", profile.organization_id)
        .maybeSingle<{ name: string; logo_url: string | null; primary_color: string | null }>()
    : { data: null, error: null };

  return (
    <>
      <PageHeader
        title="Organização"
        description="Deixe o sistema com a cara da sua empresa: nome, logo e cor de destaque."
      />
      <section className="max-w-xl">
        {error ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Nao foi possivel carregar a organizacao: {error.message}. Rode as migrations mais recentes no Supabase.
          </p>
        ) : null}
        <OrganizationForm
          name={organization?.name ?? ""}
          logoUrl={organization?.logo_url ?? null}
          primaryColor={organization?.primary_color ?? null}
        />
      </section>
    </>
  );
}
