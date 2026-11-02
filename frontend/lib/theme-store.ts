"use client";

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "cssa-hub-theme";
const CHANGE_EVENT = "cssa-hub-theme-change";

function read(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#fafafa" : "#0a0a0a");
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setStoredTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* Keep the toggle usable when storage is unavailable. */ }
}

function subscribe(callback: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      applyTheme(event.newValue === "light" ? "light" : "dark");
    }
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", sync);
  };
}

export function useStoredTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "dark");
}
