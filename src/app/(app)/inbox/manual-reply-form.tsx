"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { sendManualReplyAction, type ManualReplyState } from "./actions";

export function ManualReplyForm({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState<ManualReplyState, FormData>(sendManualReplyAction, null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Limpa o campo só quando o envio deu certo; se falhou, mantém o texto para tentar de novo.
  useEffect(() => {
    if (state && "ok" in state && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [state]);

  return (
    <form action={formAction} className="border-t bg-white p-4">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <div className="flex gap-3">
        <input
          ref={inputRef}
          name="content"
          required
          maxLength={4000}
          placeholder="Responder manualmente..."
          className="h-11 flex-1 rounded-md border bg-white px-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {pending ? "A enviar…" : "Enviar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Ao enviar, o bot fica pausado nesta conversa e só volta se a pessoa escrever depois de 24 horas sem mensagens. Para voltar antes, use “Ativar bot”.</p>
      <p aria-live="polite" className="mt-1 text-sm">
        {state && "error" in state ? <span className="text-red-700">{state.error}</span> : null}
      </p>
    </form>
  );
}
