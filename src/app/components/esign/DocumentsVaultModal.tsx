"use client";

// DocumentsVaultModal — read/manage gallery (GPG) of every uploaded Office e-sign document.
// Utils → Documents tile, sibling to the E-Sign console. Shows uploaded docs (legal_documents,
// origin='office') with signed status layered on; open the signed PDF, copy the signing link, or
// delete (soft-delete: hides the doc, keeps signed consent records).
// Vocabulary: GPG — responsive grid, pageSize = column count, pager only when total > pageSize.
// styled-components, SVG icons only (no emoji/glyphs).

import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import ConfirmModal from "../frontdesk/ConfirmModal";

type DocKind = "waiver" | "multisig";
type VaultSigner = {
  email: string;
  name: string | null;
  status: "pending" | "sent" | "signed" | "rejected";
  signedAt: string | null;
};
type VaultDoc = {
  id: string;
  title: string;
  kind: DocKind;
  createdAt: string;
  sendable: boolean;
  shareUrl: string | null;
  signed: boolean;
  signatureId: string | null;
  signedAt: string | null;
  signerName: string | null;
  signerEmail: string | null;
  signers?: VaultSigner[];
  signedCount?: number;
  signerCount?: number;
  hasSignedPdf: boolean;
  sizeKb: number | null;
};

type KindFilter = "all" | "waiver" | "multisig";
const KIND_SEGMENTS = [
  { key: "all", label: "All" },
  { key: "waiver", label: "Waivers" },
  { key: "multisig", label: "Multiple Signatures" },
];

