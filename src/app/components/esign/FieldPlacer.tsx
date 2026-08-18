"use client";

// FieldPlacer — build each signer's set of fields on a rendered preview of the staged PDF:
// start from a baked-in layout, tick the marks this document asks that person for
// (sign · initials · full name · date), then drag each box onto the printed line it belongs on.
//
// The layouts are the fast path, because paper repeats itself: sign and date at the foot of
// the last page, or initials down every margin with the signature at the end. One click lays
// that over the whole roster, each signer on their own row; dragging is what the document
// that doesn't fit them needs.
//
// Six kinds. Four are the marks that make a contract signed (sign · initials · name · date);
// Text and Number are the data-entry boxes a real form also asks for, and they carry the one
// property the marks cannot — Documenso only honours "optional" on TEXT/NUMBER, so the middle
// name nobody has has to be a Text box. A multi-page agreement wants initials in the corner of
// every page and the signature only on the last, so a signer's placement is a LIST of boxes —
// any number, any kind, any page — not the one signature+date pair the first cut allowed.
//
// The list is also the EDITOR: every box a signer has gets a row in that signer's field-list
// ADDM, where it can be named ("Middle name (if you have one)"), marked optional, revealed on
// the page, dropped, or dragged into the sequence the signer will be walked through. Ticking a
// kind adds a row; the rows are the truth, the boxes on the page are the same fields seen from
// above. Row order IS signer order — the operator drags it when the form reads in an order the
// page geometry gets wrong.
//
// Rendering: pdfjs-dist, loaded lazily inside an effect (never at module scope — the
// package is Mac-build-bundled client code; RCS's server runtime must never import it).
// Coordinates: percent of the page (0–100), Documenso's own field convention, so what the
// operator places here is byte-for-byte what /document/field/create-many receives.
// Defaults: every signer seeds with the auto-stacked signature+date pair (mirror of the
// module's stackedFieldPlacements) — an untouched placer reproduces the old behavior.
//
// Styled-components only (Office no-Tailwind rule). Self-contained; parent owns state.

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

export type PlacedRect = { pageX: number; pageY: number; width: number; height: number };
export type FieldKind = "signature" | "initials" | "name" | "date" | "text" | "number";
export type PlacedField = {
  id: string;
  kind: FieldKind;
  pageNumber: number;
  rect: PlacedRect;
  /**
   * Must the signer fill this in before the document can complete? Default true (absent).
   * Only meaningful on text/number — Documenso treats a signature, initials, name or date as
   * required whatever we send, so the checkbox is locked on for those rather than promising a
   * signer something the service will not honour.
   */
  required?: boolean;
  /** The operator's own words for the box — what to type. Essential on text/number. */
  label?: string;
};
/** Everything ONE signer is asked to fill in. Empty is never sent — see the parent. */
export type SignerPlacement = { fields: PlacedField[] };

type Signer = { email: string; name: string | null };

// One color per signer index — box borders, fills, and legend chips all key off this.
const COLORS = ["#3aa0ff", "#ff4ecb", "#ffc24e", "#6ee7a0", "#b39bff", "#ff8a5c", "#5ce1e6", "#f2f261", "#ff9ab8", "#9adcff"];
const MAX_PREVIEW_PAGES = 40;

const KINDS: readonly FieldKind[] = ["signature", "initials", "name", "date", "text", "number"];
/** Pill text — short, because six of them sit on one chip row per signer. */
const KIND_PILL: Record<FieldKind, string> = {
  signature: "Sign",
  initials: "Initials",
  name: "Name",
  date: "Date",
  text: "Text",
  number: "Number",
};
/** What the box itself says, and what the tooltips call the field. */
const KIND_NOUN: Record<FieldKind, string> = {
  signature: "sign",
  initials: "initials",
  name: "full name",
  date: "date",
  text: "text",
  number: "number",
};
/**
 * The only two kinds that can be optional. Verified in the running Documenso (v2.14.0):
 * isRequiredField() short-circuits to TRUE for every type outside its
 * ADVANCED_FIELD_TYPES_WITH_OPTIONAL_SETTING list (NUMBER · TEXT · DROPDOWN · RADIO ·
 * CHECKBOX), so "optional" on a signature box would be a promise the service breaks.
 */
const OPTIONAL_CAPABLE: readonly FieldKind[] = ["text", "number"];
const canBeOptional = (kind: FieldKind) => OPTIONAL_CAPABLE.includes(kind);
/** What the wire will actually enforce for this box. */
const isRequired = (f: PlacedField) => (canBeOptional(f.kind) ? f.required !== false : true);
/** The row's own words: the operator's label when they wrote one, else the kind. */
const fieldTitle = (f: PlacedField) => f.label?.trim() || KIND_NOUN[f.kind];

// Minimal structural typing for the slice of pdfjs we use — keeps us off its shifting
// published types while the caret range floats within 5.x.
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }) => { promise: Promise<void> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> };

/** Ids only have to be unique within one placer session — they never leave the browser. */
let fieldSeq = 0;
const mkField = (kind: FieldKind, pageNumber: number, rect: PlacedRect): PlacedField => ({
  id: `f${++fieldSeq}`,
  kind,
  pageNumber,
  rect,
});

