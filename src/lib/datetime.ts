// Modelos de linguagem não sabem que horas são a menos que a gente diga.
// Usado para o agente decidir corretamente regras de "fora de horário".
export function formatNowForAgent(timeZone: string = "Europe/Lisbon") {
  const formatted = new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());

  return `${formatted} (hora de Lisboa)`;
}
