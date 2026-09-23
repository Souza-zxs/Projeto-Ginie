import test from "node:test";
import assert from "node:assert/strict";
import { mergeKnownFacts } from "./known-facts.ts";

const fallback = { interest: null, region: null, budget: null, paymentMethod: null, urgency: null };

test("sem known, usa só o extraído e o fallback", () => {
  const result = mergeKnownFacts({ interest: "Formação" }, null, fallback);

  assert.equal(result.interest, "Formação");
  assert.equal(result.region, null);
});

test("null extraído de novo não apaga o que já era conhecido (o bug real observado)", () => {
  const result = mergeKnownFacts(
    { interest: null, region: null },
    { interest: "Auxiliar de geriatria", region: "Cascais" },
    fallback
  );

  assert.equal(result.interest, "Auxiliar de geriatria");
  assert.equal(result.region, "Cascais");
});

test("um valor novo extraído tem prioridade sobre o antigo (atualização)", () => {
  const result = mergeKnownFacts({ region: "Oeiras" }, { region: "Cascais" }, fallback);

  assert.equal(result.region, "Oeiras");
});

test("known nulo em tudo não quebra, cai no fallback", () => {
  const result = mergeKnownFacts(
    {},
    { interest: null, region: null, budget: null, paymentMethod: null, urgency: null },
    fallback
  );

  assert.deepEqual(result, fallback);
});

test("undefined é tratado como ausência de valor, igual a null", () => {
  const result = mergeKnownFacts({ budget: undefined }, { budget: 500 }, fallback);

  assert.equal(result.budget, 500);
});