/** The auto-stack row this signer would get if the operator placed nothing (module mirror). */
function rowY(index: number, count: number): number {
  const BASE_Y = 80;
  const MIN_Y = 6;
  const rowH = Math.min(9, count > 1 ? (BASE_Y - MIN_Y) / (count - 1) : 9);
  return Math.max(MIN_Y, BASE_Y - (count - 1 - index) * rowH);
}

/** Where a newly ticked kind lands: on the signer's own row, in that kind's usual column. */
function defaultRect(kind: FieldKind, y: number): PlacedRect {
  switch (kind) {
    case "signature":
      return { pageX: 12, pageY: y, width: 45, height: 8 };
    case "date":
      return { pageX: 62, pageY: y + 1, width: 24, height: 6 };
    case "name":
      return { pageX: 12, pageY: Math.max(0, y - 8), width: 34, height: 6 };
    case "initials":
      return { pageX: 88, pageY: y, width: 9, height: 6 };
    // The two data-entry boxes land ABOVE the signing row, where a form's questions print —
    // a text line across the left, a short number field beside it.
    case "text":
      return { pageX: 12, pageY: Math.max(0, y - 16), width: 40, height: 6 };
    case "number":
      return { pageX: 58, pageY: Math.max(0, y - 16), width: 18, height: 6 };
  }
}

/** The margin stamp, one lane per signer so two people initialling the same page don't
 *  land on top of each other. Lanes run up from the bottom corner. */
function initialsRect(index: number): PlacedRect {
  return { pageX: 86, pageY: Math.max(3, 90 - index * 7), width: 10, height: 5 };
}

/**
 * The baked-in layouts — how paper actually asks. An operator opens the placer on a
 * contract they have read once, and the fastest true answer is almost always one of these
 * four; dragging is for the document that doesn't fit them. Applying one REPLACES every
 * signer's boxes (each on their own stacked row), which is why they read as a starting
 * point rather than a toggle: after this, the operator drags.
 */
type Layout = {
  id: string;
  label: string;
  hint: string;
  /** One signer's boxes. index/count position their row; pages is the preview's reach. */
  build: (index: number, count: number, lastPage: number, pages: number) => PlacedField[];
};

const LAYOUTS: readonly Layout[] = [
  {
    id: "sign-date",
    label: "Sign & date",
    hint: "A signature and the date at the foot of the last page. The house default.",
    build: (i, n, last) => {
      const y = rowY(i, n);
      return [
        mkField("signature", last, defaultRect("signature", y)),
        mkField("date", last, defaultRect("date", y)),
      ];
    },
  },
  {
    id: "sign-only",
    label: "Sign only",
    hint: "One signature and nothing else — for a form that already carries its own date.",
    build: (i, n, last) => [mkField("signature", last, defaultRect("signature", rowY(i, n)))],
  },
  {
    id: "name-sign-date",
    label: "Name, sign & date",
    hint: "The name spelled out above the signature, then the date. How a witnessed form asks.",
    build: (i, n, last) => {
      const y = rowY(i, n);
      return [
        mkField("name", last, defaultRect("name", y)),
        mkField("signature", last, defaultRect("signature", y)),
        mkField("date", last, defaultRect("date", y)),
      ];
    },
  },
  {
    id: "initial-throughout",
    label: "Initial every page, sign at the end",
    hint: "Initials in the margin of every page with the signature and date on the last — the multi-page contract.",
    build: (i, n, last, pages) => {
      const y = rowY(i, n);
      const out: PlacedField[] = [];
      for (let p = 1; p <= pages; p++) out.push(mkField("initials", p, initialsRect(i)));
      out.push(mkField("signature", last, defaultRect("signature", y)));
      out.push(mkField("date", last, defaultRect("date", y)));
      return out;
    },
  },
];

/** Client mirror of the module's stackedFieldPlacements (signature + date, last page). */
function seedDefault(index: number, count: number, lastPage: number): SignerPlacement {
  return { fields: LAYOUTS[0].build(index, count, lastPage, lastPage) };
}

type DragState = {
  email: string;
  /** WHICH box the gesture owns — kind names the target, never the gesture, which is
   *  what lets every kind move and resize down one code path. */
  fieldId: string;
  /** What the gesture does to it: carry it, or drag its bottom-right corner. */
  mode: "move" | "resize";
  /** Pointer's grab offset inside the box, in percent of the page. */
  offX: number;
  offY: number;
};

/** Resize floor/ceiling per kind, in percent of the page. Initials are a corner stamp;
 *  a signature is a line across the page — both have a range, and they aren't the same. */
const LIMITS: Record<FieldKind, { minW: number; maxW: number; minH: number; maxH: number }> = {
  signature: { minW: 8, maxW: 95, minH: 3, maxH: 40 },
  initials: { minW: 4, maxW: 40, minH: 2, maxH: 20 },
  name: { minW: 6, maxW: 80, minH: 2, maxH: 20 },
  date: { minW: 5, maxW: 60, minH: 2, maxH: 20 },
  text: { minW: 6, maxW: 95, minH: 2, maxH: 30 },
  number: { minW: 4, maxW: 50, minH: 2, maxH: 20 },
};

