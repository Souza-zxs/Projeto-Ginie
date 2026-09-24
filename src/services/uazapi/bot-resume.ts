// Quando o bot pausado volta a atender: a pessoa escreve depois de 24 horas sem nenhuma
// mensagem na conversa (dela, do bot ou da equipa). Cada resposta manual da equipa é uma
// mensagem nova e reinicia a contagem, por isso enquanto a equipa mantém a conversa viva o
// bot continua fora. Sem imports, para ser testável sem o Next (bot-resume.test.mjs).

export const BOT_RESUME_AFTER_MS = 24 * 60 * 60 * 1000;

export function shouldResumeBot({
  botActive,
  lastMessageAt,
  now = new Date()
}: {
  botActive: boolean;
  /** created_at da mensagem mais recente da conversa, lida antes de gravar a que chegou agora. */
  lastMessageAt: string | Date | null | undefined;
  now?: Date;
}) {
  if (botActive || !lastMessageAt) {
    return false;
  }

  const last = lastMessageAt instanceof Date ? lastMessageAt : new Date(lastMessageAt);

  if (Number.isNaN(last.getTime())) {
    return false;
  }

  return now.getTime() - last.getTime() >= BOT_RESUME_AFTER_MS;
}
