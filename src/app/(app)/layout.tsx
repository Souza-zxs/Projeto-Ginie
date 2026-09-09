import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getOrganizationBranding } from "@/lib/branding/get-organization-branding";
import { createClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

export async function generateMetadata() {
  const localMode = !hasSupabasePublicEnv();
  if (localMode) return {};

  const supabase = await createClient();
  const branding = await getOrganizationBranding(supabase);

  return branding ? { title: branding.name } : {};
}

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const localMode = !hasSupabasePublicEnv();

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const branding = localMode ? null : await getOrganizationBranding(supabase);

  return (
    <AppShell
      userEmail={user.email}
      showSignOut={!localMode}
      orgName={branding?.name}
      orgLogoUrl={branding?.logoUrl}
      primaryColor={branding?.primaryColor}
    >
      {localMode ? (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-semibold">Modo local (sem banco de dados).</strong>{" "}
          Supabase nao configurado: a navegacao usa um usuario demo e os dados aparecem
          vazios. Configure <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>{" "}
          para conectar a um banco real.
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
