"use client";

// SignaturePlacer — drag each signer's SIGNATURE + DATE boxes onto a rendered preview of
// the staged PDF, so the boxes land exactly on the document's printed signature lines.
//
// Rendering: pdfjs-dist, loaded lazily inside an effect (never at module scope — the
// package is Mac-build-bundled client code; RCS's server runtime must never import it).
// Coordinates: percent of the page (0–100), Documenso's own field convention, so what the
// operator places here is byte-for-byte what /document/field/create-many receives.
// Defaults: every signer seeds at the auto-stacked position (mirror of the module's
// stackedFieldPlacements) — an untouched placer reproduces the pre-picker behavior.
//
// Styled-components only (Office no-Tailwind rule). Self-contained; parent owns state.

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

export type PlacedRect = { pageX: number; pageY: number; width: number; height: number };
export type SignerPlacement = {
  pageNumber: number;
  signature: PlacedRect;
  datePageNumber: number;
  date: PlacedRect;
};

type Signer = { email: string; name: string | null };

// One color per signer index — box borders, fills, and legend chips all key off this.
const COLORS = ["#3aa0ff", "#ff4ecb", "#ffc24e", "#6ee7a0", "#b39bff", "#ff8a5c", "#5ce1e6", "#f2f261", "#ff9ab8", "#9adcff"];
const MAX_PREVIEW_PAGES = 40;

// Minimal structural typing for the slice of pdfjs we use — keeps us off its shifting
// published types while the caret range floats within 5.x.
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }) => { promise: Promise<void> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> };

/** Client mirror of the module's stackedFieldPlacements (auto-stack default rows). */
function seedDefault(index: number, count: number, lastPage: number): SignerPlacement {
  const BASE_Y = 80;
  const MIN_Y = 6;
  const rowH = Math.min(9, count > 1 ? (BASE_Y - MIN_Y) / (count - 1) : 9);
  const y = Math.max(MIN_Y, BASE_Y - (count - 1 - index) * rowH);
  return {
    pageNumber: lastPage,
    signature: { pageX: 12, pageY: y, width: 45, height: 8 },
    datePageNumber: lastPage,
    date: { pageX: 62, pageY: y + 1, width: 24, height: 6 },
  };
}

type DragState = {
  email: string;
  kind: "signature" | "date" | "resize";
  /** Pointer's grab offset inside the box, in percent of the page. */
  offX: number;
  offY: number;
};

