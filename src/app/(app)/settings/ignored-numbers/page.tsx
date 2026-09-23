import { PageHeader } from "@/components/page-header";
import { getCurrentProfile } from "@/lib/auth/organization";
import { formatPhoneForDisplay } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { removeIgnoredNumberAction } from "./actions";
import { AddIgnoredNumbersForm } from "./add-numbers-form";

type IgnoredNumberRow = {
  id: string;
  phone: string;
  note: string | null;
  created_at: string;
};

export default async function IgnoredNumbersPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);
  const canManage = profile?.role === "admin" || profile?.role === "manager";

  const { data: numbers, error } =
    profile && canManage
      ? await supabase
          .from("ignored_phone_numbers")
          .select("id, phone, note, created_at")
          .eq("organization_id", profile.organization_id)
          .order("created_at", { ascending: false })
          .returns<IgnoredNumberRow[]>()
      : { data: [], error: null };

  return (
    <>
      <PageHeader
        title="Números ignorados"
        description="Mensagens destes números são ignoradas por completo: não aparecem no Inbox e a IA não responde."
      />

      {!canManage ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Só administradores e gestores podem ver e editar esta lista.
        </p>
      ) : error ? (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Não foi possível carregar a lista. Se a tabela <code>ignored_phone_numbers</code> ainda não foi criada
          no banco, aplique a migration <code>202609230001_ignored_phone_numbers.sql</code>.
        </p>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <AddIgnoredNumbersForm />

          <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Número</th>
                  <th className="px-4 py-3 font-semibold">Observação</th>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {numbers?.length ? (
                  numbers.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-mono text-slate-950">{formatPhoneForDisplay(row.phone)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.note || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <form action={removeIgnoredNumberAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            className="inline-flex h-11 items-center rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100"
                            aria-label={`Remover ${formatPhoneForDisplay(row.phone)} da lista`}
                          >
                            Remover
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum número na lista.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </section>
      )}
    </>
  );
}
