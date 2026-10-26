// Where the living component library lives: the tgv.com Page Editor in library
// mode (clients/tinyglobalvillage.com → /[lang]/editor/component-library/, or
// …/component-library/<id>/ for one component — the short, shareable form,
// Gio 2026-10-22). Office only
// LINKS there — the editing harness, drafts and fleet publish all belong to
// tgv.com, and the shared `.tinyglobalvillage.com` member session cookie is
// what lets a staffer walk through without a second login. One helper so the
// Modules panel and the Library modal can never drift to different doors.
export const TGV_BASE =
  process.env.NEXT_PUBLIC_TGV_URL ?? "https://tinyglobalvillage.com";

export function livingLibraryUrl(lang = "en", componentId?: string): string {
  const base = `${TGV_BASE}/${encodeURIComponent(lang)}/editor/component-library/`;
  return componentId ? `${base}${encodeURIComponent(componentId)}/` : base;
}
