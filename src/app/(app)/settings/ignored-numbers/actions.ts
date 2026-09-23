"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/organization";
import { parsePhoneList } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type AddIgnoredNumbersState = {
  added: number;
  alreadyListed: number;
  invalid: string[];
  error?: string;
} | null;

const addSchema = z.object({
  numbers: z.string().max(10_000, "Lista grande demais. Cole no máximo algumas centenas de números."),
  note: z.string().max(200).optional()
});

async function loadManager() {
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);

  if (!profile || (profile.role !== "admin" && profile.role !== "manager")) {
    return { supabase, profile: null };
  }

  return { supabase, profile };
}

export async function addIgnoredNumbersAction(
  _previous: AddIgnoredNumbersState,
  formData: FormData
): Promise<AddIgnoredNumbersState> {
  const parsed = addSchema.safeParse({
    numbers: formData.get("numbers") ?? "",
    note: (formData.get("note") as string | null)?.trim() || undefined
  });

  if (!parsed.success) {
    return { added: 0, alreadyListed: 0, invalid: [], error: parsed.error.issues[0]?.message };
  }

  const { supabase, profile } = await loadManager();

  if (!profile) {
    return { added: 0, alreadyListed: 0, invalid: [], error: "Só administradores e gestores podem editar esta lista." };
  }

  const { valid, invalid } = parsePhoneList(parsed.data.numbers);

  if (!valid.length) {
    return { added: 0, alreadyListed: 0, invalid, error: invalid.length ? undefined : "Cole pelo menos um número." };
  }

  const { data: existing, error: readError } = await supabase
    .from("ignored_phone_numbers")
    .select("phone")
    .eq("organization_id", profile.organization_id)
    .in("phone", valid)
    .returns<Array<{ phone: string }>>();

  if (readError) {
    return { added: 0, alreadyListed: 0, invalid, error: "Não foi possível ler a lista. A tabela já foi criada no banco?" };
  }

  const listed = new Set((existing ?? []).map((row) => row.phone));
  const toAdd = valid.filter((phone) => !listed.has(phone));

  if (toAdd.length) {
    const { error } = await supabase.from("ignored_phone_numbers").upsert(
      toAdd.map((phone) => ({
        organization_id: profile.organization_id,
        phone,
        note: parsed.data.note ?? null
      })),
      { onConflict: "organization_id,phone", ignoreDuplicates: true }
    );

    if (error) {
      return { added: 0, alreadyListed: listed.size, invalid, error: `Não foi possível guardar: ${error.message}` };
    }
  }

  revalidatePath("/settings/ignored-numbers");

  return { added: toAdd.length, alreadyListed: listed.size, invalid };
}

export async function removeIgnoredNumberAction(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const { supabase, profile } = await loadManager();
  if (!profile) return;

  await supabase
    .from("ignored_phone_numbers")
    .delete()
    .eq("id", id.data)
    .eq("organization_id", profile.organization_id);

  revalidatePath("/settings/ignored-numbers");
}
