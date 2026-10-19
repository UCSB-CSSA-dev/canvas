import type { Locale } from "./locale-store";

type Named = {
  nameZh?: string;
  nameEn?: string;
  name?: string;
  email?: string;
};

export function displayName(person: Named | null | undefined, locale: Locale): string {
  if (!person) return "";
  const primary = locale === "zh" ? person.nameZh : person.nameEn;
  const secondary = locale === "zh" ? person.nameEn : person.nameZh;
  return primary || secondary || person.name || person.email || "";
}

/** "李华 Hua Li" style label showing both names when available. */
export function bilingualName(person: Named | null | undefined): string {
  if (!person) return "";
  const parts = [person.nameZh, person.nameEn].filter(Boolean);
  return parts.length ? parts.join(" ") : person.name || person.email || "";
}

export function localized(zh: string | undefined, en: string | undefined, locale: Locale) {
  return (locale === "zh" ? zh || en : en || zh) ?? "";
}

export function initials(person: Named | null | undefined): string {
  const name = person?.nameEn || person?.name || person?.nameZh || person?.email || "?";
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
