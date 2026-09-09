import { createClient } from "@supabase/supabase-js";
import { createStubClient } from "./stub";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Modo local / degradado: sem env do Supabase usamos o cliente stub.
  if (!supabaseUrl || !serviceRoleKey) {
    return createStubClient();
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
