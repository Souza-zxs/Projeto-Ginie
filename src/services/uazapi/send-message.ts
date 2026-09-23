type SendUazapiMessageInput = {
  phone: string;
  text: string;
  integrationConfig?: {
    baseUrl?: string;
    token?: string;
    apiKey?: string;
  };
};

type SendUazapiListInput = {
  phone: string;
  text: string;
  listButton: string;
  /** "rótulo|id|descrição" (descrição opcional). */
  choices: string[];
  footerText?: string;
  integrationConfig?: SendUazapiMessageInput["integrationConfig"];
};

/** Lista interativa (botão que abre as opções). Lança erro se a Uazapi recusar. */
export async function sendUazapiList({
  phone,
  text,
  listButton,
  choices,
  footerText,
  integrationConfig
}: SendUazapiListInput) {
  const baseUrl = integrationConfig?.baseUrl || process.env.UAZAPI_BASE_URL;
  const token = integrationConfig?.token || integrationConfig?.apiKey || process.env.UAZAPI_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Uazapi credentials are missing.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/send/menu`, {
    method: "POST",
    headers: { token, "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, type: "list", text, choices, listButton, footerText })
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Uazapi list request failed.");
  }

  return payload;
}

export async function sendUazapiMessage({
  phone,
  text,
  integrationConfig
}: SendUazapiMessageInput) {
  const baseUrl = integrationConfig?.baseUrl || process.env.UAZAPI_BASE_URL;
  const token = integrationConfig?.token || integrationConfig?.apiKey || process.env.UAZAPI_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Uazapi credentials are missing.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/send/text`, {
    method: "POST",
    headers: {
      token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      number: phone,
      text
    })
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Uazapi request failed.");
  }

  return payload;
}
