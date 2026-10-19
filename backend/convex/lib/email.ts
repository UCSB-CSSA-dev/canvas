import { DEFAULT_ALLOWED_EMAIL_DOMAIN } from "./constants";

export function allowedEmailDomain(): string {
  return (process.env.ALLOWED_EMAIL_DOMAIN ?? DEFAULT_ALLOWED_EMAIL_DOMAIN).toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAllowedEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return EMAIL_SHAPE.test(normalized) && normalized.endsWith(`@${allowedEmailDomain()}`);
}

/** Splits pasted text on newlines, commas, semicolons, and whitespace; dedupes. */
export function parseEmailList(raw: string[]): string[] {
  const seen = new Set<string>();
  for (const chunk of raw) {
    for (const part of chunk.split(/[\s,;]+/)) {
      const email = normalizeEmail(part);
      if (email) seen.add(email);
    }
  }
  return [...seen];
}
