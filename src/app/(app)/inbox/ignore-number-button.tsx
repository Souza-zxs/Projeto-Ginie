"use client";

import { PhoneOff } from "lucide-react";
import { ignoreConversationNumberAction } from "./actions";

export function IgnoreNumberButton({ conversationId }: { conversationId: string }) {
  return (
    <form
      action={ignoreConversationNumberAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Ignorar este número? As próximas mensagens dele deixam de ser gravadas e o bot não responde. Dá para desfazer em Configurações > Números ignorados."
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="conversation_id" value={conversationId} />
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-muted"
      >
        <PhoneOff className="h-3.5 w-3.5" />
        Ignorar este número
      </button>
    </form>
  );
}
