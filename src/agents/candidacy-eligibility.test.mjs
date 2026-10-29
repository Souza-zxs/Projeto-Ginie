import test from "node:test";
import assert from "node:assert/strict";
import {
  ACADEMY_MESSAGE,
  DECLINE_AGE,
  ELIGIBILITY_ORDER,
  clearCandidacyFact,
  decideCandidacyOutcome,
  declineReasonLabel,
  mergeCandidacyFacts
} from "./candidacy-eligibility.ts";

test("sem nenhum facto resolvido, pede a idade primeiro (uma de cada vez, nesta ordem)", () => {
  const outcome = decideCandidacyOutcome({});

  assert.deepEqual(outcome, { status: "pending", nextField: "age", question: "Tem 18 anos ou mais?" });
  assert.deepEqual(ELIGIBILITY_ORDER, ["age", "q1", "q2", "q3", "q4"]);
});

test("pede os campos seguintes em ordem, um de cada vez, mesmo que a pessoa tenha adiantado tudo", () => {
  // Confirmado: mesmo com várias respostas "adiantadas" de uma vez, o portão só avança quando
  // CADA campo é resolvido individualmente — aqui simulamos a resolução campo a campo.
  assert.deepEqual(decideCandidacyOutcome({ age: "yes" }), { status: "pending", nextField: "q1", question: "Tem experiência como cuidador(a) de idosos?" });
  assert.deepEqual(decideCandidacyOutcome({ age: "yes", q1: "yes" }).nextField, "q2");
  assert.deepEqual(decideCandidacyOutcome({ age: "yes", q1: "yes", q2: "yes" }).nextField, "q3");
  assert.deepEqual(decideCandidacyOutcome({ age: "yes", q1: "yes", q2: "yes", q3: "yes" }).nextField, "q4");
});

test("idade 'não' recusa na hora, mesmo sem mais nenhum facto conhecido", () => {
  assert.deepEqual(decideCandidacyOutcome({ age: "no" }), { status: "declined", message: DECLINE_AGE });
  assert.deepEqual(decideCandidacyOutcome({ age: "no", q1: "yes", q2: "yes" }), { status: "declined", message: DECLINE_AGE });
});

test("as 4 'sim' aprovam", () => {
  assert.deepEqual(decideCandidacyOutcome({ age: "yes", q1: "yes", q2: "yes", q3: "yes", q4: "yes" }), { status: "passed" });
});

test("só a experiência (q1) 'não', com as outras 3 'sim': redireciona para a academia, não é recusa", () => {
  const outcome = decideCandidacyOutcome({ age: "yes", q1: "no", q2: "yes", q3: "yes", q4: "yes" });

  assert.deepEqual(outcome, { status: "academy", message: ACADEMY_MESSAGE });
});

test("q2, q3 ou q4 'não' recusa citando exatamente o que falta, mesmo com q1 também 'não'", () => {
  const onlyQ2 = decideCandidacyOutcome({ age: "yes", q1: "yes", q2: "no", q3: "yes", q4: "yes" });

  assert.equal(onlyQ2.status, "declined");
  assert.match(onlyQ2.message, /autorização para trabalhar em Portugal/);
  assert.doesNotMatch(onlyQ2.message, /recibos verdes/);

  const q3AndQ4 = decideCandidacyOutcome({ age: "yes", q1: "yes", q2: "yes", q3: "no", q4: "no" });

  assert.match(q3AndQ4.message, /recibos verdes/);
  assert.match(q3AndQ4.message, /Lisboa/);
  assert.match(q3AndQ4.message, /poder trabalhar em prestação de serviços \(recibos verdes\); viver em Lisboa/);

  // q2 recusado vale mais que q1 "não" (a recusa cita os requisitos, não manda para a academia).
  const q1AndQ2 = decideCandidacyOutcome({ age: "yes", q1: "no", q2: "no", q3: "yes", q4: "yes" });

  assert.equal(q1AndQ2.status, "declined");
});

test("mergeCandidacyFacts: um 'null' novo nunca apaga um facto já resolvido", () => {
  const known = { age: "yes", q1: "yes" };

  assert.deepEqual(mergeCandidacyFacts({}, known), { age: "yes", q1: "yes", q2: null, q3: null, q4: null });
  assert.deepEqual(mergeCandidacyFacts({ q1: null }, known), { age: "yes", q1: "yes", q2: null, q3: null, q4: null });
});

test("mergeCandidacyFacts: um facto novo genuíno substitui o antigo", () => {
  const known = { age: "yes", q1: null };

  assert.deepEqual(mergeCandidacyFacts({ q1: "no" }, known).q1, "no");
});

test("mergeCandidacyFacts: sem known, usa o fallback e depois null", () => {
  assert.deepEqual(mergeCandidacyFacts({}, null, { age: "yes" }).age, "yes");
  assert.deepEqual(mergeCandidacyFacts({}, null, {}).q1, null);
});

test("declineReasonLabel: mesmos rótulos curtos do bot de menu (ver DECLINE_REASONS em menu-answers.ts)", () => {
  assert.equal(declineReasonLabel({ age: "no" }), "menos de 18 anos");
  assert.equal(declineReasonLabel({ age: "yes", q1: "yes", q2: "no", q3: "yes", q4: "yes" }), "sem autorização de trabalho");
  assert.equal(declineReasonLabel({ age: "yes", q1: "yes", q2: "yes", q3: "no", q4: "no" }), "não aceita recibos verdes, fora de Lisboa");
  assert.equal(declineReasonLabel({ age: "yes", q1: "no", q2: "yes", q3: "yes", q4: "yes" }), null);
  assert.equal(declineReasonLabel({}), null);
});

test("clearCandidacyFact desfaz um facto só, sem tocar nos outros", () => {
  const facts = { age: "yes", q1: "no", q2: "yes" };

  assert.deepEqual(clearCandidacyFact(facts, "q1"), { age: "yes", q2: "yes" });
  assert.deepEqual(facts, { age: "yes", q1: "no", q2: "yes" }); // não muda o original
});
