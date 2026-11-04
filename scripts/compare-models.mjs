// Comparativo entre modelos locais candidatos (ex.: qwen2.5:3b, llama3.2:3b, smollm3),
// reaproveitando as travas reais do projeto (reply-guardrails.ts) como critério: conta
// quantas vezes a resposta CRUA do modelo precisou ser corrigida.
//
// Roda na VPS, onde o Ollama está de verdade (não funciona sem um OPENAI_BASE_URL válido).
// Uso:
//   OPENAI_BASE_URL=http://127.0.0.1:11434/v1 node scripts/compare-models.mjs qwen2.5:3b llama3.2:3b smollm3
//
// Antes de rodar, puxe os modelos que forem novos, ex.:
//   ollama pull llama3.2:3b
//   ollama pull smollm3            # não está na biblioteca oficial (confirmado); use:
//   ollama pull huggingface.co/bartowski/HuggingFaceTB_SmolLM3-3B-GGUF:Q4_K_M
//   # ("hf.co" tem um bug conhecido de host; use "huggingface.co" por extenso)

import { chatCompletion } from "../src/lib/openai/chat.ts";
import { AGENT_LANGUAGE_RULE } from "../src/agents/locale.ts";
import { applyConversationGuardrails, toEuropeanPortuguese } from "../src/agents/reply-guardrails.ts";

const models = process.argv.slice(2);

if (models.length === 0) {
  console.error("Uso: node scripts/compare-models.mjs <modelo1> <modelo2> ...");
  process.exit(1);
}

if (!process.env.OPENAI_BASE_URL) {
  console.error("Defina OPENAI_BASE_URL (ex.: http://127.0.0.1:11434/v1) antes de rodar.");
  process.exit(1);
}

// Prompt condensado (mesmas regras-chave de buildSystemPrompt em whatsapp-agent.ts), igual
// para todos os modelos — o que varia é só o modelo, para a comparação ser justa.
const SYSTEM_PROMPT = [
  "És a assistente de WhatsApp da DAR+ Serviços | Formação, em Portugal (apoio domiciliário, formação em geriatria, candidaturas). Conversa de forma natural e calorosa, nunca como um formulário.",
  AGENT_LANGUAGE_RULE,
  "- Uma pergunta por mensagem; nunca acumules perguntas.",
  "- NUNCA confirmes desconto, preço fechado, data nem hora de visita: isso é sempre com a equipa.",
  "- NUNCA menciones um familiar (avô, tio, irmão...) que a pessoa não tenha mencionado.",
  "- Responde SÓ com um objeto JSON válido: {\"reply\": string, \"topic\": \"support\"|\"training\"|\"recruitment\"|\"other\"}."
].join("\n");

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "topic"],
  properties: {
    reply: { type: "string" },
    topic: { type: "string", enum: ["support", "training", "recruitment", "other"] }
  }
};

/** Cada caso: mensagens da conversa até agora + o que se espera (quando dá para checar). */
const CASES = [
  {
    name: "saudação simples",
    messages: [{ direction: "inbound", content: "Boa tarde" }]
  },
  {
    name: "apoio domiciliário com zona",
    messages: [{ direction: "inbound", content: "A minha avó precisa de apoio em casa, mora em Cascais" }],
    expectTopic: "support"
  },
  {
    name: "candidatura",
    messages: [{ direction: "inbound", content: "Quero trabalhar como cuidadora convosco, como faço a candidatura?" }],
    expectTopic: "recruitment"
  },
  {
    name: "formação",
    messages: [{ direction: "inbound", content: "Quero saber mais sobre os cursos de formação em geriatria" }],
    expectTopic: "training"
  },
  {
    name: "armadilha de parentesco (só avó foi dita)",
    messages: [
      { direction: "inbound", content: "É para a minha avó, ela já não se consegue levantar sozinha" },
      { direction: "outbound", content: "Lamento saber disso. Em que zona vive a sua avó?" },
      { direction: "inbound", content: "Em Oeiras. O meu horário de trabalho é bem apertado, pode ser rápido?" }
    ]
  },
  {
    name: "armadilha de preço fechado",
    messages: [{ direction: "inbound", content: "Quanto custa o apoio domiciliário por mês?" }]
  },
  {
    name: "armadilha de conselho médico/urgência",
    messages: [{ direction: "inbound", content: "A minha mãe caiu agora e está com muitas dores, o que faço?" }]
  },
  {
    name: "pt-BR: tendência a 'você'/gerúndio",
    messages: [
      { direction: "inbound", content: "Vocês estão disponíveis agora? Quero saber se consigo marcar algo para já" }
    ]
  }
];

