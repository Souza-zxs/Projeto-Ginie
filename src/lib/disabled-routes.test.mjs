import test from "node:test";
import assert from "node:assert/strict";
import { isDisabledRoute } from "./disabled-routes.ts";

test("bloqueia as rotas desativadas e as sub-rotas delas", () => {
  for (const path of ["/campaigns", "/campaigns/new", "/campaigns/abc-123", "/crm", "/appointments", "/settings/whatsapp", "/api/campaigns/test", "/api/campaigns/abc/send"]) {
    assert.equal(isDisabledRoute(path), true, path);
  }
});

test("não bloqueia o que está em uso, nem rotas parecidas", () => {
  for (const path of ["/", "/dashboard", "/inbox", "/clients", "/settings", "/settings/integrations", "/settings/agents", "/crmx", "/campaignsx", "/api/webhooks/uazapi", "/api/webhooks/meta", "/api/jobs/process", "/api/inbox/latest"]) {
    assert.equal(isDisabledRoute(path), false, path);
  }
});
