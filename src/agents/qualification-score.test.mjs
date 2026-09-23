import test from "node:test";
import assert from "node:assert/strict";
import { computeDeterministicScore, isDeterministicallyQualified } from "./qualification-score.ts";

test("caso real: sem nenhum fato confirmado, score é 0 (não 100)", () => {
  const score = computeDeterministicScore({ region: null, budget: null, paymentMethod: null });

  assert.equal(score, 0);
  assert.equal(isDeterministicallyQualified(score, false), false);
});

test("um fato confirmado ainda não qualifica", () => {
  const score = computeDeterministicScore({ region: "Cascais", budget: null, paymentMethod: null });

  assert.equal(score, 33);
  assert.equal(isDeterministicallyQualified(score, false), false);
});

test("dois de três fatos já qualifica", () => {
  const score = computeDeterministicScore({ region: "Cascais", budget: 300, paymentMethod: null });

  assert.equal(score, 67);
  assert.equal(isDeterministicallyQualified(score, false), true);
});

test("os três fatos dão 100", () => {
  assert.equal(computeDeterministicScore({ region: "Cascais", budget: 300, paymentMethod: "Multibanco" }), 100);
});

test("pedir visita qualifica mesmo com score baixo", () => {
  assert.equal(isDeterministicallyQualified(0, true), true);
});
