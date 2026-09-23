"use client";

import { useEffect, useRef } from "react";

// Medido depois de a mensagem nova já estar no DOM, por isso inclui a altura dela.
const NEAR_BOTTOM_PX = 360;

/**
 * Área de mensagens: é a única parte que rola. Ao trocar de conversa vai para o fim; quando
 * chega mensagem nova, só desce se a pessoa já estava perto do fim (não puxa a leitura de
 * quem subiu para ver o histórico).
 */
export function ChatMessages({
  conversationId,
  messageCount,
  children
}: {
  conversationId: string;
  messageCount: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastConversation = useRef<string | null>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const conversationChanged = lastConversation.current !== conversationId;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    const grew = messageCount > lastCount.current;

    if (conversationChanged || (grew && distanceFromBottom <= NEAR_BOTTOM_PX)) {
      element.scrollTop = element.scrollHeight;
    }

    lastConversation.current = conversationId;
    lastCount.current = messageCount;
  }, [conversationId, messageCount]);

  return (
    <div ref={ref} className="max-h-[60vh] flex-1 space-y-3 overflow-y-auto px-5 py-5 xl:max-h-none xl:min-h-0">
      {children}
    </div>
  );
}
