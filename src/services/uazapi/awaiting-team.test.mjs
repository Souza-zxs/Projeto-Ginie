import test from "node:test";
import assert from "node:assert/strict";
import { computeAwaitingSince, formatWaiting } from "./awaiting-team.ts";

const at = (hhmm) => `2026-09-24T${hhmm}:00Z`;
const bot = (hhmm, step) => ({ direction: "outbound", menu_step: step, created_at: at(hhmm) });
const human = (hhmm) => ({ direction: "outbound", menu_step: null, created_at: at(hhmm) });
const client = (hhmm) => ({ direction: "inbound", menu_step: null, created_at: at(hhmm) });

test("encaminhado pelo bot e sem resposta: espera desde o encaminhamento", () => {
  const messages = [client("09:00"), bot("09:00", "menu"), client("09:01"), bot("09:01", "awaiting_2"), client("09:02"), bot("09:02", "done")];

  assert.equal(computeAwaitingSince(messages, true)?.toISOString(), "2026-09-24T09:02:00.000Z");
  // Mensagens da pessoa depois do encaminhamento não adiantam a data: conta a mais antiga.
  assert.equal(computeAwaitingSince([...messages, client("09:30"), client("10:00")], true)?.toISOString(), "2026-09-24T09:02:00.000Z");
});

test("a equipa respondeu: deixa de esperar; se a pessoa escreve de novo, volta a esperar", () => {
  const base = [bot("09:00", "menu"), client("09:01"), bot("09:02", "done")];

  assert.equal(computeAwaitingSince([...base, human("09:10")], true), null);
  assert.equal(computeAwaitingSince([...base, human("09:10"), client("11:00")], true)?.toISOString(), "2026-09-24T11:00:00.000Z");
  assert.equal(computeAwaitingSince([...base, human("09:10"), client("11:00"), human("11:05")], true), null);
});

test("equipa respondeu no meio do fluxo (bot pausado): só espera quando a pessoa escreve depois", () => {
  const midFlow = [bot("09:00", "menu"), client("09:01"), bot("09:01", "awaiting_1"), human("09:05")];

  assert.equal(computeAwaitingSince(midFlow, true), null);
  assert.equal(computeAwaitingSince([...midFlow, client("09:20")], true)?.toISOString(), "2026-09-24T09:20:00.000Z");
});

test("conversa com o bot ativo, no meio do fluxo, não está esperando a equipa", () => {
  const messages = [bot("09:00", "menu"), client("09:01"), bot("09:01", "awaiting_1"), client("09:02")];

  assert.equal(computeAwaitingSince(messages, false), null);
  // Pausada por botão, sem resposta humana ainda: não inventa espera.
  assert.equal(computeAwaitingSince(messages, true), null);
});

test("o menu recomeçando (retomada em 24h) zera o ciclo anterior", () => {
  const messages = [bot("09:00", "done"), client("09:30"), bot("09:00", "menu")];

  assert.equal(computeAwaitingSince(messages, false), null);
});

test("datas inválidas são ignoradas", () => {
  const messages = [{ direction: "outbound", menu_step: "done", created_at: "lixo" }];

  assert.equal(computeAwaitingSince(messages, true), null);
});

test("formata a espera", () => {
  assert.equal(formatWaiting(20_000), "instantes");
  assert.equal(formatWaiting(60_000), "1 min");
  assert.equal(formatWaiting(59 * 60_000), "59 min");
  assert.equal(formatWaiting(60 * 60_000), "1 h");
  assert.equal(formatWaiting(135 * 60_000), "2 h 15 min");
  assert.equal(formatWaiting(24 * 60 * 60_000), "1 d");
  assert.equal(formatWaiting(3 * 24 * 60 * 60_000 + 5 * 3_600_000), "3 d");
  assert.equal(formatWaiting(-5), "instantes");
});
