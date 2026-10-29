// Leitura determinística de "sim"/"não" e de idade em texto livre, para as perguntas de
// elegibilidade da candidatura (ver candidacy-eligibility.ts). O modelo conversacional nunca
// decide isto sozinho: só este reconhecedor, por palavra-chave, é que resolve um campo — se
// devolver null, o campo continua pendente, mesmo que o modelo "ache" que entendeu.
// Generalização de yesNoAnswer/ageAnswer de src/services/uazapi/menu-bot.ts: aqui a palavra
// pode aparecer em qualquer ponto da frase (não só no início), porque uma resposta livre tende
// a ser mais longa ("sim, tenho 20 anos e já trabalho nessa área").
// Sem imports do projeto, para ser testável sem o Next (candidacy-answer-recognizers.test.mjs).

function normalizeWord(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const NO_PATTERN = /(?:^|\s)(nao|n|no|nunca|negativo)(?:\s|[.,!?]|$)/;
const YES_PATTERN =
  /(?:^|\s)(sim|s|claro|tenho|posso|vivo|consigo|yes|ok|com certeza|certo|positivo|afirmativo|pode)(?:\s|[.,!?]|$)/;
// "Tenho"/"posso"/"vivo"/"consigo"/"pode" só são sinal de "sim" quando NÃO vêm logo depois de
// uma negação — "não tenho" é um "não" claro, não uma frase ambígua com sinal de sim e de não.
const NEGATED_YES_WORD = /(?:^|\s)(nao|n|no|nunca|negativo)(\s+)(tenho|posso|vivo|consigo|pode)(?=\s|[.,!?]|$)/g;

/**
 * "Sim"/"não" em qualquer ponto do texto. Se, fora essas negações diretas, o texto ainda tiver
 * sinal de ambos ("sim, mas não tenho certeza"), não arrisca — devolve null, como se não
 * tivesse entendido, para ir à pergunta de novo em vez de registar um facto errado.
 */
export function yesNoAnswer(text: string): "yes" | "no" | null {
  const word = normalizeWord(text);
  // Comparar o resultado do replace (em vez de regexp.test, que tem estado por causa da
  // flag "g" e dá resultado errado em chamadas repetidas com o mesmo regex).
  const withoutNegatedYesWords = word.replace(NEGATED_YES_WORD, "$1");
  const negatesYesWord = withoutNegatedYesWords !== word;

  const hasNo = negatesYesWord || NO_PATTERN.test(withoutNegatedYesWords);
  const hasYes = YES_PATTERN.test(withoutNegatedYesWords);

  if (hasNo && hasYes) return null;
  if (hasNo) return "no";
  if (hasYes) return "yes";

  return null;
}

/**
 * Resposta natural à pergunta "Tem 18 anos ou mais?", em qualquer ponto da frase: "24anos",
 * "tenho 25 anos", "mais de 18", "sou maior de idade", "nasci em 1990" (sim), ou "17", "menos
 * de 18", "sou menor" (não).
 */
export function ageAnswer(text: string, currentYear: number): "yes" | "no" | null {
  const word = normalizeWord(text);

  if (/(menos de 18|menor de idade|sou menor|ainda sou menor)/.test(word)) return "no";
  if (/(mais de 18|maior de idade|sou maior|maior de 18|acima de 18)/.test(word)) return "yes";

  const number = Number(word.match(/\d{1,4}/)?.[0]);

  if (!Number.isFinite(number)) return null;
  if (number >= 1900 && number <= currentYear) return currentYear - number >= 18 ? "yes" : "no";
  if (number >= 18 && number <= 120) return "yes";
  if (number >= 1 && number <= 17) return "no";

  return null;
}
