"use client";

import { useActionState, useState } from "react";
import { Building2 } from "lucide-react";
import { updateOrganizationAction } from "./actions";

const DEFAULT_PRIMARY_COLOR = "#0f766e"; // aproxima o --primary padrão do globals.css

export function OrganizationForm({
  name,
  logoUrl,
  primaryColor
}: {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, null);
  const [color, setColor] = useState(primaryColor ?? DEFAULT_PRIMARY_COLOR);
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-slate-700">
        <Building2 className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-slate-950">Marca da organização</h2>
      <p className="text-sm text-muted-foreground">
        Nome, logo e cor primária aparecem no menu lateral e nos botões de destaque assim que salvos.
      </p>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Nome</span>
        <input
          name="name"
          required
          defaultValue={name}
          placeholder="Nome da sua empresa"
          className="h-10 w-full rounded-md border bg-white px-3 text-sm"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Cor primária</span>
        <div className="flex items-center gap-3">
          <input
            name="primary_color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-10 w-14 cursor-pointer rounded-md border bg-white p-1"
          />
          <span className="text-sm text-muted-foreground">{color}</span>
        </div>
      </label>

      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">Logo</span>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview de upload, não precisa de otimização
            <img src={logoPreview} alt="Logo atual" className="h-12 w-auto max-w-[150px] rounded border bg-white object-contain p-1" />
          ) : (
            <div className="flex h-12 w-24 items-center justify-center rounded border bg-slate-50 text-xs text-muted-foreground">
              Sem logo
            </div>
          )}
          <input
            name="logo_file"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setLogoPreview(URL.createObjectURL(file));
            }}
            className="block flex-1 rounded-md border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>
        <p className="text-xs text-muted-foreground">PNG ou JPG, fundo transparente ou branco funciona melhor.</p>
      </div>

      {state?.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <button
        disabled={pending}
        className="h-10 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Salvando..." : "Salvar marca"}
      </button>
    </form>
  );
}
