"use client";

// DashboardCopyModal — edit the words on any tenant dashboard modal, fleet-wide.
//
// Gio 2026-09-05, in order:
//   • "i want an interface to be able to edit the text on any modal of the dashboard"
//   • "platform wide, and have them be all on one ADDM SBDM organized by tabs under ADDM's that
//     can be clicked open one by one"      → SBDM #1, collapsibleGroups, groups = dashboard tabs
//   • "yes one office editable canon"      → no per-tenant override; this writes the fleet's copy
//   • "lets have 2 DDM SBDM's one for the modal selection and the second for the language
//     selector, Default english"           → SBDM #2, value defaults to 'en'
//   • "when a language is first selected … it auto-fires an engine … that translates it using
//     claude ai to auto-seed every field that was in english"   → picking an unseeded language
//     POSTs the seed and then reloads that language's rows
//   • asked whether modals expose curated keys or every literal: "A"  → the registry, not a scrape
//
// English is editable too: a row under `lang = 'en'` is an operator rewriting the platform's own
// English, and clearing a field deletes the row so the shipped default comes back. That is why
// every input's placeholder is the shipped English — the box is never blank about what it will
// render if you leave it empty.

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import SBDM from "@tgv/module-component-library/components/ui/SBDM";
import {
  DASHBOARD_COPY_REGISTRY,
  COPY_SPEC_BY_KEY,
} from "@tgv/module-component-library/helpers/dashboardCopy/registry";
import { rgb, colors } from "../../theme";

/** Languages an operator can add. Curated rather than free-text: the seed prompt names the
 *  language to Claude, so "Português (Brasil)" has to be a label somebody chose, not a typo. */
const LANGUAGE_CATALOG: { lang: string; label: string }[] = [
  { lang: "en", label: "English" },
  { lang: "es", label: "Español" },
  { lang: "fr", label: "Français" },
  { lang: "de", label: "Deutsch" },
  { lang: "pt", label: "Português" },
  { lang: "it", label: "Italiano" },
  { lang: "nl", label: "Nederlands" },
  { lang: "nb", label: "Norsk bokmål" },
  { lang: "sv", label: "Svenska" },
  { lang: "da", label: "Dansk" },
  { lang: "pl", label: "Polski" },
  { lang: "ja", label: "日本語" },
  { lang: "ko", label: "한국어" },
  { lang: "zh", label: "中文" },
  { lang: "ar", label: "العربية" },
  { lang: "hi", label: "हिन्दी" },
];

type LangRow = { lang: string; label: string; seed_status: string; seed_error: string | null };
type FieldMap = Record<string, Record<string, { value: string; source: string }>>;

