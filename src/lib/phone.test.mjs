import test from "node:test";
import assert from "node:assert/strict";
import { formatPhoneForDisplay, normalizePhone, parsePhoneList } from "./phone.ts";

test("normaliza telemóveis de Portugal nos formatos comuns", () => {
  assert.equal(normalizePhone("+351 937 513 951"), "351937513951");
  assert.equal(normalizePhone("+351 963550891"), "351963550891");
  assert.equal(normalizePhone("00351 912 345 678"), "351912345678");
  assert.equal(normalizePhone("912345678"), "351912345678");
});

test("lista colada: um por linha, com espaços e linhas vazias", () => {
  const { valid, invalid } = parsePhoneList("+351 937 513 951 \n\n+351 965 335 902\n  +351 963550891  ");

  assert.deepEqual(valid, ["351937513951", "351965335902", "351963550891"]);
  assert.deepEqual(invalid, []);
});

test("lista colada: vírgula e ponto e vírgula também separam", () => {
  assert.equal(parsePhoneList("912345678, 913456789; 914567890").valid.length, 3);
});

test("números repetidos entram uma vez só", () => {
  assert.deepEqual(parsePhoneList("+351 912 345 678\n912345678").valid, ["351912345678"]);
});

test("o que não é telefone vai para a lista de inválidos", () => {
  const { valid, invalid } = parsePhoneList("912345678\nabc\n123");

  assert.deepEqual(valid, ["351912345678"]);
  assert.deepEqual(invalid, ["abc", "123"]);
});

test("os 12 números pedidos pela DAR+ são todos reconhecidos", () => {
  const list = `+351 937 513 951
+351 965 335 902
+351 938 857 180
+351 928 122 372
+351 963550891
+351 927406503
+351 932950673
+351 963557867
+351 961618008
+351 914155716
+351 961237229
+351 965464056`;
  const { valid, invalid } = parsePhoneList(list);

  assert.equal(valid.length, 12);
  assert.deepEqual(invalid, []);
});

test("exibição legível", () => {
  assert.equal(formatPhoneForDisplay("351937513951"), "+351 937 513 951");
  assert.equal(formatPhoneForDisplay("5583999998888"), "+55 83 99999-8888");
});
