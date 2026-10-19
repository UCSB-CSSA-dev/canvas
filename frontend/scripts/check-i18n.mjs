// Fails when messages/zh.json and messages/en.json don't have exactly the same keys.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const load = (locale) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../messages/${locale}.json`, import.meta.url)), "utf8"),
  );

function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const zh = new Set(keys(load("zh")));
const en = new Set(keys(load("en")));
const missingInEn = [...zh].filter((k) => !en.has(k));
const missingInZh = [...en].filter((k) => !zh.has(k));

if (missingInEn.length || missingInZh.length) {
  if (missingInEn.length) console.error("Missing in en.json:\n  " + missingInEn.join("\n  "));
  if (missingInZh.length) console.error("Missing in zh.json:\n  " + missingInZh.join("\n  "));
  process.exit(1);
}
console.log(`i18n OK: ${zh.size} keys in both zh and en.`);
