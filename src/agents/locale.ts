// Língua dos agentes e das mensagens automáticas, num lugar só. Cliente atual: Portugal.
// Se o sistema passar a atender outro país, isto vira configuração por organização.

/** Regra de língua enviada ao modelo. Os modelos tendem a imitar a língua das instruções,
 * por isso as instruções fixas dos agentes também estão em português de Portugal.
 *
 * Sem "o senhor"/"a senhora" de propósito: pedir para escolher entre os dois faz o
 * modelo tentar adivinhar o género da pessoa, e ele erra e mistura as formas (ex.:
 * "o senhora poderia..."). A frase é sempre construída sem precisar marcar género. */
export const AGENT_LANGUAGE_RULE =
  'Escreve sempre em português de Portugal, nunca do Brasil, e nunca por "você". Não uses "o senhor" nem "a senhora" e não tentes adivinhar se a pessoa é homem ou mulher: constrói a frase de forma neutra, sem marcar género. Em vez de "poderia o senhor/a senhora dizer-me", escreve "pode dizer-me" ou "poderia dizer-me"; em vez de "ficou satisfeito/satisfeita", usa "ficou satisfeito(a)" só se não houver alternativa, preferindo sempre reformular a frase para não precisar de marcar género. Trata a pessoa pelo nome, quando o souberes, ou sem pronome nenhum. Usa "telemóvel", "morada", "equipa", "contacto", "consigo" e a forma "estou a verificar", nunca o gerúndio ("estou verificando").';
