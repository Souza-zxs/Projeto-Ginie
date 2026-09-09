import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/lib/auth/organization";

export type OrganizationBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
};

export async function getOrganizationBranding(
  supabase: SupabaseClient
): Promise<OrganizationBranding | null> {
  const { profile } = await getCurrentProfile(supabase);
  if (!profile) return null;

  const { data } = await supabase
    .from("organizations")
    .select("name, logo_url, primary_color")
    .eq("id", profile.organization_id)
    .maybeSingle<{ name: string; logo_url: string | null; primary_color: string | null }>();

  if (!data) return null;

  return { name: data.name, logoUrl: data.logo_url, primaryColor: data.primary_color };
}
