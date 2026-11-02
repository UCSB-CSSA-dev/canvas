import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";

const classes = new Set(["dark"]);
const storage = new Map();
const events = new EventTarget();
let color;
let subscribe;
const context = {
  Event,
  window: events,
  document: {
    documentElement: {
      classList: {
        contains: (name) => classes.has(name),
        toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
        replace: (from, to) => { classes.delete(from); classes.add(to); },
      },
    },
    querySelector: () => ({ setAttribute: (_, value) => { color = value; } }),
  },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  useSyncExternalStore: (listen, read) => { subscribe = listen; return read(); },
};
const source = readFileSync(new URL("../lib/theme-store.ts", import.meta.url), "utf8");
runInNewContext(stripTypeScriptTypes(source)
  .replace(/import .* from "react";/, "")
  .replaceAll("export ", ""), context);
assert.equal(context.useStoredTheme(), "dark");
let updates = 0;
const unsubscribe = subscribe(() => updates++);
context.setStoredTheme("light");
assert.equal(context.useStoredTheme(), "light");
assert.equal(storage.get("cssa-hub-theme"), "light");
assert.equal(color, "#fafafa");
assert.equal(classes.has("dark"), false);
assert.equal(updates, 1);

// Simulate a reload using the actual script embedded in the root layout.
const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const init = layout.match(/const themeScript = `([^`]+)`;/)[1];
classes.clear(); classes.add("dark");
runInNewContext(init, context);
assert.equal(classes.has("light"), true);

const change = new Event("storage");
Object.assign(change, { key: "cssa-hub-theme", newValue: "dark" });
events.dispatchEvent(change);
assert.equal(context.useStoredTheme(), "dark");
assert.equal(color, "#0a0a0a");
context.localStorage.setItem = () => { throw new Error("Storage disabled"); };
context.localStorage.getItem = () => { throw new Error("Storage disabled"); };
assert.doesNotThrow(() => context.setStoredTheme("light"));
assert.equal(context.useStoredTheme(), "light");
assert.doesNotThrow(() => runInNewContext(init, context));
unsubscribe();
console.log("Theme OK: switching, persistence, reload, cross-tab sync and unavailable storage.");
