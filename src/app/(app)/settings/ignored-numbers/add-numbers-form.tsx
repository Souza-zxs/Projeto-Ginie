"use client";

import { useActionState } from "react";
import { addIgnoredNumbersAction, type AddIgnoredNumbersState } from "./actions";

export function AddIgnoredNumbersForm() {
  const [state, formAction, pending] = useActionState<AddIgnoredNumbersState, FormData>(
    addIgnoredNumbersAction,
    null
  );

  return (
    <form action={formAction} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">Adicionar números</h2>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Números, um por linha</span>
        <textarea
          name="numbers"
          rows={8}
          required
          placeholder={"+351 912 345 678\n+351 963 550 891"}
          className="w-full rounded-md border bg-white px-3 py-2 font-mono text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Observação (opcional)</span>
        <input
          name="note"
          maxLength={200}
          placeholder="Ex.: equipa, cuidadoras"
          className="h-11 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "A guardar…" : "Adicionar à lista"}
      </button>

      <div aria-live="polite" className="space-y-2 text-sm">
        {state?.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-red-700">{state.error}</p> : null}
        {state && !state.error ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800">
            {state.added} número(s) adicionado(s)
            {state.alreadyListed ? `, ${state.alreadyListed} já estava(m) na lista` : ""}.
          </p>
        ) : null}
        {state?.invalid.length ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
            Não reconhecidos (corrija e cole de novo): {state.invalid.join(", ")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
