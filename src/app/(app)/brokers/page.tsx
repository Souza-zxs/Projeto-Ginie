import { Badge } from "@/components/badge";
import { PageHeader } from "@/components/page-header";
import { getCurrentProfile } from "@/lib/auth/organization";
import { createClient } from "@/lib/supabase/server";
import { createBrokerAction, toggleBrokerAction } from "./actions";

type BrokerRow = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  priority: number;
  created_at: string;
};

export default async function BrokersPage() {
  const supabase = await createClient();
  const { profile } = await getCurrentProfile(supabase);
  const { data: brokers } = profile
    ? await supabase
        .from("brokers")
        .select("id, name, phone, active, priority, created_at")
        .eq("organization_id", profile.organization_id)
        .order("priority", { ascending: false })
        .returns<BrokerRow[]>()
    : { data: [] };

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Gestão da equipe técnica ativa e prioridades para o rodízio de atendimento."
      />
      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form action={createBrokerAction} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-950">Novo integrante da equipe</h2>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Nome</span>
            <input
              name="name"
              required
              className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-teal-600"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">WhatsApp</span>
            <input
              name="phone"
              required
              placeholder="62999998888"
              className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-teal-600"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Prioridade</span>
            <input
              name="priority"
              type="number"
              min="0"
              max="100"
              defaultValue="0"
              className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-teal-600"
            />
          </label>
          <button
            type="submit"
            className="h-10 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Cadastrar
          </button>
        </form>

        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">Telefone</th>
                <th className="px-4 py-3 font-semibold">Prioridade</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {brokers?.map((broker) => (
                <tr key={broker.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">{broker.name}</td>
                  <td className="px-4 py-3 text-slate-700">{broker.phone}</td>
                  <td className="px-4 py-3 text-slate-700">{broker.priority}</td>
                  <td className="px-4 py-3">
                    <Badge tone={broker.active ? "success" : "muted"}>
                      {broker.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={toggleBrokerAction}>
                      <input type="hidden" name="id" value={broker.id} />
                      <input type="hidden" name="active" value={String(broker.active)} />
                      <button className="rounded-md border px-3 py-1.5 text-xs font-medium">
                        {broker.active ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!brokers?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum integrante cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </section>
    </>
  );
}
