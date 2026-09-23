import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";

/** Data da mensagem mais recente recebida de um contacto; alimenta o ponto vermelho do Inbox. */
export async function GET() {
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("messages")
    .select("created_at")
    .eq("organization_id", profile.organization_id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();

  return NextResponse.json(
    { latestInboundAt: data?.created_at ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
