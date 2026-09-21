import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSlotOptions,
  formatVisitConfirmation,
  formatVisitDateTime,
  parseSlotChoice
} from "./slots.ts";

// Lisboa no verão é UTC+1: 09:00Z = 10:00 locais.
const slots = [
  { startsAt: "2026-09-22T09:00:00Z", endsAt: "2026-09-22T09:30:00Z" }, // terça 10:00
  { startsAt: "2026-09-23T09:30:00Z", endsAt: "2026-09-23T10:00:00Z" }, // quarta 10:30
  { startsAt: "2026-09-24T14:00:00Z", endsAt: "2026-09-24T14:30:00Z" } // quinta 15:00
];

test("formata no fuso de Lisboa, com horário de verão", () => {
  assert.equal(formatVisitDateTime(slots[0].startsAt), "terça-feira, 22 de setembro, às 10:00");
});

test("formata no fuso de Lisboa, no inverno (UTC+0)", () => {
  assert.equal(formatVisitDateTime("2026-12-15T10:00:00Z"), "terça-feira, 15 de dezembro, às 10:00");
});

test("meia-noite sai como 00:30 e no dia local correto, nunca 24:30", () => {
  assert.equal(formatVisitDateTime("2026-09-22T23:30:00Z"), "quarta-feira, 23 de setembro, às 00:30");
});

test("as opções saem numeradas e pedem o número", () => {
  const text = formatSlotOptions(slots);

  assert.match(text, /1\) terça-feira, 22 de setembro, às 10:00/);
  assert.match(text, /3\) quinta-feira, 24 de setembro, às 15:00/);
  assert.match(text, /\(1, 2, 3\)/);
});

test("a confirmação repete o horário escolhido", () => {
  assert.match(formatVisitConfirmation(slots[1]), /ficou marcada para quarta-feira, 23 de setembro, às 10:30/);
});

const choose = (text, list = slots) => parseSlotChoice(text, list);

test("escolha por número", () => {
  assert.equal(choose("1"), 0);
  assert.equal(choose("2"), 1);
  assert.equal(choose("3"), 2);
  assert.equal(choose("opção 2"), 1);
  assert.equal(choose("pode ser o 2"), 1);
  assert.equal(choose("quero a 3"), 2);
  assert.equal(choose("2 por favor"), 1);
});

test("número fora das opções não escolhe nada", () => {
  assert.equal(choose("0"), null);
  assert.equal(choose("4"), null);
});

test("'às 3' é hora, não opção, e sem certeza não escolhe", () => {
  assert.equal(choose("às 3"), null);
});

test("escolha por ordinal", () => {
  assert.equal(choose("primeiro"), 0);
  assert.equal(choose("o segundo"), 1);
  assert.equal(choose("a terceira"), 2);
  assert.equal(choose("o último"), 2);
  assert.equal(choose("segunda opção"), 1);
});

test("escolha por dia da semana", () => {
  assert.equal(choose("quarta"), 1);
  assert.equal(choose("pode ser terça"), 0);
  assert.equal(choose("quinta-feira"), 2);
});

test("dia da semana sem opção correspondente não escolhe", () => {
  assert.equal(choose("sábado"), null);
  assert.equal(choose("segunda-feira"), null);
});

test("escolha por hora", () => {
  assert.equal(choose("10:30"), 1);
  assert.equal(choose("10h"), 0);
  assert.equal(choose("quinta às 15h"), 2);
  assert.equal(choose("15h30"), null);
});

test("dia e hora que não batem juntos não escolhem", () => {
  assert.equal(choose("terça às 15h"), null);
  assert.equal(choose("às 11h"), null);
});

test("conversa comum não é escolha", () => {
  assert.equal(choose("não posso nessas datas"), null);
  assert.equal(choose("quero saber o preço"), null);
  assert.equal(choose("segundo me disseram, é caro"), null);
  assert.equal(choose(""), null);
  assert.equal(choose("   "), null);
});

test("com uma única opção, 'sim' confirma; com várias, é ambíguo", () => {
  assert.equal(choose("sim", [slots[0]]), 0);
  assert.equal(choose("ok!", [slots[0]]), 0);
  assert.equal(choose("sim"), null);
});

test("sem opções oferecidas não escolhe nada", () => {
  assert.equal(choose("1", []), null);
});
