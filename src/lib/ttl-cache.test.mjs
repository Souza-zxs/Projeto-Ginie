import test from "node:test";
import assert from "node:assert/strict";
import { createTtlCache } from "./ttl-cache.ts";

test("guarda o valor até a validade e depois esquece", () => {
  let clock = 1_000;
  const cache = createTtlCache(60_000, () => clock);

  assert.equal(cache.get("a"), undefined);

  cache.set("a", "connected");
  assert.equal(cache.get("a"), "connected");

  clock += 59_999;
  assert.equal(cache.get("a"), "connected");

  clock += 1;
  assert.equal(cache.get("a"), undefined);
});

test("chaves diferentes não se misturam, e gravar de novo renova a validade", () => {
  let clock = 0;
  const cache = createTtlCache(10, () => clock);

  cache.set("x", 1);
  cache.set("y", 2);
  clock = 9;
  cache.set("x", 3);
  clock = 15;

  assert.equal(cache.get("y"), undefined);
  assert.equal(cache.get("x"), 3);
});
