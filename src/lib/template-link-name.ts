// A template's share-link name (tinyglobalvillage.com/t/<name>, TGV migration
// 0251) — the rule both sides use: the gallery's field cleans as you type, the
// link-name route cleans again before it saves. Client-safe (no server-only).

/** Lowercase letters, digits and single dashes; 2–60 long; no dash at either end. */
export const LINK_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

/** What a typed name becomes: accents dropped, lowercased, spaces and
 *  punctuation removed (dashes kept, never doubled or at the ends). */
export function cleanLinkName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .slice(0, 60);
}

export function isValidLinkName(name: string): boolean {
  return name.length >= 2 && LINK_NAME_RE.test(name);
}