export default function DashboardCopyModal({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState("en");
  const [modalKey, setModalKey] = useState(DASHBOARD_COPY_REGISTRY[0]?.key ?? "");
  const [languages, setLanguages] = useState<LangRow[]>([]);
  const [fields, setFields] = useState<FieldMap>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "loading" | "seeding" | "saving">("loading");
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const spec = COPY_SPEC_BY_KEY[modalKey];

  /** Load one language's saved rows and reset the draft to them. */
  const load = useCallback(async (l: string) => {
    setBusy("loading");
    setErr(null);
    try {
      const res = await fetch(`/api/admin/dashboard-copy?lang=${encodeURIComponent(l)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        languages?: LangRow[];
        fields?: FieldMap;
        error?: string;
      };
      if (!data.ok) throw new Error(data.error ?? "Load failed");
      setLanguages(data.languages ?? []);
      setFields(data.fields ?? {});
      setDraft({});
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void load("en");
  }, [load]);

  /** The value showing in a field's box: the unsaved edit, else the saved row, else "" (which
   *  renders the shipped English as a placeholder). */
  const shown = (fieldKey: string) => {
    const id = `${modalKey}.${fieldKey}`;
    if (id in draft) return draft[id];
    return fields[modalKey]?.[fieldKey]?.value ?? "";
  };

  const dirty = useMemo(() => Object.keys(draft).length > 0, [draft]);

  async function saveAll() {
    setBusy("saving");
    setErr(null);
    try {
      for (const [id, value] of Object.entries(draft)) {
        const dot = id.indexOf(".");
        const res = await fetch("/api/admin/dashboard-copy", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lang,
            modalKey: id.slice(0, dot),
            fieldKey: id.slice(dot + 1),
            value,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!data.ok) throw new Error(data.error ?? "Save failed");
      }
      await load(lang);
      setNote("Saved — every tenant picks it up on their next dashboard load.");
      setTimeout(() => setNote(null), 4000);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
      setBusy(null);
    }
  }

  /** Pick a language. An unseeded one fires the translator first (Gio's "auto-fires an engine"). */
  async function pickLanguage(next: string) {
    if (next === lang) return;
    const known = languages.find((l) => l.lang === next);
    setLang(next);
    if (next === "en" || (known && known.seed_status === "ready")) {
      await load(next);
      return;
    }
    setBusy("seeding");
    setErr(null);
    setNote(null);
    try {
      const label = LANGUAGE_CATALOG.find((c) => c.lang === next)?.label ?? next;
      const res = await fetch("/api/admin/dashboard-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: next, label }),
      });
      const data = (await res.json()) as { ok?: boolean; seeded?: number; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Seed failed");
      setNote(
        `Auto-translated ${data.seeded ?? 0} strings into ${label}. Machine-written — have a native speaker read them.`,
      );
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    }
    await load(next);
  }

  const modalItems = DASHBOARD_COPY_REGISTRY.map((m) => ({
    key: m.key,
    label: m.label,
    group: m.tab,
  }));

  // Added languages first (they hold real work), then the rest of the catalog to add from.
  const langItems = [
    ...languages.map((l) => ({
      key: l.lang,
      label: l.seed_status === "failed" ? `${l.label} — seed failed` : l.label,
      group: "Added",
    })),
    ...LANGUAGE_CATALOG.filter((c) => !languages.some((l) => l.lang === c.lang)).map((c) => ({
      key: c.lang,
      label: c.label,
      group: "Add a language",
    })),
  ];

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Title>Dashboard copy — fleet canon</Title>
        <Lead>
          Every tenant’s dashboard reads these words. Leave a box empty and the shipped English
          (shown greyed inside it) is what renders.
        </Lead>

        <Pickers>
          <SBDM
            items={modalItems}
            value={modalKey}
            onSelect={setModalKey}
            placeholder="Pick a modal…"
            searchPlaceholder="Search modals…"
            ariaLabel="Dashboard modal"
            collapsibleGroups
            minTriggerWidth={220}
          />
          <SBDM
            items={langItems}
            value={lang}
            onSelect={(k) => void pickLanguage(k)}
            placeholder="Language"
            searchPlaceholder="Search languages…"
            ariaLabel="Language"
            collapsibleGroups
            minTriggerWidth={180}
            footnote="Picking a new language auto-translates every English string with Claude, then you can correct it."
          />
        </Pickers>

        {busy === "seeding" && <Info>Translating the whole registry — this takes a few seconds…</Info>}
        {err && <Err>{err}</Err>}
        {note && <Ok>{note}</Ok>}

        <Fields>
          {!spec && <Info>Pick a modal to edit.</Info>}
          {spec?.fields.map((f) => {
            const saved = fields[modalKey]?.[f.key];
            const multiline = f.kind === "lead" || f.kind === "helper" || f.kind === "empty";
            const id = `${modalKey}.${f.key}`;
            return (
              <Field key={f.key}>
                <LabelRow>
                  <Label>{f.label}</Label>
                  {saved?.source === "machine" && <Badge>auto-translated</Badge>}
                  {saved?.source === "human" && <BadgeHuman>edited</BadgeHuman>}
                </LabelRow>
                {multiline ? (
                  <Area
                    rows={3}
                    value={shown(f.key)}
                    placeholder={f.default}
                    onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
                  />
                ) : (
                  <Input
                    value={shown(f.key)}
                    placeholder={f.default}
                    onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
                  />
                )}
                {f.note && <Hint>{f.note}</Hint>}
                {(saved || id in draft) && (
                  <Revert
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, [id]: "" }))}
                    title="Clear the override and fall back to the shipped English"
                  >
                    Revert to default
                  </Revert>
                )}
              </Field>
            );
          })}
        </Fields>

        <Actions>
          <Btn type="button" disabled={!dirty || !!busy} onClick={() => void saveAll()}>
            {busy === "saving" ? "Saving…" : "Save copy"}
          </Btn>
          <BtnGhost type="button" onClick={onClose}>
            Close
          </BtnGhost>
        </Actions>
      </Panel>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1001;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
`;

const Panel = styled.div`
  width: 44rem;
  max-width: 96vw;
  max-height: 88vh;
  overflow: auto;
  background: var(--t-bg);
  border: 1px solid rgba(${rgb.violet}, 0.4);
  border-radius: 0.75rem;
  padding: 1.25rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  --ddm-accent: ${colors.violet};
  --ddm-accent-rgb: ${rgb.violet};
`;

const Title = styled.div`
  font-weight: 700;
  color: ${colors.violet};
  letter-spacing: 0.03em;
`;

const Lead = styled.p`
  margin: 0.35rem 0 0.9rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--t-textFaint);
`;

const Pickers = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.9rem;
`;

const Fields = styled.div`
  display: grid;
  gap: 0.85rem;
`;

const Field = styled.div``;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
`;

const Label = styled.div`
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t-textFaint);
`;

const Badge = styled.span`
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.08rem 0.35rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(255, 200, 80, 0.45);
  color: #ffcf72;
`;

const BadgeHuman = styled(Badge)`
  border-color: rgba(${rgb.violet}, 0.5);
  color: ${colors.violet};
`;

const inputCss = `
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 0.4rem;
  padding: 0.45rem 0.6rem;
  color: var(--t-text);
  font-size: 0.85rem;
  font-family: inherit;
  &::placeholder { color: var(--t-textFaint); opacity: 0.65; }
  &:focus { outline: none; }
`;

const Input = styled.input`
  ${inputCss}
  border: 1px solid rgba(${rgb.violet}, 0.3);
  &:focus { border-color: rgba(${rgb.violet}, 0.7); }
`;

const Area = styled.textarea`
  ${inputCss}
  border: 1px solid rgba(${rgb.violet}, 0.3);
  resize: vertical;
  line-height: 1.45;
  &:focus { border-color: rgba(${rgb.violet}, 0.7); }
`;

const Hint = styled.div`
  margin-top: 0.3rem;
  font-size: 0.68rem;
  line-height: 1.4;
  color: var(--t-textFaint);
`;

const Revert = styled.button`
  margin-top: 0.3rem;
  background: none;
  border: none;
  padding: 0;
  font-size: 0.68rem;
  color: var(--t-textFaint);
  text-decoration: underline;
  cursor: pointer;
  &:hover { color: ${colors.violet}; }
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.1rem;
`;

const Info = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  margin-bottom: 0.6rem;
`;

const Err = styled.div`
  font-size: 0.75rem;
  color: #ff7b7b;
  margin-bottom: 0.6rem;
`;

const Ok = styled.div`
  font-size: 0.75rem;
  color: ${colors.violet};
  margin-bottom: 0.6rem;
`;

const Btn = styled.button`
  background: rgba(${rgb.violet}, 0.12);
  border: 1px solid rgba(${rgb.violet}, 0.5);
  color: ${colors.violet};
  border-radius: 0.45rem;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  &:disabled { opacity: 0.45; cursor: default; }
`;

const BtnGhost = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: var(--t-text);
  border-radius: 0.45rem;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  font-size: 0.8rem;
`;
