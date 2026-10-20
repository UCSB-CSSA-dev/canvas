// Shared with the frontend (imported via @cssa-hub/backend). Keep free of server-only imports.

/** Mentions are stored in message bodies as `<@userId>`; `<@all>` notifies the whole chat. */
export const MENTION_PATTERN = /<@([a-z0-9]+)>/gi;
export const MENTION_ALL = "all";

export function mentionToken(userId: string) {
  return `<@${userId}>`;
}

export function parseMentions(body: string): { userIds: string[]; all: boolean } {
  const ids = new Set<string>();
  let all = false;
  for (const match of body.matchAll(MENTION_PATTERN)) {
    if (match[1].toLowerCase() === MENTION_ALL) all = true;
    else ids.add(match[1]);
  }
  return { userIds: [...ids], all };
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** Lowercased, width-folded text without mention tokens. */
export function foldText(text: string): string {
  return text.replace(MENTION_PATTERN, " ").normalize("NFKC").toLowerCase();
}

/**
 * Convex's search tokenizer splits only on whitespace and punctuation, so a run of Chinese
 * becomes one token. Emit each CJK run as overlapping two-character pairs instead
 * ("明天活动" -> "明天 天活 活动"); other words pass through.
 */
export function searchTerms(text: string): string[] {
  const terms: string[] = [];
  for (const word of foldText(text).split(/[^\p{L}\p{N}]+/u)) {
    if (!word) continue;
    let run = "";
    const flushRun = () => {
      const chars = [...run];
      if (chars.length === 1) terms.push(chars[0]);
      for (let i = 0; i + 1 < chars.length; i++) terms.push(chars[i] + chars[i + 1]);
      run = "";
    };
    let latin = "";
    for (const char of word) {
      if (CJK.test(char)) {
        if (latin) terms.push(latin);
        latin = "";
        run += char;
      } else {
        if (run) flushRun();
        latin += char;
      }
    }
    if (run) flushRun();
    if (latin) terms.push(latin);
  }
  return terms;
}

export function toSearchText(text: string): string {
  return searchTerms(text).join(" ");
}

/** Typed to confirm archiving a department. */
export function archivePhrase(nameZh: string) {
  return `将${nameZh}设为已归档`;
}