export default function SignaturePlacer({
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

  const onBoxPointerDown = (e: React.PointerEvent, email: string, kind: DragState["kind"]) => {
    e.preventDefault();
    e.stopPropagation();
    const p = placements[email];
    if (!p) return;
    const rect = kind === "date" ? p.date : p.signature;
    const page = kind === "date" ? p.datePageNumber : p.pageNumber;
    const wrap = wrapRefs.current.get(page);
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const ptrX = ((e.clientX - wr.left) / wr.width) * 100;
    const ptrY = ((e.clientY - wr.top) / wr.height) * 100;
    dragRef.current = {
      email,
      kind,
      offX: kind === "resize" ? 0 : ptrX - rect.pageX,
      offY: kind === "resize" ? 0 : ptrY - rect.pageY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = placements[drag.email];
    if (!p) return;
    const target = pageAt(e.clientY);
    if (!target) return;
    const ptrX = Math.min(100, Math.max(0, ((e.clientX - target.rect.left) / target.rect.width) * 100));
    const ptrY = Math.min(100, Math.max(0, ((e.clientY - target.rect.top) / target.rect.height) * 100));

    const next = { ...placements };
    if (drag.kind === "resize") {
      // bottom-right handle: the box grows toward the pointer; page never changes here
      const sig = p.signature;
      const width = Math.min(95, Math.max(8, ptrX - sig.pageX));
      const height = Math.min(40, Math.max(3, ptrY - sig.pageY));
      next[drag.email] = { ...p, signature: { ...sig, width, height } };
    } else if (drag.kind === "signature") {
      const sig = p.signature;
      const pageX = Math.min(100 - sig.width, Math.max(0, ptrX - drag.offX));
      const pageY = Math.min(100 - sig.height, Math.max(0, ptrY - drag.offY));
      next[drag.email] = { ...p, pageNumber: target.n, signature: { ...sig, pageX, pageY } };
    } else {
      const d = p.date;
      const pageX = Math.min(100 - d.width, Math.max(0, ptrX - drag.offX));
      const pageY = Math.min(100 - d.height, Math.max(0, ptrY - drag.offY));
      next[drag.email] = { ...p, datePageNumber: target.n, date: { ...d, pageX, pageY } };
    }
    onChange(next);
  };

  const onPointerUp = () => { dragRef.current = null; };

  const resetAll = () => {
    if (status !== "ready" || !numPages) return;
    const lastPage = Math.min(numPages, MAX_PREVIEW_PAGES);
    const next: Record<string, SignerPlacement> = {};
    signers.forEach((s, i) => { next[s.email] = seedDefault(i, signers.length, lastPage); });
    onChange(next);
  };

  const shownPages = Math.min(numPages, MAX_PREVIEW_PAGES);

  if (status === "error") {
    return <Note>Preview failed for this PDF — signature boxes will auto-stack on the last page instead.</Note>;
  }

  return (
    <Wrap ref={containerRef}>
      <Legend>
        {signers.map((s, i) => (
          <LegendChip key={s.email} $c={COLORS[i % COLORS.length]}>
            <Dot $c={COLORS[i % COLORS.length]} />
            {i + 1}. {s.name || s.email}
          </LegendChip>
        ))}
        <ResetBtn type="button" onClick={resetAll}>Reset boxes</ResetBtn>
      </Legend>
      <Note>
        Drag each signer&apos;s <strong>Sign</strong> and <strong>Date</strong> boxes exactly where they belong —
        recipients see their boxes right there. Drag a Sign box&apos;s corner to resize it.
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
                const p = placements[s.email];
                if (!p) return null;
                const c = COLORS[i % COLORS.length];
                return (
                  <span key={s.email}>
                    {p.pageNumber === n && (
                      <Box
                        $c={c}
                        style={{
                          left: `${p.signature.pageX}%`,
                          top: `${p.signature.pageY}%`,
                          width: `${p.signature.width}%`,
                          height: `${p.signature.height}%`,
                        }}
                        onPointerDown={(e) => onBoxPointerDown(e, s.email, "signature")}
                      >
                        <BoxLabel>{i + 1} · {s.name || s.email} — sign</BoxLabel>
                        <ResizeHandle $c={c} onPointerDown={(e) => onBoxPointerDown(e, s.email, "resize")} />
                      </Box>
                    )}
                    {p.datePageNumber === n && (
                      <Box
                        $c={c}
                        $dashed
                        style={{
                          left: `${p.date.pageX}%`,
                          top: `${p.date.pageY}%`,
                          width: `${p.date.width}%`,
                          height: `${p.date.height}%`,
                        }}
                        onPointerDown={(e) => onBoxPointerDown(e, s.email, "date")}
                      >
                        <BoxLabel>{i + 1} · date</BoxLabel>
                      </Box>
                    )}
                  </span>
                );
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
const Legend = styled.div`display: flex; flex-wrap: wrap; align-items: center; gap: 6px;`;
const LegendChip = styled.span<{ $c: string }>`
  display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; padding: 3px 9px;
  border-radius: 999px; border: 1px solid ${(p) => p.$c}55; background: ${(p) => p.$c}14; color: #e8e8ef;
`;
const Dot = styled.span<{ $c: string }>`
  width: 8px; height: 8px; border-radius: 50%; background: ${(p) => p.$c}; flex: 0 0 auto;
`;
const ResetBtn = styled.button`
  margin-left: auto; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #e8e8ef; padding: 4px 10px; font-size: 11.5px; cursor: pointer;
  &:hover { border-color: rgba(120,200,255,0.5); }
`;
const Note = styled.p`margin: 0; font-size: 11.5px; line-height: 1.45; color: rgba(232,232,239,0.5);`;
const Pages = styled.div`
  display: flex; flex-direction: column; gap: 10px; max-height: 56vh; overflow-y: auto;
  padding: 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
  background: rgba(255,255,255,0.03);
`;
const PageWrap = styled.div`
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
const ResizeHandle = styled.span<{ $c: string }>`
  position: absolute; right: -6px; bottom: -6px; width: 12px; height: 12px; border-radius: 3px;
  background: ${(p) => p.$c}; border: 2px solid #0d0d12; cursor: nwse-resize; touch-action: none;
`;
