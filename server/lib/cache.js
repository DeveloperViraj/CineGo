// Purpose: Tiny in-memory TTL cache for hot public endpoints.
// On a warm server/serverless instance this turns repeated "list movies"
// requests into a memory read instead of a MongoDB round trip.
// Concurrent misses for the same key share one in-flight promise.

const store = new Map(); // key -> { expires, value?, promise? }

export async function memo(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return hit.promise || hit.value;
  }

  const promise = Promise.resolve()
    .then(fn)
    .then((value) => {
      store.set(key, { expires: Date.now() + ttlMs, value });
      return value;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });

  store.set(key, { expires: now + ttlMs, promise });
  return promise;
}

// Drop every cached entry whose key starts with `prefix` (or everything).
export function invalidate(prefix = "") {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
