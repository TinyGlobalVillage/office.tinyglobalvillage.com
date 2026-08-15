"use client";

// FieldPlacer — build each signer's set of fields on a rendered preview of the staged PDF:
// tick the marks this document asks that person for (sign · initials · full name · date),
// then drag each box onto the printed line it belongs on.
//
// Four kinds, because those are the marks that make a contract signed. A multi-page
// agreement wants initials in the corner of every page and the signature only on the last,
// so a signer's placement is a LIST of boxes — any number, any kind, any page — not the one
// signature+date pair the first cut allowed.
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
export type FieldKind = "signature" | "initials" | "name" | "date";
export type PlacedField = { id: string; kind: FieldKind; pageNumber: number; rect: PlacedRect };
/** Everything ONE signer is asked to fill in. Empty is never sent — see the parent. */
export type SignerPlacement = { fields: PlacedField[] };

type Signer = { email: string; name: string | null };

// One color per signer index — box borders, fills, and legend chips all key off this.
const COLORS = ["#3aa0ff", "#ff4ecb", "#ffc24e", "#6ee7a0", "#b39bff", "#ff8a5c", "#5ce1e6", "#f2f261", "#ff9ab8", "#9adcff"];
const MAX_PREVIEW_PAGES = 40;

const KINDS: readonly FieldKind[] = ["signature", "initials", "name", "date"];
/** Pill text — short, because four of them sit on one chip row per signer. */
const KIND_PILL: Record<FieldKind, string> = {
  signature: "Sign",
  initials: "Initials",
  name: "Name",
  date: "Date",
};
/** What the box itself says, and what the tooltips call the field. */
const KIND_NOUN: Record<FieldKind, string> = {
  signature: "sign",
  initials: "initials",
  name: "full name",
  date: "date",
};

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
  }
}

/** Client mirror of the module's stackedFieldPlacements (signature + date, last page). */
function seedDefault(index: number, count: number, lastPage: number): SignerPlacement {
  const y = rowY(index, count);
  return {
    fields: [
      mkField("signature", lastPage, defaultRect("signature", y)),
      mkField("date", lastPage, defaultRect("date", y)),
    ],
  };
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
  const initialEveryPage = (email: string) => {
    const cur = placements[email]?.fields ?? [];
    const taken = new Set(cur.filter((f) => f.kind === "initials").map((f) => f.pageNumber));
    const added: PlacedField[] = [];
    for (let n = 1; n <= shownPages; n++) {
      if (taken.has(n)) continue;
      added.push(mkField("initials", n, { pageX: 86, pageY: 90, width: 10, height: 5 }));
    }
    if (added.length) setFields(email, [...cur, ...added]);
  };

  const removeField = (email: string, id: string) => {
    const cur = placements[email]?.fields ?? [];
    if (cur.length <= 1) return;
    setFields(email, cur.filter((f) => f.id !== id));
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

  const resetAll = () => {
    if (status !== "ready" || !numPages) return;
    const next: Record<string, SignerPlacement> = {};
    signers.forEach((s, i) => { next[s.email] = seedDefault(i, signers.length, lastPage); });
    onChange(next);
  };

  if (status === "error") {
    return <Note>Preview failed for this PDF — signature boxes will auto-stack on the last page instead.</Note>;
  }

  return (
    <Wrap ref={containerRef}>
      <Roster>
        {signers.map((s, i) => {
          const c = COLORS[i % COLORS.length];
          const fields = placements[s.email]?.fields ?? [];
          const only = fields.length <= 1;
          return (
            <SignerRow key={s.email} $c={c}>
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
                  onClick={() => initialEveryPage(s.email)}
                >
                  initial every page
                </GhostBtn>
              )}
            </SignerRow>
          );
        })}
      </Roster>
      <Note>
        Tick what this document asks each person for, then drag their boxes onto the printed lines —
        recipients only ever see their own. Drag a corner to resize, X a box to drop it, and use
        <strong> initial every page</strong> for a contract that wants initials throughout.
        <ResetBtn type="button" onClick={resetAll}>Reset boxes</ResetBtn>
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
                      style={{
                        left: `${f.rect.pageX}%`,
                        top: `${f.rect.pageY}%`,
                        width: `${f.rect.width}%`,
                        height: `${f.rect.height}%`,
                      }}
                      onPointerDown={(e) => onBoxPointerDown(e, s.email, f, "move")}
                    >
                      <BoxLabel>
                        {i + 1} · {f.kind === "signature" ? `${s.name || s.email} — sign` : KIND_NOUN[f.kind]}
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
const SignerRow = styled.div<{ $c: string }>`
  display: flex; flex-wrap: wrap; align-items: center; gap: 5px;
  padding: 5px 8px; border-radius: 10px;
  border: 1px solid ${(p) => p.$c}44; background: ${(p) => p.$c}10;
`;
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
const ResetBtn = styled.button`
  margin-left: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #e8e8ef; padding: 2px 9px; font-size: 11px; cursor: pointer;
  &:hover { border-color: rgba(120,200,255,0.5); }
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
const Box = styled.div<{ $c: string; $dashed?: boolean }>`
  position: absolute; box-sizing: border-box; cursor: grab; touch-action: none;
  border: 2px ${(p) => (p.$dashed ? "dashed" : "solid")} ${(p) => p.$c};
  background: ${(p) => p.$c}2e; border-radius: 3px;
  &:active { cursor: grabbing; }
`;
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
