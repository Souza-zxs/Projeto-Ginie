import test from "node:test";
import assert from "node:assert/strict";
import { getAvailableWindows } from "./slots.ts";

const morning = { monday: [{ start: "08:00", end: "12:00" }] };
const starts = (windows) => windows.map((window) => window.startsAt);

test("verão: 08:00 em Lisboa é 07:00Z (UTC+1)", () => {
  const start = new Date("2026-09-28T00:00:00Z"); // segunda-feira
  const windows = getAvailableWindows({ start, now: start, availability: morning, days: 1 });

  assert.deepEqual(starts(windows), [
    "2026-09-28T07:00:00.000Z",
    "2026-09-28T07:30:00.000Z",
    "2026-09-28T08:00:00.000Z",
    "2026-09-28T08:30:00.000Z",
    "2026-09-28T09:00:00.000Z",
    "2026-09-28T09:30:00.000Z"
  ]);
});

test("inverno: 08:00 em Lisboa é 08:00Z (UTC+0)", () => {
  const start = new Date("2026-12-14T00:00:00Z"); // segunda-feira
  const windows = getAvailableWindows({ start, now: start, availability: morning, days: 1 });

  assert.equal(windows[0].startsAt, "2026-12-14T08:00:00.000Z");
});

test("no dia em que o relógio recua (25/10/2026) o cálculo já usa UTC+0", () => {
  const start = new Date("2026-10-25T00:00:00Z"); // domingo
  const windows = getAvailableWindows({
    start,
    now: start,
    availability: { sunday: [{ start: "08:00", end: "09:00" }] },
    days: 1
  });

  assert.deepEqual(starts(windows), ["2026-10-25T08:00:00.000Z", "2026-10-25T08:30:00.000Z"]);
});

test("horários que já passaram não são oferecidos", () => {
  const start = new Date("2026-09-28T00:00:00Z");
  const now = new Date("2026-09-28T07:45:00Z"); // 08:45 em Lisboa
  const windows = getAvailableWindows({ start, now, availability: morning, days: 1 });

  assert.equal(windows[0].startsAt, "2026-09-28T08:00:00.000Z"); // o primeiro livre é 09:00 em Lisboa
});

test("uma visita já confirmada tira aquele horário da oferta", () => {
  const start = new Date("2026-09-28T00:00:00Z");
  const busy = [{ startsAt: "2026-09-28T07:00:00.000Z", endsAt: "2026-09-28T07:30:00.000Z" }];
  const windows = getAvailableWindows({ start, now: start, availability: morning, days: 1, busy });

  assert.equal(windows[0].startsAt, "2026-09-28T07:30:00.000Z");
  assert.ok(!starts(windows).includes("2026-09-28T07:00:00.000Z"));
});

test("sobreposição parcial também bloqueia os dois horários que ela toca", () => {
  const start = new Date("2026-09-28T00:00:00Z");
  const busy = [{ startsAt: "2026-09-28T07:15:00.000Z", endsAt: "2026-09-28T07:45:00.000Z" }];
  const windows = getAvailableWindows({ start, now: start, availability: morning, days: 1, busy });

  assert.equal(windows[0].startsAt, "2026-09-28T08:00:00.000Z");
});

test("um horário que só encosta no fim da visita ocupada continua livre", () => {
  const start = new Date("2026-09-28T00:00:00Z");
  const busy = [{ startsAt: "2026-09-28T07:00:00.000Z", endsAt: "2026-09-28T07:30:00.000Z" }];
  const windows = getAvailableWindows({ start, now: start, availability: morning, days: 1, busy });

  assert.ok(starts(windows).includes("2026-09-28T07:30:00.000Z"));
});

test("dia sem disponibilidade configurada não gera horários", () => {
  const start = new Date("2026-09-27T00:00:00Z"); // domingo
  const windows = getAvailableWindows({ start, now: start, availability: morning, days: 1 });

  assert.deepEqual(windows, []);
});

test("devolve no máximo 6 horários", () => {
  const start = new Date("2026-09-28T00:00:00Z");
  const windows = getAvailableWindows({
    start,
    now: start,
    availability: { monday: [{ start: "08:00", end: "18:00" }] },
    days: 1
  });

  assert.equal(windows.length, 6);
});
