"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createStubClient } from "./stub";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Modo local / degradado: sem env do Supabase usamos o cliente stub.
  if (!supabaseUrl || !supabasePublishableKey) {
    return createStubClient();
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