const CARD_MIN = 190;
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
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export default function DocumentsVaultModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [page, setPage] = useState(0);
  const [cols, setCols] = useState(3);
  const [note, setNote] = useState("");
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

  useEscapeToClose({ open: true, onClose });

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

  const [confirmDoc, setConfirmDoc] = useState<VaultDoc | null>(null);
  const performRemove = async (d: VaultDoc) => {
    try {
      const r = await fetch(`/api/esign/documents?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      const j = await r.json();
      if (r.ok && j?.ok) { setNote(`Deleted "${d.title}".`); load(); }
      else setNote(j?.error ?? "Delete failed");
    } catch { setNote("Delete failed (server error)"); }
  };

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setNote("Signing link copied to clipboard."); }
    catch { setNote(url); }
  };

  const filtered = useMemo(() => {
    const byKind = kindFilter === "all" ? docs : docs.filter((d) => d.kind === kindFilter);
    const needle = q.trim().toLowerCase();
    if (!needle) return byKind;
    return byKind.filter((d) =>
      [d.title, d.signerName, d.signerEmail, ...(d.signers ?? []).flatMap((s) => [s.name, s.email])]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [docs, q, kindFilter]);

  const pageSize = cols;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(0); }, [q, kindFilter]);
  useEffect(() => { setPage((p) => Math.min(p, pageCount - 1)); }, [pageCount]);
  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);
  const showPager = filtered.length > pageSize;

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

  return (
    <>
    <Backdrop onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <div>
            <Title>Documents</Title>
            <Sub>Every e-sign document you&apos;ve uploaded — signed status, signing link, and delete.</Sub>
          </div>
          <CloseBtn type="button" onClick={onClose} aria-label="Close"><XIcon /></CloseBtn>
        </Header>

        <SearchRow>
          <SearchInput placeholder="Search by document, signer, or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Count>{filtered.length} {filtered.length === 1 ? "document" : "documents"}</Count>
        </SearchRow>

        <FilterRow>
          <PillBar variant="flat"
            segments={KIND_SEGMENTS}
            active={kindFilter}
            onChange={(k) => setKindFilter(k as KindFilter)}
            accent="58, 160, 255"
            ariaLabel="Filter documents by kind"
          />
        </FilterRow>

        {note && <Note onClick={() => setNote("")}>{note}</Note>}

        <Body>
          {loading && <Dim>Loading…</Dim>}
          {!loading && docs.length === 0 && <Dim>No documents yet. Upload one from the E-Sign tile.</Dim>}
          {!loading && docs.length > 0 && filtered.length === 0 && <Dim>No matches for “{q}”.</Dim>}

          <Grid ref={gridRef} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {paged.map((d) => (
              <Card key={d.id}>
                <TopRow>
                  <CardIcon><DocIcon /></CardIcon>
                  <DeleteBtn type="button" onClick={() => setConfirmDoc(d)} aria-label="Delete document" title="Delete document"><XIcon size={14} /></DeleteBtn>
                </TopRow>
                <CardTitle title={d.title}>{d.title}</CardTitle>
                {d.kind === "multisig" ? (
                  <StatusPill
                    $s={d.signed ? "signed" : "draft"}
                    title={(d.signers ?? [])
                      .map((s) => `${s.name || s.email}: ${s.status === "sent" ? "pending" : s.status}`)
                      .join("\n")}
                  >
                    {d.signed ? "Signed" : `${d.signedCount ?? 0} of ${d.signerCount ?? 0} signed`}
                  </StatusPill>
                ) : (
                  <StatusPill $s={d.signed ? "signed" : d.sendable ? "ready" : "draft"}>
                    {d.signed ? "Signed" : d.sendable ? "Ready to send" : "No template"}
                  </StatusPill>
                )}
                <CardMeta>
                  {d.kind === "multisig"
                    ? `${d.signerCount ?? 0} signer${(d.signerCount ?? 0) === 1 ? "" : "s"} · Added ${fmtDate(d.createdAt)}`
                    : <>
                        {d.signed ? (d.signerName || d.signerEmail || "Signed") : `Added ${fmtDate(d.createdAt)}`}
                        {d.signed && d.signedAt ? ` · ${fmtDate(d.signedAt)}` : ""}
                      </>}
                  {d.kind !== "multisig" && d.sizeKb != null ? ` · ${d.sizeKb} KB` : ""}
                </CardMeta>
                <CardActions>
                  {d.hasSignedPdf && d.signatureId && (
                    <ActBtn as="a" href={`/api/esign/pdf/${d.signatureId}`} target="_blank" rel="noreferrer">View PDF</ActBtn>
                  )}
                  {d.shareUrl && <ActBtn type="button" onClick={() => copy(d.shareUrl!)}>Copy link</ActBtn>}
                </CardActions>
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
    <ConfirmModal
      open={!!confirmDoc}
      title="Delete document"
      message={confirmDoc ? `Delete “${confirmDoc.title}”?` : ""}
      detail="It will be removed from the library, Send picker, and this gallery. Any signed consent records are kept for audit."
      confirmLabel="Delete"
      intent="danger"
      onConfirm={async () => { const d = confirmDoc; setConfirmDoc(null); if (d) await performRemove(d); }}
      onCancel={() => setConfirmDoc(null)}
    />
    </>
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
const FilterRow = styled.div`padding: 12px 22px 0;`;
const SearchInput = styled.input`
  flex: 1 1 auto; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #e8e8ef; padding: 9px 12px; font-size: 13px; outline: none;
  &:focus { border-color: rgba(120,200,255,0.5); }
`;
const Count = styled.div`flex: 0 0 auto; font-size: 12px; color: rgba(232,232,239,0.5); font-variant-numeric: tabular-nums;`;
const Note = styled.div`margin: 12px 22px 0; padding: 9px 12px; border-radius: 8px; font-size: 12.5px; background: rgba(120,200,255,0.1); border: 1px solid rgba(120,200,255,0.28); color: #cfe9ff; cursor: pointer;`;
const Body = styled.div`padding: 16px 22px 22px; overflow-y: auto;`;
const Dim = styled.div`font-size: 12.5px; color: rgba(232,232,239,0.45); padding: 8px 0;`;
const Grid = styled.div`display: grid; gap: ${GAP}px;`;
const Card = styled.div`
  display: flex; flex-direction: column; gap: 5px; padding: 12px 13px 13px;
  border: 1px solid rgba(255,255,255,0.09); border-radius: 11px; background: rgba(255,255,255,0.02);
  transition: border-color 0.15s, background 0.15s;
  &:hover { border-color: rgba(120,200,255,0.35); background: rgba(120,200,255,0.04); }
`;
const TopRow = styled.div`display: flex; align-items: flex-start; justify-content: space-between;`;
const CardIcon = styled.div`color: #7fd0ff;`;
const DeleteBtn = styled.button`
  background: transparent; border: none; color: rgba(232,232,239,0.4); cursor: pointer;
  padding: 3px; border-radius: 6px; line-height: 0;
  &:hover { color: #ff9a9a; background: rgba(255,90,90,0.12); }
`;
const CardTitle = styled.div`font-size: 13px; font-weight: 650; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;`;
const CardMeta = styled.div`font-size: 11px; color: rgba(232,232,239,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const CardActions = styled.div`display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;`;
const ActBtn = styled.button`
  font-size: 11px; font-weight: 600; text-decoration: none; cursor: pointer;
  color: #cfe9ff; background: rgba(120,200,255,0.12); border: 1px solid rgba(120,200,255,0.28);
  padding: 5px 11px; border-radius: 7px;
  &:hover { background: rgba(120,200,255,0.2); border-color: rgba(120,200,255,0.5); }
`;
const StatusPill = styled.span<{ $s: string }>`
  align-self: flex-start; font-size: 10.5px; font-weight: 650; padding: 2px 9px; border-radius: 999px;
  ${(p) =>
    p.$s === "signed"
      ? "background: rgba(80,220,140,0.14); color: #7ff0b0; border: 1px solid rgba(80,220,140,0.35);"
      : p.$s === "ready"
      ? "background: rgba(120,200,255,0.12); color: #bfe4ff; border: 1px solid rgba(120,200,255,0.3);"
      : "background: rgba(255,200,80,0.12); color: #ffd587; border: 1px solid rgba(255,200,80,0.3);"}
`;
const Pager = styled.div`display: flex; align-items: center; justify-content: center; gap: 14px; padding: 18px 0 4px;`;
const PagerBtn = styled.button`
  width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);
  color: rgba(232,232,239,0.7); cursor: pointer;
  &:hover:not(:disabled) { border-color: rgba(120,200,255,0.5); color: #cfe9ff; }
  &:disabled { opacity: 0.3; cursor: default; }
`;
const PagerInfo = styled.div`font-size: 12px; font-variant-numeric: tabular-nums; color: rgba(232,232,239,0.6);`;
