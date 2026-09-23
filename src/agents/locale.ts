// Língua dos agentes e das mensagens automáticas, num lugar só. Cliente atual: Portugal.
// Se o sistema passar a atender outro país, isto vira configuração por organização.

/** Regra de língua enviada ao modelo. Os modelos tendem a imitar a língua das instruções,
 * por isso as instruções fixas dos agentes também estão em português de Portugal. */
export const AGENT_LANGUAGE_RULE =
  'Escreve sempre em português de Portugal, nunca do Brasil. Trata o cliente sem pronome ou por "o senhor"/"a senhora", nunca por "você". Usa "telemóvel", "morada", "equipa", "contacto", "consigo" e a forma "estou a verificar", nunca o gerúndio ("estou verificando").';
