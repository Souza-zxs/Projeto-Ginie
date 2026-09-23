import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, formatShortDateTime, formatTime, parseLisbonLocalDateTime } from "./datetime.ts";

test("mostra sempre a hora de Lisboa (verão UTC+1, inverno UTC+0)", () => {
  assert.equal(formatDateTime("2026-09-23T15:11:00Z"), "23/09/2026, 16:11");
  assert.equal(formatDateTime("2026-12-15T16:11:00Z"), "15/12/2026, 16:11");
  assert.equal(formatTime("2026-09-23T15:11:00Z"), "16:11");
  assert.equal(formatDate("2026-09-23T23:30:00Z"), "24/09/2026"); // já é dia 24 em Lisboa
  assert.equal(formatShortDateTime("2026-09-23T15:11:00Z"), "23/09, 16:11");
});

test("meia-noite aparece como 00:xx, não 24:xx", () => {
  assert.equal(formatTime("2026-09-23T23:05:00Z"), "00:05");
});

test("valor vazio ou inválido usa o texto de reserva", () => {
  assert.equal(formatDateTime(null), "--");
  assert.equal(formatDateTime("lixo", "Nao informado"), "Nao informado");
});

test("hora digitada no formulário é lida como hora de Lisboa", () => {
  assert.equal(parseLisbonLocalDateTime("2026-09-23T16:00").toISOString(), "2026-09-23T15:00:00.000Z");
  assert.equal(parseLisbonLocalDateTime("2026-12-15T16:00").toISOString(), "2026-12-15T16:00:00.000Z");
  assert.equal(parseLisbonLocalDateTime("2026-09-23T00:30").toISOString(), "2026-09-22T23:30:00.000Z");
  assert.equal(parseLisbonLocalDateTime("2026-09-23T16:00:30").toISOString(), "2026-09-23T15:00:30.000Z");
  assert.equal(parseLisbonLocalDateTime("2026-09-23T16:00Z"), null);
  assert.equal(parseLisbonLocalDateTime(""), null);
});
