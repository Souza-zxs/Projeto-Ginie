// Cliente mínimo para a API de chat no formato OpenAI (`/v1/chat/completions`).
//
// Esse formato é o "denominador comum" entre a OpenAI e praticamente todos os
// runners de modelo local (Ollama, LM Studio, llama.cpp server, vLLM, LiteLLM).
// Por isso trocamos o endpoint proprietário `/v1/responses` por este.
//
// Para apontar para um modelo local, defina no ambiente:
//   OPENAI_BASE_URL=http://127.0.0.1:11434/v1   (ex.: Ollama)
//   OPENAI_MODEL=qwen2.5:3b-instruct
//   OPENAI_API_KEY=ollama                       (qualquer string; alguns runners ignoram)

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

// Limite para o modelo responder. Fica abaixo dos 60s padrão do nginx, para o
// usuário receber um erro legível em vez de um 504 do proxy. Ajustável por
// LLM_TIMEOUT_MS (ex.: modelo local em CPU, que demora mais na primeira chamada).
const DEFAULT_TIMEOUT_MS = 50_000;

function getTimeoutMs() {
  const configured = Number(process.env.LLM_TIMEOUT_MS);

  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getOpenAIConfig() {
  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const apiKey = process.env.OPENAI_API_KEY || "";
  const isLocal = Boolean(process.env.OPENAI_BASE_URL);

  return { baseUrl, apiKey, isLocal };
}

/** Retorna true se há alguma forma de chamar um modelo: chave da OpenAI OU base URL local. */
export function hasLlmConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL);
}

/**
 * Decide qual modelo usar. Cada agente guarda um `openai_model` (ex.: "gpt-5-mini"),
 * mas esse nome não existe em runners locais. Em modo local (OPENAI_BASE_URL setada),
 * o modelo do ambiente (OPENAI_MODEL) sempre vence, ignorando o que está salvo no agente.
 */
export function resolveModel(agentModel?: string | null) {
  const { isLocal } = getOpenAIConfig();

  if (isLocal) {
    return process.env.OPENAI_MODEL || agentModel || "llama3.2:3b";
  }

  return agentModel || process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

type ChatCompletionParams = {
  model: string;
  messages: ChatMessage[];
  /** Passado direto como `response_format` (ex.: json_schema). Opcional. */
  responseFormat?: Record<string, unknown>;
};

type ChatCompletionResult = {
  ok: boolean;
  content: string | null;
  error?: string;
};

export async function chatCompletion(
  params: ChatCompletionParams
): Promise<ChatCompletionResult> {
  const { baseUrl, apiKey } = getOpenAIConfig();
  const timeoutMs = getTimeoutMs();

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Runners locais normalmente aceitam qualquer Authorization (ou nenhum).
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        ...(params.responseFormat ? { response_format: params.responseFormat } : {})
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        ok: false,
        content: null,
        error: `O modelo demorou mais de ${Math.round(timeoutMs / 1000)}s para responder (${baseUrl}).`
      };
    }

    return {
      ok: false,
      content: null,
      error: error instanceof Error ? error.message : "Falha de rede ao chamar o modelo."
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    return {
      ok: false,
      content: null,
      error: payload.error?.message || `HTTP ${response.status} em ${baseUrl}/chat/completions`
    };
  }

  const content = payload.choices?.[0]?.message?.content ?? null;

  return { ok: true, content };
}
