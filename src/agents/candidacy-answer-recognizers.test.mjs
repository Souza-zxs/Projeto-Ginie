import test from "node:test";
import assert from "node:assert/strict";
import { ageAnswer, yesNoAnswer } from "./candidacy-answer-recognizers.ts";

test("sim/não no início da frase (compatibilidade com o comportamento anterior)", () => {
  for (const text of ["sim", "Sim", "sim.", "sim!", "s", "claro", "tenho", "posso", "vivo", "consigo", "com certeza", "certo", "positivo", "afirmativo", "pode"]) {
    assert.equal(yesNoAnswer(text), "yes", text);
  }

  for (const text of ["não", "Não", "n", "no", "nunca", "negativo"]) {
    assert.equal(yesNoAnswer(text), "no", text);
  }
});

test("sim/não no meio ou fim de uma frase longa (o motivo de generalizar)", () => {
  for (const text of [
    "sim, tenho 20 anos e já trabalho nessa área",
    "Sim claro, sem problema",
    "Olá, sim, posso trabalhar com recibos verdes",
    "acho que sim"
  ]) {
    assert.equal(yesNoAnswer(text), "yes", text);
  }

  for (const text of [
    "não, infelizmente não tenho",
    "Não, moro no Porto",
    "ainda não consegui tratar disso",
    "lamento, mas não"
  ]) {
    assert.equal(yesNoAnswer(text), "no", text);
  }
});

test("frase com sinal de sim e de não ao mesmo tempo não arrisca: devolve null", () => {
  assert.equal(yesNoAnswer("sim, mas não tenho a certeza"), null);
  assert.equal(yesNoAnswer("não sei, talvez sim"), null);
});

test("texto sem sim/não reconhecível devolve null", () => {
  for (const text of ["", "talvez", "depende da situação", "👍", "Lisboa"]) {
    assert.equal(yesNoAnswer(text), null, text);
  }
  // "não sei"/variantes contêm "nao" isolado -> reconhecido como "no", é esperado (mesmo
  // comportamento de hoje: a palavra "nao" sozinha já basta, mesmo dentro de "não sei").
  assert.equal(yesNoAnswer("não sei"), "no");
  assert.equal(yesNoAnswer("não sei bem o que responder sem as palavras certas"), "no");
});

test("'não tenho'/'não posso'/'não consigo' são um 'não' claro, não ficam ambíguos com o verbo sozinho", () => {
  for (const text of ["não tenho", "Não, não tenho", "infelizmente não posso", "não consigo ir até lá", "não pode ser"]) {
    assert.equal(yesNoAnswer(text), "no", text);
  }
});

test("yesNoAnswer é estável em chamadas repetidas (regex com estado é um erro comum aqui)", () => {
  for (let i = 0; i < 3; i += 1) {
    assert.equal(yesNoAnswer("não tenho"), "no", `chamada ${i}`);
    assert.equal(yesNoAnswer("sim"), "yes", `chamada ${i}`);
  }
});

test("idade: número, ano de nascimento e frases, em qualquer ponto do texto", () => {
  const yes = ["24anos", "24 anos", "tenho 25 anos", "Olá, tenho 30", "mais de 18", "sou maior de idade", "nasci em 1990", "18"];
  const no = ["17", "tenho 17 anos", "menos de 18", "sou menor", "nasci em 2015"];

  for (const text of yes) {
    assert.equal(ageAnswer(text, 2026), "yes", text);
  }

  for (const text of no) {
    assert.equal(ageAnswer(text, 2026), "no", text);
  }
});

test("idade ambígua ou sem número devolve null", () => {
  for (const text of ["sim", "adulta", "já sou crescida", "", "👍"]) {
    assert.equal(ageAnswer(text, 2026), null, text);
  }
});
