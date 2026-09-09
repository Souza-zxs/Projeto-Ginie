"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { createClient, hasSupabasePublicEnv } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  redirectTo: z.string().optional()
});

export async function loginAction(_: { error?: string } | null, formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || "/dashboard"
  });

  if (!parsed.success) {
    return { error: "Informe um e-mail valido e senha com pelo menos 6 caracteres." };
  }

  // Modo local / degradado: sem Supabase configurado liberamos o acesso demo.
  if (!hasSupabasePublicEnv()) {
    const destination = parsed.data.redirectTo?.startsWith("/")
      ? parsed.data.redirectTo
      : "/dashboard";
    redirect(destination as Route);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    return { error: "Nao foi possivel entrar. Verifique suas credenciais." };
  }

  const destination = parsed.data.redirectTo?.startsWith("/")
    ? parsed.data.redirectTo
    : "/dashboard";

  redirect(destination as Route);
}
