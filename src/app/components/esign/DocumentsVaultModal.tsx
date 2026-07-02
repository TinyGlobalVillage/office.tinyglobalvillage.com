"use client";

// DocumentsVaultModal — read-only, searchable gallery (GPG) of every signed document stored on
// disk (data/legal/signed/…). Utils → Documents tile, sibling to the E-Sign console.
// Vocabulary: GPG (Gallery Pagination Group) — responsive grid, pageSize = current column count,
// pager only when total > pageSize. Cards link to the signed PDF via /api/esign/pdf/[sigId].
// styled-components, SVG icons only (no emoji/glyphs).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

type VaultDoc = {
  signatureId: string;
  title: string;
  signerName: string | null;
  signerEmail: string | null;
  signedAt: string | null;
  sizeKb: number | null;
  onDisk: boolean;
};

const CARD_MIN = 190; // px — target min card width; drives column count
const GAP = 12;

const XIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
  </svg>
);
const DocIcon = () => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export default function DocumentsVaultModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [cols, setCols] = useState(3);
  const gridRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/esign/vault");
      const d = await r.json();
      if (d?.ok) setDocs(d.documents ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Column count from the measured grid width (GPG: pageSize = columns).
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setCols(Math.max(1, Math.min(5, Math.floor((w + GAP) / (CARD_MIN + GAP)))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter((d) =>
      [d.title, d.signerName, d.signerEmail].filter(Boolean).some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [docs, q]);

  const pageSize = cols;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(0); }, [q]);
  useEffect(() => { setPage((p) => Math.min(p, pageCount - 1)); }, [pageCount]);
  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const showPager = filtered.length > pageSize;

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <Title>Documents</Title>
            <Sub>Signed documents stored on this server.</Sub>
          </div>
          <CloseBtn type="button" onClick={onClose} aria-label="Close"><XIcon /></CloseBtn>
        </Header>

        <SearchRow>
          <SearchInput
            placeholder="Search by document, signer, or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Count>{filtered.length} {filtered.length === 1 ? "document" : "documents"}</Count>
        </SearchRow>

        <Body>
          {loading && <Dim>Loading…</Dim>}
          {!loading && docs.length === 0 && <Dim>No signed documents on disk yet.</Dim>}
          {!loading && docs.length > 0 && filtered.length === 0 && <Dim>No matches for “{q}”.</Dim>}

          <Grid ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {paged.map((d) => (
              <Card key={d.signatureId}>
                <CardIcon><DocIcon /></CardIcon>
                <CardTitle title={d.title}>{d.title}</CardTitle>
                <CardMeta>{d.signerName || d.signerEmail || "Unknown signer"}</CardMeta>
                <CardMeta>{fmtDate(d.signedAt)}{d.sizeKb != null ? ` · ${d.sizeKb} KB` : ""}</CardMeta>
                {d.onDisk ? (
                  <ViewLink href={`/api/esign/pdf/${d.signatureId}`} target="_blank" rel="noreferrer">View PDF</ViewLink>
                ) : (
                  <Missing>File missing on disk</Missing>
                )}
              </Card>
            ))}
          </Grid>

          {showPager && (
            <Pager>
              <PagerBtn type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} aria-label="Previous"><Chevron dir="left" /></PagerBtn>
              <PagerInfo>{page + 1} / {pageCount}</PagerInfo>
              <PagerBtn type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} aria-label="Next"><Chevron dir="right" /></PagerBtn>
            </Pager>
          )}
        </Body>
      </Panel>
    </Backdrop>
  );
}

// ── styled ──────────────────────────────────────────────────────────────────────
const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.66); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
`;
const Panel = styled.div`
  width: min(1000px, 100%); max-height: 90vh; display: flex; flex-direction: column;
  background: #0d0d12; border: 1px solid rgba(120,200,255,0.18); border-radius: 14px;
  box-shadow: 0 24px 80px rgba(0,0,0,0.6); color: #e8e8ef; overflow: hidden;
`;
const Header = styled.div`
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 20px 22px; border-bottom: 1px solid rgba(255,255,255,0.07);
`;
const Title = styled.h2`margin: 0; font-size: 18px; font-weight: 650;`;
const Sub = styled.p`margin: 4px 0 0; font-size: 12.5px; color: rgba(232,232,239,0.55);`;
const CloseBtn = styled.button`
  flex: 0 0 auto; background: transparent; border: none; color: rgba(232,232,239,0.6);
  cursor: pointer; padding: 4px; border-radius: 6px;
  &:hover { color: #fff; background: rgba(255,255,255,0.06); }
`;
const SearchRow = styled.div`display: flex; align-items: center; gap: 12px; padding: 14px 22px 0;`;
const SearchInput = styled.input`
  flex: 1 1 auto; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #e8e8ef; padding: 9px 12px; font-size: 13px; outline: none;
  &:focus { border-color: rgba(120,200,255,0.5); }
`;
const Count = styled.div`flex: 0 0 auto; font-size: 12px; color: rgba(232,232,239,0.5); font-variant-numeric: tabular-nums;`;
const Body = styled.div`padding: 16px 22px 22px; overflow-y: auto;`;
const Dim = styled.div`font-size: 12.5px; color: rgba(232,232,239,0.45); padding: 8px 0;`;
const Grid = styled.div`display: grid; gap: ${GAP}px;`;
const Card = styled.div`
  display: flex; flex-direction: column; gap: 5px; padding: 14px 13px;
  border: 1px solid rgba(255,255,255,0.09); border-radius: 11px; background: rgba(255,255,255,0.02);
  transition: border-color 0.15s, background 0.15s;
  &:hover { border-color: rgba(120,200,255,0.35); background: rgba(120,200,255,0.04); }
`;
const CardIcon = styled.div`color: #7fd0ff; margin-bottom: 2px;`;
const CardTitle = styled.div`font-size: 13px; font-weight: 650; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;`;
const CardMeta = styled.div`font-size: 11px; color: rgba(232,232,239,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const ViewLink = styled.a`
  margin-top: 6px; align-self: flex-start; font-size: 11.5px; font-weight: 600; text-decoration: none;
  color: #001a2e; background: #3aa0ff; padding: 5px 12px; border-radius: 7px;
  &:hover { background: #58b0ff; }
`;
const Missing = styled.div`margin-top: 6px; font-size: 11px; color: #ff9a9a;`;
const Pager = styled.div`display: flex; align-items: center; justify-content: center; gap: 14px; padding: 18px 0 4px;`;
const PagerBtn = styled.button`
  width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);
  color: rgba(232,232,239,0.7); cursor: pointer;
  &:hover:not(:disabled) { border-color: rgba(120,200,255,0.5); color: #cfe9ff; }
  &:disabled { opacity: 0.3; cursor: default; }
`;
const PagerInfo = styled.div`font-size: 12px; font-variant-numeric: tabular-nums; color: rgba(232,232,239,0.6);`;
