import test from "node:test";
import assert from "node:assert/strict";
import { buildGroundingText, isGroundedNumber, isGroundedText } from "./extraction-grounding.ts";

test("caso real: 'olá' não fundamenta 'apoio domiciliário' nem 'Lisboa'", () => {
  const text = buildGroundingText([{ direction: "inbound", content: "olá" }]);

  assert.equal(isGroundedText("apoio domiciliário", text), false);
  assert.equal(isGroundedText("Lisboa", text), false);
});

test("caso real: 'teste' não fundamenta nada", () => {
  const text = buildGroundingText([{ direction: "inbound", content: "teste" }]);

  assert.equal(isGroundedText("apoio domiciliário", text), false);
});

test("quando a pessoa realmente diz o dado, é aceite", () => {
  const text = buildGroundingText([
    { direction: "inbound", content: "Preciso de apoio domiciliário para a minha mãe em Lisboa" }
  ]);

  assert.equal(isGroundedText("apoio domiciliário", text), true);
  assert.equal(isGroundedText("Lisboa", text), true);
});

test("aceita variação de acentuação/maiúsculas", () => {
  const text = buildGroundingText([{ direction: "inbound", content: "moro em Cascais" }]);

  assert.equal(isGroundedText("CASCAIS", text), true);
});

test("valor já conhecido de um turno anterior é aceite mesmo sem aparecer agora", () => {
  const text = buildGroundingText([{ direction: "inbound", content: "sim, pode ser essa semana" }]);

  assert.equal(isGroundedText("Cascais", text, "Cascais"), true);
});

test("null nunca precisa de fundamentação", () => {
  const text = buildGroundingText([{ direction: "inbound", content: "olá" }]);

  assert.equal(isGroundedText(null, text), true);
});

test("ignora mensagens outbound (as do próprio agente) na fundamentação", () => {
  const text = buildGroundingText([
    { direction: "outbound", content: "Em que zona vive?" },
    { direction: "inbound", content: "olá" }
  ]);

  assert.equal(isGroundedText("zona", text), false);
});

test("orçamento: dígitos precisam aparecer no texto", () => {
  const text = buildGroundingText([{ direction: "inbound", content: "o orçamento pode ser até 500 euros" }]);

  assert.equal(isGroundedNumber(500, text), true);
  assert.equal(isGroundedNumber(800, text), false);
});

test("orçamento já conhecido antes é aceite mesmo sem repetir o número", () => {
  const text = buildGroundingText([{ direction: "inbound", content: "pode ser" }]);

  assert.equal(isGroundedNumber(500, text, 500), true);
});
