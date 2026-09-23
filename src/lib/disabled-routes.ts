// Rotas com código pronto, mas sem uso no momento: o middleware não deixa abrir (nem por URL
// direta). Para reativar uma, tire o prefixo daqui e devolva o item em components/app-shell.tsx.
// Sem imports de propósito, para ser testável sem o Next (disabled-routes.test.mjs).

export const DISABLED_ROUTE_PREFIXES = [
  "/campaigns",
  "/crm",
  "/appointments",
  "/settings/whatsapp",
  "/api/campaigns"
];

export function isDisabledRoute(pathname: string) {
  return DISABLED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