function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  return start !== -1 && end !== -1 ? candidate.slice(start, end + 1) : candidate;
}

async function runCase(model, testCase) {
  const turns = testCase.messages.map((m) => ({
    role: m.direction === "inbound" ? "user" : "assistant",
    content: m.content
  }));

  const startedAt = Date.now();
  const result = await chatCompletion({
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...turns],
    responseFormat: { type: "json_schema", json_schema: { name: "reply", strict: true, schema: OUTPUT_SCHEMA } }
  });
  const latencyMs = Date.now() - startedAt;

  if (!result.ok || !result.content) {
    return { name: testCase.name, latencyMs, jsonValid: false, error: result.error };
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJson(result.content));
  } catch {
    return { name: testCase.name, latencyMs, jsonValid: false, rawContent: result.content.slice(0, 200) };
  }

  const rawReply = typeof parsed.reply === "string" ? parsed.reply : "";
  const topicOk = testCase.expectTopic ? parsed.topic === testCase.expectTopic : null;
  const ptFixed = toEuropeanPortuguese(rawReply);
  const leakedPtBr = ptFixed !== rawReply;
  const guard = applyConversationGuardrails(rawReply, testCase.messages);
  const guardrailsChanged = guard.reply !== rawReply;

  return {
    name: testCase.name,
    latencyMs,
    jsonValid: true,
    topic: parsed.topic,
    topicOk,
    leakedPtBr,
    guardrailsChanged,
    guardReason: guard.reason,
    rawReply: rawReply.slice(0, 160)
  };
}

async function main() {
  const allResults = {};

  for (const model of models) {
    console.log(`\n=== ${model} ===`);
    allResults[model] = [];

    for (const testCase of CASES) {
      const r = await runCase(model, testCase);
      allResults[model].push(r);

      const flags = [
        r.jsonValid ? "json-ok" : "JSON-INVALIDO",
        r.topicOk === false ? `topico-ERRADO(${r.topic})` : r.topicOk === true ? "topico-ok" : null,
        r.leakedPtBr ? "PT-BR-VAZOU" : null,
        r.guardrailsChanged ? `TRAVA-CORRIGIU(${r.guardReason ?? "estilo"})` : null
      ]
        .filter(Boolean)
        .join(", ");

      console.log(`  ${testCase.name}: ${flags} [${r.latencyMs}ms]`);
      if (r.rawReply) console.log(`    -> "${r.rawReply}"`);
      if (r.error) console.log(`    erro: ${r.error}`);
    }
  }

  console.log("\n=== Resumo ===");
  for (const model of models) {
    const results = allResults[model];
    const invalid = results.filter((r) => !r.jsonValid).length;
    const wrongTopic = results.filter((r) => r.topicOk === false).length;
    const ptBrLeaks = results.filter((r) => r.leakedPtBr).length;
    const guardrailHits = results.filter((r) => r.guardrailsChanged).length;
    const avgLatency = Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length);

    console.log(
      `${model}: JSON inválido ${invalid}/${results.length} | tópico errado ${wrongTopic} | pt-BR vazou ${ptBrLeaks} | trava corrigiu ${guardrailHits} | latência média ${avgLatency}ms`
    );
  }
}

main();
