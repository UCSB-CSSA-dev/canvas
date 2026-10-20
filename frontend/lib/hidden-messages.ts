import { useCallback, useSyncExternalStore } from "react";

// "本机删除": hides messages in this browser only, per account. Nothing changes on the server.

const listeners = new Set<() => void>();
const cache = new Map<string, Set<string>>();

function storageKey(userId: string) {
  return `cssa-hub:hidden:${userId}`;
}

function read(userId: string): Set<string> {
  const cached = cache.get(userId);
  if (cached) return cached;
  let ids = new Set<string>();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw) ids = new Set(JSON.parse(raw) as string[]);
  } catch {
    // Unreadable storage behaves like an empty list.
  }
  cache.set(userId, ids);
  return ids;
}

function write(userId: string, ids: Set<string>) {
  cache.set(userId, ids);
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
  } catch {
    // Storage full or blocked: the change still applies for this session.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith("cssa-hub:hidden:")) {
      cache.clear();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY = new Set<string>();

export function useHiddenMessages(userId: string) {
  const hidden = useSyncExternalStore(
    subscribe,
    () => read(userId),
    () => EMPTY,
  );
  const hide = useCallback(
    (ids: string[]) => write(userId, new Set([...read(userId), ...ids])),
    [userId],
  );
  const restore = useCallback(
    (ids: string[]) => {
      const next = new Set(read(userId));
      for (const id of ids) next.delete(id);
      write(userId, next);
    },
    [userId],
  );
  return { hidden, hide, restore };
}