export default function FieldPlacer({
  file,
  signers,
  placements,
  onChange,
}: {
  file: File;
  signers: Signer[];
  placements: Record<string, SignerPlacement>;
  onChange: (next: Record<string, SignerPlacement>) => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [renderTick, setRenderTick] = useState(0); // bumped when the doc (re)loads
  const docRef = useRef<PdfDoc | null>(null);
  const wrapRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** Which signers' field lists are open. Absent = open (ADDM canon: content on first paint). */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  /** The row the operator last touched — its box flashes on the page so a long document
   *  does not make them hunt for which rectangle they are editing. */
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Index the row drag started from; reordering happens live as it passes each row. */
  const rowDragRef = useRef<number | null>(null);

  // ── load the PDF whenever the staged file changes ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let doc: PdfDoc | null = null;
    setStatus("loading");
    setNumPages(0);
    (async () => {
      try {
        const pdfjs = (await import("pdfjs-dist")) as unknown as {
          GlobalWorkerOptions: { workerSrc: string };
          getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> };
        };
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const data = await file.arrayBuffer();
        doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) { doc.destroy().catch(() => {}); return; }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
        setRenderTick((t) => t + 1);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      docRef.current = null;
      doc?.destroy().catch(() => {});
    };
  }, [file]);

  // ── seed defaults for new signers / prune removed ones (once pages are known) ──
  useEffect(() => {
    if (status !== "ready" || !numPages) return;
    const lastPage = Math.min(numPages, MAX_PREVIEW_PAGES);
    const emails = new Set(signers.map((s) => s.email));
    let changed = false;
    const next: Record<string, SignerPlacement> = {};
    signers.forEach((s, i) => {
      const existing = placements[s.email];
      if (existing) {
        next[s.email] = existing;
      } else {
        next[s.email] = seedDefault(i, signers.length, lastPage);
        changed = true;
      }
    });
    if (Object.keys(placements).some((e) => !emails.has(e))) changed = true;
    if (changed) onChange(next);
  }, [status, numPages, signers, placements, onChange]);

  const shownPages = Math.min(numPages, MAX_PREVIEW_PAGES);
  const lastPage = shownPages || 1;

  // ── the field set: tick a kind on/off, add another, drop one ───────────────────
  const setFields = useCallback(
    (email: string, fields: PlacedField[]) => {
      onChange({ ...placements, [email]: { fields } });
    },
    [placements, onChange],
  );

  /** Tick a kind on (one box on the signer's row) or off (every box of that kind).
   *  The last remaining box can't be removed: a signer with nothing to fill in can never
   *  finish, and in a sequential chain that stalls everyone behind them. */
  const toggleKind = (email: string, index: number, kind: FieldKind) => {
    const cur = placements[email]?.fields ?? [];
    const have = cur.filter((f) => f.kind === kind);
    if (have.length) {
      const rest = cur.filter((f) => f.kind !== kind);
      if (!rest.length) return;
      setFields(email, rest);
    } else {
      setFields(email, [...cur, mkField(kind, lastPage, defaultRect(kind, rowY(index, signers.length)))]);
    }
  };

  /** Another box of a kind the signer already has — offset from the last one so it's
   *  visibly a second box rather than one hidden exactly under the first. */
  const addField = (email: string, index: number, kind: FieldKind) => {
    const cur = placements[email]?.fields ?? [];
    const prev = [...cur].reverse().find((f) => f.kind === kind);
    const base = prev ? prev.rect : defaultRect(kind, rowY(index, signers.length));
    const rect: PlacedRect = {
      ...base,
      pageX: Math.min(100 - base.width, base.pageX + 2),
      pageY: Math.min(100 - base.height, base.pageY + 2),
    };
    setFields(email, [...cur, mkField(kind, prev?.pageNumber ?? lastPage, rect)]);
  };

  /** One initials box in the corner of every page that hasn't got one yet — the whole
   *  reason a multi-page contract is tedious to prepare by hand. */
  const initialEveryPage = (email: string, index: number) => {
    const cur = placements[email]?.fields ?? [];
    const taken = new Set(cur.filter((f) => f.kind === "initials").map((f) => f.pageNumber));
    const added: PlacedField[] = [];
    for (let n = 1; n <= shownPages; n++) {
      if (taken.has(n)) continue;
      added.push(mkField("initials", n, initialsRect(index)));
    }
    if (added.length) setFields(email, [...cur, ...added]);
  };

  const removeField = (email: string, id: string) => {
    const cur = placements[email]?.fields ?? [];
    if (cur.length <= 1) return;
    setFields(email, cur.filter((f) => f.id !== id));
  };

  /** Patch one box in place — the field list's rows all edit through here. */
  const patchField = (email: string, id: string, patch: Partial<PlacedField>) => {
    const cur = placements[email]?.fields ?? [];
    setFields(email, cur.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  /**
   * Move a row within the signer's list. Row order IS the order the signer meets their boxes,
   * so this is the operator saying "ask for the middle name after the last name" about a form
   * whose printed layout says otherwise.
   */
  const moveRow = (email: string, from: number, to: number) => {
    const cur = placements[email]?.fields ?? [];
    if (from === to || from < 0 || to < 0 || from >= cur.length || to >= cur.length) return;
    const next = [...cur];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setFields(email, next);
  };

  /** Put the list back in reading order — page by page, down each page. The order Documenso
   *  itself walks a signer through, and the right answer after boxes have been dragged about. */
  const sortReadingOrder = (email: string) => {
    const cur = placements[email]?.fields ?? [];
    setFields(
      email,
      [...cur].sort(
        (a, b) =>
          a.pageNumber - b.pageNumber || a.rect.pageY - b.rect.pageY || a.rect.pageX - b.rect.pageX,
      ),
    );
  };

  /** Bring a row's box into view and flash it. */
  const revealField = (f: PlacedField) => {
    setActiveId(f.id);
    wrapRefs.current.get(f.pageNumber)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // ── drag / resize ─────────────────────────────────────────────────────────────
  const pageAt = useCallback((clientY: number): { n: number; rect: DOMRect } | null => {
    let best: { n: number; rect: DOMRect } | null = null;
    for (const [n, el] of wrapRefs.current) {
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return { n, rect };
      if (!best || Math.abs(clientY - (rect.top + rect.height / 2)) < Math.abs(clientY - (best.rect.top + best.rect.height / 2))) {
        best = { n, rect };
      }
    }
    return best; // nearest page when the pointer is between/outside pages
  }, []);

  /** The page a box already lives on — a resize measures against THAT page, never
   *  whichever one the pointer happens to be over. */
  const pageFor = useCallback((n: number): { n: number; rect: DOMRect } | null => {
    const el = wrapRefs.current.get(n);
    return el ? { n, rect: el.getBoundingClientRect() } : null;
  }, []);

  const onBoxPointerDown = (
    e: React.PointerEvent,
    email: string,
    field: PlacedField,
    mode: DragState["mode"],
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const wrap = wrapRefs.current.get(field.pageNumber);
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const ptrX = ((e.clientX - wr.left) / wr.width) * 100;
    const ptrY = ((e.clientY - wr.top) / wr.height) * 100;
    dragRef.current = {
      email,
      fieldId: field.id,
      mode,
      offX: mode === "resize" ? 0 : ptrX - field.rect.pageX,
      offY: mode === "resize" ? 0 : ptrY - field.rect.pageY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const cur = placements[drag.email]?.fields;
    const field = cur?.find((f) => f.id === drag.fieldId);
    if (!cur || !field) return;
    // A move can carry a box onto another page, so it re-reads which page is under the
    // pointer. A resize stays anchored to the page the box is already on — otherwise
    // dragging the corner past the page edge would re-measure against the next page
    // down and the box would snap to a nonsense size.
    const target = drag.mode === "resize" ? pageFor(field.pageNumber) : pageAt(e.clientY);
    if (!target) return;
    const ptrX = Math.min(100, Math.max(0, ((e.clientX - target.rect.left) / target.rect.width) * 100));
    const ptrY = Math.min(100, Math.max(0, ((e.clientY - target.rect.top) / target.rect.height) * 100));

    let updated: PlacedField;
    if (drag.mode === "resize") {
      // bottom-right handle: the box grows toward the pointer; page never changes here
      const lim = LIMITS[field.kind];
      const width = Math.min(lim.maxW, Math.max(lim.minW, ptrX - field.rect.pageX));
      const height = Math.min(lim.maxH, Math.max(lim.minH, ptrY - field.rect.pageY));
      updated = { ...field, rect: { ...field.rect, width, height } };
    } else {
      const pageX = Math.min(100 - field.rect.width, Math.max(0, ptrX - drag.offX));
      const pageY = Math.min(100 - field.rect.height, Math.max(0, ptrY - drag.offY));
      updated = { ...field, pageNumber: target.n, rect: { ...field.rect, pageX, pageY } };
    }
    onChange({
      ...placements,
      [drag.email]: { fields: cur.map((f) => (f.id === updated.id ? updated : f)) },
    });
  };

  const onPointerUp = () => { dragRef.current = null; };

  /** Lay a baked-in layout over the whole roster — everyone asked for the same marks, each
   *  on their own row. One click, then drag whatever the document puts somewhere unusual. */
  const applyLayout = (layout: Layout) => {
    if (status !== "ready" || !numPages) return;
    const next: Record<string, SignerPlacement> = {};
    signers.forEach((s, i) => {
      next[s.email] = { fields: layout.build(i, signers.length, lastPage, shownPages) };
    });
    onChange(next);
  };

  if (status === "error") {
    return <Note>Preview failed for this PDF — signature boxes will auto-stack on the last page instead.</Note>;
  }

  return (
    <Wrap ref={containerRef}>
      <Layouts>
        <LayoutsLabel>Start from</LayoutsLabel>
        {LAYOUTS.map((l) => (
          <LayoutBtn
            key={l.id}
            type="button"
            title={`${l.hint} Replaces every signer's boxes.`}
            disabled={status !== "ready"}
            onClick={() => applyLayout(l)}
          >
            {l.label}
          </LayoutBtn>
        ))}
      </Layouts>
      <Roster>
        {signers.map((s, i) => {
          const c = COLORS[i % COLORS.length];
          const fields = placements[s.email]?.fields ?? [];
          const only = fields.length <= 1;
          const open = !collapsed[s.email];
          return (
            <SignerCard key={s.email} $c={c}>
              <SignerHead>
                <Dot $c={c} />
                <Who title={s.email}>{i + 1}. {s.name || s.email}</Who>
                {KINDS.map((k) => {
                  const n = fields.filter((f) => f.kind === k).length;
                  const locked = n > 0 && only;
                  return (
                    <PillGroup key={k} $c={c} $on={n > 0}>
                      <PillMain
                        type="button"
                        $on={n > 0}
                        disabled={locked}
                        title={
                          locked
                            ? "Every signer needs at least one field — add another before removing this one"
                            : n > 0
                              ? `Remove this signer's ${KIND_NOUN[k]} ${n > 1 ? "boxes" : "box"}`
                              : `Ask this signer for their ${KIND_NOUN[k]}`
                        }
                        onClick={() => toggleKind(s.email, i, k)}
                      >
                        <Tick $on={n > 0} aria-hidden="true">
                          {n > 0 ? (
                            <svg viewBox="0 0 12 12" width="9" height="9">
                              <path d="M2 6.3 L4.7 9 L10 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : null}
                        </Tick>
                        {KIND_PILL[k]}
                        {n > 1 && <Count>{n}</Count>}
                      </PillMain>
                      {n > 0 && (
                        <PillAdd
                          type="button"
                          title={`Add another ${KIND_NOUN[k]} box for this signer`}
                          aria-label={`Add another ${KIND_NOUN[k]} box for signer ${i + 1}`}
                          onClick={() => addField(s.email, i, k)}
                        >
                          <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                            <path d="M6 2 V10 M2 6 H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                          </svg>
                        </PillAdd>
                      )}
                    </PillGroup>
                  );
                })}
                {shownPages > 1 && (
                  <GhostBtn
                    type="button"
                    title="Put an initials box in the corner of every page"
                    onClick={() => initialEveryPage(s.email, i)}
                  >
                    initial every page
                  </GhostBtn>
                )}
              </SignerHead>
                <FieldList>
                  <AddmHead
                    type="button"
                    $c={c}
                    $open={open}
                    aria-expanded={open}
                    onClick={() => setCollapsed((m) => ({ ...m, [s.email]: open }))}
                  >
                    <AddmLabel $c={c} $open={open}>
                      Fields for this signer
                    </AddmLabel>
                    <AddmCount $c={c}>{fields.length}</AddmCount>
                    <AddmToggle $open={open} aria-hidden="true" />
                  </AddmHead>
                  {open && (
                    <AddmBody>
                      {fields.map((f, fi) => {
                        const req = isRequired(f);
                        const lockedReq = !canBeOptional(f.kind);
                        return (
                          <FieldRow
                            key={f.id}
                            $c={c}
                            $active={activeId === f.id}
                            draggable
                            onDragStart={() => { rowDragRef.current = fi; }}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnter={() => {
                              const from = rowDragRef.current;
                              if (from === null || from === fi) return;
                              moveRow(s.email, from, fi);
                              rowDragRef.current = fi;
                            }}
                            onDragEnd={() => { rowDragRef.current = null; }}
                            onClick={() => revealField(f)}
                          >
                            {/* The grip is the drag target AND the keyboard one — arrow keys
                                move the row, because a sequence an operator can only set by
                                mouse is a sequence some operators cannot set. */}
                            <Grip
                              title="Drag to reorder — this is the order the signer is walked through"
                              aria-label={`Move ${fieldTitle(f)}: step ${fi + 1} of ${fields.length}`}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp") { e.preventDefault(); moveRow(s.email, fi, fi - 1); }
                                if (e.key === "ArrowDown") { e.preventDefault(); moveRow(s.email, fi, fi + 1); }
                              }}
                            >
                              <svg viewBox="0 0 10 12" width="10" height="12" aria-hidden="true">
                                <path
                                  d="M2 2.5h6M2 6h6M2 9.5h6"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  fill="none"
                                />
                              </svg>
                            </Grip>
                            <Step>{fi + 1}</Step>
                            <KindChip $c={c}>{KIND_PILL[f.kind]}</KindChip>
                            {canBeOptional(f.kind) ? (
                              <LabelInput
                                value={f.label ?? ""}
                                placeholder={f.kind === "number" ? "What number? e.g. Policy no." : "What to type? e.g. Middle name"}
                                maxLength={120}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => patchField(s.email, f.id, { label: e.target.value })}
                              />
                            ) : (
                              <RowNoun>{KIND_NOUN[f.kind]}</RowNoun>
                            )}
                            <PageChip title={`Sits on page ${f.pageNumber}`}>p{f.pageNumber}</PageChip>
                            <ReqLabel
                              $on={req}
                              $locked={lockedReq}
                              title={
                                lockedReq
                                  ? `A ${KIND_NOUN[f.kind]} field is always required — only Text and Number boxes can be left blank`
                                  : req
                                    ? "Required — the signer cannot finish without it"
                                    : "Optional — the signer may leave this blank"
                              }
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ReqBox
                                type="checkbox"
                                checked={req}
                                disabled={lockedReq}
                                onChange={(e) => patchField(s.email, f.id, { required: e.target.checked })}
                              />
                              required
                            </ReqLabel>
                            {fields.length > 1 && (
                              <RowX
                                type="button"
                                title={`Remove this ${fieldTitle(f)} box`}
                                aria-label={`Remove this ${fieldTitle(f)} box`}
                                onClick={(e) => { e.stopPropagation(); removeField(s.email, f.id); }}
                              >
                                <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                                  <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                                </svg>
                              </RowX>
                            )}
                          </FieldRow>
                        );
                      })}
                      <RowFoot>
                        <GhostBtn
                          type="button"
                          title="Put the list back in reading order — page by page, down each page"
                          onClick={() => sortReadingOrder(s.email)}
                        >
                          reading order
                        </GhostBtn>
                        <Note>
                          Drag a row to set the order this signer is walked through. A starred box on
                          the page is one they must fill in.
                        </Note>
                      </RowFoot>
                    </AddmBody>
                  )}
                </FieldList>
            </SignerCard>
          );
        })}
      </Roster>
      <Note>
        Start from a layout, or tick what this document asks each person for — then drag their boxes
        onto the printed lines; recipients only ever see their own. Drag a corner to resize, X a box
        to drop it, and use <strong>initial every page</strong> for one signer at a time.
      </Note>
      {status === "loading" && <Note>Rendering preview…</Note>}
      {status === "ready" && (
        <Pages onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {Array.from({ length: shownPages }, (_, i) => i + 1).map((n) => (
            <PageWrap
              key={`${renderTick}-${n}`}
              ref={(el) => {
                if (el) wrapRefs.current.set(n, el);
                else wrapRefs.current.delete(n);
              }}
            >
              <PageCanvas doc={docRef.current} pageNumber={n} />
              <PageNo>{n} / {numPages}</PageNo>
              {signers.map((s, i) => {
                const c = COLORS[i % COLORS.length];
                const fields = placements[s.email]?.fields ?? [];
                const only = fields.length <= 1;
                return fields
                  .filter((f) => f.pageNumber === n)
                  .map((f) => (
                    <Box
                      key={f.id}
                      $c={c}
                      $dashed={f.kind !== "signature"}
                      $active={activeId === f.id}
                      style={{
                        left: `${f.rect.pageX}%`,
                        top: `${f.rect.pageY}%`,
                        width: `${f.rect.width}%`,
                        height: `${f.rect.height}%`,
                      }}
                      onPointerDown={(e) => onBoxPointerDown(e, s.email, f, "move")}
                    >
                      {/* A star means the signer cannot finish without it — the same mark a
                          paper form uses, so the operator reads their own document the way
                          the signer will. Optional boxes say so instead. */}
                      <BoxLabel>
                        {i + 1} ·{" "}
                        {f.kind === "signature" && !f.label
                          ? `${s.name || s.email} — sign`
                          : fieldTitle(f)}
                        {isRequired(f) ? <Star aria-hidden="true">*</Star> : <Opt> (optional)</Opt>}
                      </BoxLabel>
                      {/* pointerdown is where a drag starts, so the X has to stop it there —
                          stopping the click alone would leave the box travelling with the
                          pointer after the removal. */}
                      {!only && (
                        <BoxX
                          type="button"
                          title={`Remove this ${KIND_NOUN[f.kind]} box`}
                          aria-label={`Remove a ${KIND_NOUN[f.kind]} box for signer ${i + 1}`}
                          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => { e.stopPropagation(); removeField(s.email, f.id); }}
                        >
                          <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                            <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                          </svg>
                        </BoxX>
                      )}
                      <ResizeHandle $c={c} onPointerDown={(e) => onBoxPointerDown(e, s.email, f, "resize")} />
                    </Box>
                  ));
              })}
            </PageWrap>
          ))}
          {numPages > MAX_PREVIEW_PAGES && (
            <Note>Only the first {MAX_PREVIEW_PAGES} pages are shown — boxes can be placed on these pages.</Note>
          )}
        </Pages>
      )}
    </Wrap>
  );
}

// Each page renders itself once into its own canvas (sequential enough in practice —
// pdfjs queues page work internally; docs here are a handful of pages).
function PageCanvas({ doc, pageNumber }: { doc: PdfDoc | null; pageNumber: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = ref.current;
      if (!doc || !canvas) return;
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const cssW = canvas.parentElement?.clientWidth || 680;
        const base = page.getViewport({ scale: 1 });
        const scale = cssW / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: scale * dpr });
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
      } catch {
        /* page render failure leaves a blank page; boxes still work */
      }
    })();
    return () => { cancelled = true; };
  }, [doc, pageNumber]);
  return <canvas ref={ref} />;
}

