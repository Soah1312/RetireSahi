const DEFAULT_TTL_MS = 5 * 60 * 1000;

const profileCache = new Map();
const inflightLoads = new Map();

function cloneProfile(data) {
  if (!data || typeof data !== 'object') return data;
  return { ...data };
}

export function readUserProfileCache(uid, ttlMs = DEFAULT_TTL_MS) {
  if (!uid) return null;

  const entry = profileCache.get(uid);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > ttlMs) {
    profileCache.delete(uid);
    return null;
  }

  return cloneProfile(entry.data);
}

export function writeUserProfileCache(uid, profile) {
  if (!uid || !profile) return;

  profileCache.set(uid, {
    data: cloneProfile(profile),
    timestamp: Date.now(),
  });
}

export function invalidateUserProfileCache(uid) {
  if (uid) {
    profileCache.delete(uid);
    inflightLoads.delete(uid);
    return;
  }

  profileCache.clear();
  inflightLoads.clear();
}

export async function getOrLoadUserProfile({ uid, loader, ttlMs = DEFAULT_TTL_MS }) {
  const cached = readUserProfileCache(uid, ttlMs);
  if (cached) return cached;

  if (inflightLoads.has(uid)) {
    return inflightLoads.get(uid);
  }

  const loadPromise = (async () => {
    const loaded = await loader();
    if (loaded) {
      writeUserProfileCache(uid, loaded);
    }
    return loaded;
  })().finally(() => {
    inflightLoads.delete(uid);
  });

  inflightLoads.set(uid, loadPromise);
  return loadPromise;
}