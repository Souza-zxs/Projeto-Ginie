// Quando o bot pausado volta a atender sozinho: só quando quem pausou foi o PRÓPRIO bot (ele
// desistiu de entender, ou terminou o menu e encaminhou, sem ninguém da equipa responder). Nesse
// caso, a pessoa escrevendo depois de 24 horas sem mensagens faz o bot recomeçar pelo menu.
//
// Se foi uma PESSOA da equipa que respondeu (telefone ou Inbox), o bot fica pausado sem prazo,
// até alguém clicar "Ativar bot". O mesmo número de WhatsApp também é usado para conversas
// pessoais e de fornecedores da equipa; sem essa distinção, o bot reaparecia com "Obrigada pelo
// contacto, seja bem-vindo(a) à DAR+" no meio dessas conversas, um dia ou dois depois.
//
// Sem imports, para ser testável sem o Next (bot-resume.test.mjs).

export const BOT_RESUME_AFTER_MS = 24 * 60 * 60 * 1000;

export function shouldResumeBot({
  botActive,
  lastMessageAt,
  lastOutboundWasBot,
  now = new Date()
}: {
  botActive: boolean;
  /** created_at da mensagem mais recente da conversa, lida antes de gravar a que chegou agora. */
  lastMessageAt: string | Date | null | undefined;
  /** false quando a última mensagem enviada foi escrita por uma pessoa (telefone ou Inbox), não pelo bot. */
  lastOutboundWasBot: boolean;
  now?: Date;
}) {
  if (botActive || !lastMessageAt || !lastOutboundWasBot) {
    return false;
  }

  const last = lastMessageAt instanceof Date ? lastMessageAt : new Date(lastMessageAt);

  if (Number.isNaN(last.getTime())) {
    return false;
  }

  return now.getTime() - last.getTime() >= BOT_RESUME_AFTER_MS;
}