// ── styled ──────────────────────────────────────────────────────────────────────
const Wrap = styled.div`display: flex; flex-direction: column; gap: 6px; margin-top: 4px;`;
const Roster = styled.div`display: flex; flex-direction: column; gap: 5px;`;
const SignerCard = styled.div<{ $c: string }>`
  display: flex; flex-direction: column; gap: 5px;
  padding: 5px 8px; border-radius: 10px;
  border: 1px solid ${(p) => p.$c}44; background: ${(p) => p.$c}10;
`;
const SignerHead = styled.div`display: flex; flex-wrap: wrap; align-items: center; gap: 5px;`;

/* ── the field-list ADDM (Accordion Dropdown, per vocabulary/ADDM.md): accent-tinted
   uppercase label + count chip + a bold +/− toggle, whole row is the hit target, default
   open. One per signer, and the accent is that signer's own color. ─────────────────── */
const FieldList = styled.div`display: flex; flex-direction: column;`;
const AddmHead = styled.button<{ $c: string; $open: boolean }>`
  display: flex; align-items: center; gap: 6px; width: 100%; text-align: left;
  padding: 4px 8px; border-radius: 8px; cursor: pointer;
  background: ${(p) => (p.$open ? `${p.$c}1a` : `${p.$c}0d`)};
  border: 1px solid ${(p) => (p.$open ? `${p.$c}80` : `${p.$c}33`)};
  &:hover { background: ${(p) => p.$c}20; border-color: ${(p) => p.$c}aa; }
`;
const AddmLabel = styled.span<{ $c: string; $open: boolean }>`
  flex: 1 1 auto; font-size: 9.5px; letter-spacing: 0.09em; text-transform: uppercase;
  color: ${(p) => (p.$open ? p.$c : `${p.$c}a6`)};
`;
const AddmCount = styled.span<{ $c: string }>`
  font-size: 9.5px; font-weight: 700; line-height: 1; padding: 2px 5px; border-radius: 999px;
  background: ${(p) => p.$c}2e; color: #f2f3f8;
`;
/** The +/− indicator: a bar always, plus the upright only when closed (no glyph characters). */
function AddmToggle({ $open, ...rest }: { $open: boolean } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" width="14" height="14" {...rest}>
      <path d="M4 9h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {!$open && (
        <path d="M9 4v10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}
const AddmBody = styled.div`display: flex; flex-direction: column; gap: 3px; padding: 4px 0 2px;`;
const FieldRow = styled.div<{ $c: string; $active: boolean }>`
  display: flex; align-items: center; gap: 5px; padding: 3px 6px; border-radius: 8px;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$active ? `${p.$c}cc` : "rgba(255,255,255,0.09)")};
  background: ${(p) => (p.$active ? `${p.$c}1f` : "rgba(255,255,255,0.03)")};
  &:hover { border-color: ${(p) => p.$c}88; }
`;
const Grip = styled.span`
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
  width: 14px; color: rgba(232,232,239,0.5); cursor: grab;
  &:hover, &:focus-visible { color: #fff; outline: none; }
  &:focus-visible { box-shadow: 0 0 0 2px rgba(120,200,255,0.65); border-radius: 3px; }
`;
const Step = styled.span`
  flex: 0 0 auto; min-width: 14px; text-align: center; font-size: 9.5px; font-weight: 700;
  color: rgba(232,232,239,0.55); font-variant-numeric: tabular-nums;
`;
const KindChip = styled.span<{ $c: string }>`
  flex: 0 0 auto; font-size: 10px; line-height: 1.5; padding: 1px 7px; border-radius: 999px;
  background: ${(p) => p.$c}2e; border: 1px solid ${(p) => p.$c}77; color: #f2f3f8;
`;
const RowNoun = styled.span`
  flex: 1 1 auto; font-size: 11px; color: rgba(232,232,239,0.72);
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
`;
const LabelInput = styled.input`
  flex: 1 1 90px; min-width: 0; font: inherit; font-size: 11px; line-height: 1.5;
  padding: 2px 7px; border-radius: 6px; color: #f2f3f8;
  background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.14);
  &::placeholder { color: rgba(232,232,239,0.38); }
  &:focus { outline: none; border-color: rgba(120,200,255,0.7); }
`;
const PageChip = styled.span`
  flex: 0 0 auto; font-size: 9.5px; line-height: 1; padding: 2px 5px; border-radius: 999px;
  background: rgba(0,0,0,0.3); color: rgba(232,232,239,0.65); font-variant-numeric: tabular-nums;
`;
const ReqLabel = styled.label<{ $on: boolean; $locked: boolean }>`
  flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; font-size: 10px;
  color: ${(p) => (p.$on ? "rgba(232,232,239,0.85)" : "rgba(232,232,239,0.45)")};
  cursor: ${(p) => (p.$locked ? "default" : "pointer")};
  opacity: ${(p) => (p.$locked ? 0.55 : 1)};
`;
const ReqBox = styled.input`
  width: 12px; height: 12px; margin: 0; accent-color: #3aa0ff; cursor: inherit;
`;
const RowX = styled.button`
  flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; padding: 0; border-radius: 50%;
  background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.75); cursor: pointer;
  &:hover { background: #d94a5a; border-color: #d94a5a; color: #fff; }
`;
const RowFoot = styled.div`display: flex; align-items: center; gap: 8px; padding: 2px 0 0;`;
const Who = styled.span`
  font-size: 11.5px; color: #e8e8ef; margin-right: 4px; max-width: 34%;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
`;
const Dot = styled.span<{ $c: string }>`
  width: 8px; height: 8px; border-radius: 50%; background: ${(p) => p.$c}; flex: 0 0 auto;
`;
const PillGroup = styled.span<{ $c: string; $on: boolean }>`
  display: inline-flex; align-items: stretch; border-radius: 999px; overflow: hidden;
  border: 1px solid ${(p) => (p.$on ? `${p.$c}aa` : "rgba(255,255,255,0.14)")};
  background: ${(p) => (p.$on ? `${p.$c}22` : "rgba(255,255,255,0.03)")};
`;
const PillMain = styled.button<{ $on: boolean }>`
  display: inline-flex; align-items: center; gap: 4px; background: none; border: 0;
  padding: 3px 9px; font-size: 11px; line-height: 1.5; cursor: pointer;
  color: ${(p) => (p.$on ? "#f2f3f8" : "rgba(232,232,239,0.62)")};
  &:disabled { cursor: default; }
  &:hover:not(:disabled) { color: #fff; }
`;
const Tick = styled.span<{ $on: boolean }>`
  display: inline-flex; align-items: center; justify-content: center;
  width: 12px; height: 12px; border-radius: 3px; flex: 0 0 auto;
  border: 1.5px solid ${(p) => (p.$on ? "currentColor" : "rgba(255,255,255,0.35)")};
`;
const Count = styled.span`
  font-size: 9.5px; font-weight: 700; line-height: 1; padding: 2px 4px; border-radius: 999px;
  background: rgba(0,0,0,0.35);
`;
const PillAdd = styled.button`
  display: inline-flex; align-items: center; justify-content: center; padding: 0 7px;
  background: rgba(0,0,0,0.22); border: 0; border-left: 1px solid rgba(255,255,255,0.16);
  color: rgba(255,255,255,0.75); cursor: pointer;
  &:hover { color: #fff; background: rgba(255,255,255,0.14); }
`;
const GhostBtn = styled.button`
  background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.22); border-radius: 999px;
  color: rgba(232,232,239,0.75); font-size: 10.5px; line-height: 1.5; padding: 3px 9px; cursor: pointer;
  &:hover { color: #fff; border-color: rgba(120,200,255,0.6); }
`;
const Layouts = styled.div`display: flex; flex-wrap: wrap; align-items: center; gap: 5px;`;
const LayoutsLabel = styled.span`
  font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
  color: rgba(232,232,239,0.45); margin-right: 2px;
`;
const LayoutBtn = styled.button`
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px; color: #e8e8ef; padding: 3px 10px; font-size: 11px; line-height: 1.5;
  cursor: pointer;
  &:hover:not(:disabled) { border-color: rgba(120,200,255,0.55); background: rgba(120,200,255,0.12); }
  &:disabled { opacity: 0.45; cursor: default; }
`;
const Note = styled.p`margin: 0; font-size: 11.5px; line-height: 1.5; color: rgba(232,232,239,0.5);`;
const Pages = styled.div`
  display: flex; flex-direction: column; gap: 10px; max-height: 56vh; overflow-y: auto;
  /* The preview sits inside the modal's own scroller; contain keeps a wheel that
     reaches the last page from yanking the whole modal along with it. */
  overscroll-behavior: contain;
  padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
  background: rgba(255,255,255,0.03);
`;
const PageWrap = styled.div`
  /* Never shrink. Pages is a column flex box with a max-height, so the default
     flex-shrink:1 squeezed every page down to a sliver until they all fit — the
     container then had nothing to overflow, so the preview could not be scrolled
     and only the top strip of page one was reachable. A page keeps its rendered
     height and Pages scrolls, which is the whole point of the preview. */
  flex: 0 0 auto;
  position: relative; width: 100%; line-height: 0; border-radius: 4px; overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.45);
  canvas { display: block; background: #fff; }
`;
const PageNo = styled.span`
  position: absolute; right: 6px; top: 6px; font-size: 10px; line-height: 1; padding: 3px 7px;
  border-radius: 999px; background: rgba(0,0,0,0.55); color: rgba(255,255,255,0.8); pointer-events: none;
`;
const Box = styled.div<{ $c: string; $dashed?: boolean; $active?: boolean }>`
  position: absolute; box-sizing: border-box; cursor: grab; touch-action: none;
  border: 2px ${(p) => (p.$dashed ? "dashed" : "solid")} ${(p) => p.$c};
  background: ${(p) => p.$c}2e; border-radius: 3px;
  /* The row that was last touched in the field list lights up here, so the operator never
     has to work out which of nine rectangles they are naming. */
  box-shadow: ${(p) => (p.$active ? `0 0 0 3px ${p.$c}66, 0 0 14px ${p.$c}88` : "none")};
  &:active { cursor: grabbing; }
`;
const Star = styled.span`font-weight: 800; padding-left: 1px;`;
const Opt = styled.span`font-weight: 500; opacity: 0.75;`;
const BoxLabel = styled.span`
  position: absolute; left: 3px; top: 2px; right: 3px; font-size: 10px; line-height: 1.2;
  font-weight: 650; color: rgba(10,14,22,0.9); pointer-events: none; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis; text-shadow: 0 0 3px rgba(255,255,255,0.7);
`;
const BoxX = styled.button`
  /* Sits on the box's top-right corner, opposite the resize handle, so the two gestures
     can never be aimed at each other. */
  position: absolute; right: -7px; top: -7px; width: 15px; height: 15px; padding: 0;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  background: #0d0d12; border: 1.5px solid rgba(255,255,255,0.55); color: rgba(255,255,255,0.85);
  cursor: pointer; touch-action: none;
  &:hover { background: #d94a5a; border-color: #d94a5a; color: #fff; }
`;
const ResizeHandle = styled.span<{ $c: string }>`
  position: absolute; right: -6px; bottom: -6px; width: 12px; height: 12px; border-radius: 3px;
  background: ${(p) => p.$c}; border: 2px solid #0d0d12; cursor: nwse-resize; touch-action: none;
`;
