import { useSyncExternalStore } from "react";

export type Locale = "zh" | "en";
export const LOCALES: Locale[] = ["zh", "en"];
export const DEFAULT_LOCALE: Locale = "zh";

const STORAGE_KEY = "cssa-hub-locale";
const listeners = new Set<() => void>();

function read(): Locale {
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : DEFAULT_LOCALE;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function hasStoredLocale(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

export function setStoredLocale(locale: Locale) {
  window.localStorage.setItem(STORAGE_KEY, locale);
  listeners.forEach((listener) => listener());
}

/** Locale persisted in localStorage; static prerender always renders the default. */
export function useStoredLocale(): Locale {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_LOCALE);
}
