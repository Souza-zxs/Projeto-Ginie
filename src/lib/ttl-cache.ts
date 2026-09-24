// Cache em memória com validade. Serve para não repetir, a cada atualização da tela, uma
// consulta lenta a um serviço externo (ex.: estado da linha na Uazapi). Sem imports, para
// ser testável sem o Next (ttl-cache.test.mjs).

export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now) {
  const store = new Map<string, { value: T; at: number }>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);

      if (!entry) {
        return undefined;
      }

      if (now() - entry.at >= ttlMs) {
        store.delete(key);
        return undefined;
      }

      return entry.value;
    },
    set(key: string, value: T) {
      store.set(key, { value, at: now() });
    }
  };
}
