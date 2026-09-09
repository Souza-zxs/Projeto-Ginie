import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Modo local / degradado.
 *
 * Quando as variaveis do Supabase nao estao configuradas, todo o app passa a
 * usar este cliente "stub" no lugar do cliente real. Ele implementa apenas a
 * superficie da API que o projeto usa (auth, .from(...).select()/eq()/..., rpc,
 * storage) e responde sempre com:
 *   - um usuario/perfil "demo" (para liberar a navegacao sem login real);
 *   - listas vazias / count 0 em qualquer consulta de tabela.
 *
 * Resultado: o app sobe e renderiza todas as paginas com estado vazio, sem
 * exigir Supabase, Postgres ou Docker, e sem disparar erro 500.
 */

export const DEMO_USER = {
  id: "demo-user",
  aud: "authenticated",
  role: "authenticated",
  email: "demo@local.test",
  email_confirmed_at: "2025-01-01T00:00:00.000Z",
  phone: "",
  confirmed_at: "2025-01-01T00:00:00.000Z",
  last_sign_in_at: "2025-01-01T00:00:00.000Z",
  app_metadata: { provider: "local", providers: ["local"] },
  user_metadata: {
    full_name: "Usuario Demo",
    organization_name: "Organizacao Demo"
  },
  identities: [],
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z"
};

const DEMO_SESSION = {
  access_token: "local-demo-token",
  refresh_token: "local-demo-refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 4102444800,
  user: DEMO_USER
};

export const DEMO_PROFILE = {
  id: DEMO_USER.id,
  organization_id: "demo-org",
  full_name: "Usuario Demo",
  role: "admin"
};

/**
 * Builder encadeavel e "thenable". Qualquer metodo de filtro/modificacao
 * (select, eq, in, order, insert, update, ...) retorna o proprio builder.
 * `single`/`maybeSingle` mudam o formato do resultado para um unico registro.
 */
function makeQueryBuilder(seed: unknown[]) {
  let singleMode = false;

  const resolve = () => {
    if (singleMode) {
      return { data: seed.length > 0 ? seed[0] : null, error: null, count: seed.length };
    }
    return { data: seed, error: null, count: seed.length };
  };

  const builder: Record<PropertyKey, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (
            onFulfilled?: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown
          ) => Promise.resolve(resolve()).then(onFulfilled, onRejected);
        }

        if (prop === "single" || prop === "maybeSingle") {
          return () => {
            singleMode = true;
            return builder;
          };
        }

        if (prop === "csv") {
          return () => Promise.resolve({ data: "", error: null });
        }

        // Qualquer outro metodo (select, insert, update, delete, upsert, eq,
        // neq, in, order, limit, range, match, filter, ...) e encadeavel.
        return () => builder;
      }
    }
  ) as Record<PropertyKey, unknown>;

  return builder;
}

function makeStorageBucket() {
  const unavailable = {
    data: null,
    error: { message: "Storage indisponivel no modo local." }
  };
  return {
    async upload() {
      return unavailable;
    },
    async download() {
      return unavailable;
    },
    async remove() {
      return { data: [], error: null };
    },
    async list() {
      return { data: [], error: null };
    },
    async createSignedUrl() {
      return unavailable;
    },
    getPublicUrl() {
      return { data: { publicUrl: "" } };
    }
  };
}

export function createStubClient(): SupabaseClient {
  const client = {
    auth: {
      async getUser() {
        return { data: { user: DEMO_USER }, error: null };
      },
      async getSession() {
        return { data: { session: DEMO_SESSION }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null };
      },
      async signUp() {
        return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null };
      },
      async signOut() {
        return { error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      }
    },
    from() {
      return makeQueryBuilder([]);
    },
    rpc(name: string) {
      // O bootstrap de organizacao retorna o perfil demo para que
      // getCurrentProfile funcione e libere a navegacao.
      if (name === "bootstrap_current_user_organization") {
        return makeQueryBuilder([DEMO_PROFILE]);
      }
      return makeQueryBuilder([]);
    },
    storage: {
      from() {
        return makeStorageBucket();
      }
    }
  };

  return client as unknown as SupabaseClient;
}
