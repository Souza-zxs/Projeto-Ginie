"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/organization";
import { isValidHexColor } from "@/lib/branding/color";
import { createClient } from "@/lib/supabase/server";

type OrganizationActionState = {
  error?: string;
  success?: string;
};

const organizationSchema = z.object({
  name: z.string().min(2, "Informe o nome da organização."),
  primary_color: z
    .string()
    .optional()
    .transform((value) => (value ? value.trim() : undefined))
    .refine((value) => !value || isValidHexColor(value), "Cor inválida. Use o seletor de cor.")
});

export async function updateOrganizationAction(
  _: OrganizationActionState | null,
  formData: FormData
): Promise<OrganizationActionState> {
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    primary_color: formData.get("primary_color") || undefined
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  }

  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);

  if (!profile) {
    return { error: "Perfil/organizacao nao encontrado. Faca login novamente." };
  }

  let logoUrl: string | undefined;
  try {
    logoUrl = await uploadOrgLogo({ supabase, formData, organizationId: profile.organization_id });
  } catch (error) {
    return {
      error: error instanceof Error ? `Falha ao enviar o logo: ${error.message}` : "Falha ao enviar o logo."
    };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      primary_color: parsed.data.primary_color ?? null,
      ...(logoUrl ? { logo_url: logoUrl } : {})
    })
    .eq("id", profile.organization_id);

  if (error) {
    return {
      error:
        error.code === "42501" || error.message.toLowerCase().includes("row-level security")
          ? "Apenas administradores podem editar a organização."
          : error.message
    };
  }

  revalidatePath("/settings/organization");
  revalidatePath("/", "layout");
  return { success: "Marca atualizada com sucesso." };
}

async function uploadOrgLogo({
  supabase,
  formData,
  organizationId
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  formData: FormData;
  organizationId: string;
}): Promise<string | undefined> {
  const file = formData.get("logo_file");
  if (!(file instanceof File) || file.size === 0) return undefined;

  const safeName = sanitizeFileName(file.name);
  const storagePath = `${organizationId}/logo-${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("org-logos")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from("org-logos").getPublicUrl(storagePath);
  return data.publicUrl;
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
