"use client";

import { Trash2 } from "lucide-react";
import { deleteClientAction } from "./actions";

export function DeleteClientButton({ conversationId }: { conversationId: string }) {
  return (
    <form
      action={deleteClientAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Excluir este cliente? Apaga a conversa e todas as respostas dele, inclusive no Inbox. Não dá para desfazer. Se ele escrever de novo, aparece como cliente novo."
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="conversation_id" value={conversationId} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Excluir cliente
      </button>
    </form>
  );
}
