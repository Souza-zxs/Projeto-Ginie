import test from "node:test";
import assert from "node:assert/strict";
import { describeServicePeriod, getGreeting, getServicePeriod, isNightTime } from "./service-hours.ts";

// Lisboa no verão (até 25/10/2026) é UTC+1: 08:00Z = 09:00 locais.
const summer = (hhmm) => new Date(`2026-09-22T${hhmm}:00+01:00`); // terça-feira
// No inverno é UTC+0.
const winter = (hhmm) => new Date(`2026-12-15T${hhmm}:00+00:00`); // terça-feira

test("dia útil: limites do horário de atendimento", () => {
  assert.equal(getServicePeriod(summer("07:59")), "closed");
  assert.equal(getServicePeriod(summer("08:00")), "business");
  assert.equal(getServicePeriod(summer("16:29")), "business");
  assert.equal(getServicePeriod(summer("16:30")), "evening");
  assert.equal(getServicePeriod(summer("19:59")), "evening");
  assert.equal(getServicePeriod(summer("20:00")), "closed");
  assert.equal(getServicePeriod(summer("23:30")), "closed");
});

test("usa a hora de Portugal, não a do servidor (verão e inverno)", () => {
  // 15:45 UTC é 16:45 em Lisboa no verão: fim de tarde, não horário de atendimento.
  assert.equal(getServicePeriod(new Date("2026-09-22T15:45:00Z")), "evening");
  // A mesma hora UTC no inverno é 15:45 em Lisboa: dentro do horário.
  assert.equal(getServicePeriod(new Date("2026-12-15T15:45:00Z")), "business");
  assert.equal(getServicePeriod(winter("09:00")), "business");
});

test("fim de semana é sempre fora de horário", () => {
  assert.equal(getServicePeriod(new Date("2026-09-26T11:00:00+01:00")), "closed"); // sábado
  assert.equal(getServicePeriod(new Date("2026-09-27T11:00:00+01:00")), "closed"); // domingo
});

test("virada de dia em Lisboa: 23:30Z de sexta já é sábado em Lisboa", () => {
  assert.equal(getServicePeriod(new Date("2026-09-25T23:30:00Z")), "closed");
});

test("noite é das 20h às 08h, inclusive no fim de semana", () => {
  assert.equal(isNightTime(summer("07:59")), true);
  assert.equal(isNightTime(summer("08:00")), false);
  assert.equal(isNightTime(summer("19:59")), false);
  assert.equal(isNightTime(summer("20:00")), true);
  assert.equal(isNightTime(new Date("2026-09-26T11:00:00+01:00")), false); // sábado de manhã
});

test("cumprimentos de Portugal", () => {
  assert.equal(getGreeting(summer("04:59")), "Boa noite");
  assert.equal(getGreeting(summer("05:00")), "Bom dia");
  assert.equal(getGreeting(summer("11:59")), "Bom dia");
  assert.equal(getGreeting(summer("12:00")), "Boa tarde");
  assert.equal(getGreeting(summer("19:59")), "Boa tarde");
  assert.equal(getGreeting(summer("20:00")), "Boa noite");
});

test("o texto para o agente já traz período e cumprimento", () => {
  const text = describeServicePeriod(summer("21:10"));

  assert.match(text, /FORA do horário de atendimento/);
  assert.match(text, /"Boa noite"/);
});
