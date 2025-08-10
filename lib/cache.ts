type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

// Use globalThis to persist across HMR in dev
const globalCache = (globalThis as any).__APP_MEMORY_CACHE__ as Map<string, CacheEntry<any>> | undefined;
const cache: Map<string, CacheEntry<any>> = globalCache || new Map();
if (!globalCache) {
  (globalThis as any).__APP_MEMORY_CACHE__ = cache;
}

export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setToCache<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function deleteFromCache(key: string): void {
  cache.delete(key);
}

export function buildCacheHeaders(hit: boolean, ttlSeconds: number) {
  return {
    'x-cache': hit ? 'HIT' : 'MISS',
    // Allow shared caches (CDN/Proxy) to keep for ttlSeconds, serve stale for 60s while revalidating
    'Cache-Control': `public, s-maxage=${ttlSeconds}, stale-while-revalidate=60`,
  } as Record<string, string>;
}


