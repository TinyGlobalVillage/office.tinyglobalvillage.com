// StorageMeteringPanel — collapsible fleet metering strip on the Storage page.
// Lazy: nothing is fetched until first expand (the API walks the whole CDN tree).
// Data: /api/admin/storage-metering (admin-gated) — per-site media bytes (DB-tracked
// + on-disk) and DB footprint, plus unmatched legacy buckets and fleet totals.
"use client";

import { useState } from "react";
import styled from "styled-components";
import { glowRgba, t } from "../../theme";

type SiteEntry = {
  key: string;
  label: string;
  siteId: string | null;
  domain: string | null;
  quotaGb: number | null;
  mediaDbBytes: number;
  mediaDbFiles: number;
  diskBytes: number;
  diskFiles: number;
  dbBytes: number;
  dbRows: number;
  tables: Record<string, { n: number; b: number }>;
};

type Metering = {
  ok: boolean;
  generatedAt: string;
  cdnPresent: boolean;
  sites: SiteEntry[];
  buckets: { dir: string; bytes: number; files: number }[];
  totals: {
    databaseBytes: number;
    demoClones: { count: number; bytes: number } | null;
    cdnBytes: number;
    cdnFiles: number;
  };
};

function fmtBytes(b: number) {
  if (b <= 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const Shell = styled.section`
  margin: 0 0 1.25rem;
  border: 1px solid ${glowRgba("pink", 0.25)};
  border-radius: 14px;
  background: ${glowRgba("pink", 0.04)};
  overflow: hidden;
`;

const HeadBtn = styled.button`
  appearance: none;
  border: none;
  background: transparent;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
  color: ${t("text")};
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;

  &:hover {
    background: ${glowRgba("pink", 0.07)};
  }
`;

const HeadHint = styled.span`
  font-weight: 500;
  font-size: 0.75rem;
  color: ${t("textMuted")};
`;

const Body = styled.div`
  padding: 0 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;

  th {
    text-align: left;
    font-weight: 600;
    color: ${t("textMuted")};
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid ${t("borderStrong")};
    white-space: nowrap;
  }
  td {
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid ${t("border")};
    white-space: nowrap;
    color: ${t("text")};
  }
  td.num,
  th.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`;

const SiteLabel = styled.span`
  font-weight: 600;
  color: ${t("text")};
`;

const SubLabel = styled.span`
  color: ${t("textFaint")};
  font-size: 0.72rem;
  margin-left: 0.4rem;
`;

const TotalsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  font-size: 0.75rem;
  color: ${t("textMuted")};

  b {
    color: ${t("text")};
    font-variant-numeric: tabular-nums;
  }
`;

const SectionTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${t("textMuted")};
`;

const StatusLine = styled.div`
  padding: 0.75rem 0;
  font-size: 0.8rem;
  color: ${t("textMuted")};
`;

export default function StorageMeteringPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Metering | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) {
      setLoading(true);
      setError(null);
      fetch("/api/admin/storage-metering")
        .then(async (r) => {
          if (!r.ok) throw new Error(r.status === 403 || r.status === 401 ? "Admin only" : `HTTP ${r.status}`);
          return (await r.json()) as Metering;
        })
        .then(setData)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
        .finally(() => setLoading(false));
    }
  };

  const sites = (data?.sites ?? []).filter(
    (s) => s.mediaDbBytes + s.diskBytes + s.dbBytes > 0,
  );

  return (
    <Shell>
      <HeadBtn type="button" onClick={toggle} aria-expanded={open}>
        <span>{open ? "▾" : "▸"}&nbsp; Metering — usage by site</span>
        <HeadHint>media bytes + DB footprint, fleet-wide</HeadHint>
      </HeadBtn>
      {open && (
        <Body>
          {loading && <StatusLine>Measuring… (walks the whole CDN tree)</StatusLine>}
          {error && <StatusLine>⚠ {error}</StatusLine>}
          {data && (
            <>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th className="num">Media (disk)</th>
                      <th className="num">Media (DB-tracked)</th>
                      <th className="num">DB footprint</th>
                      <th className="num">DB rows</th>
                      <th className="num">Quota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((s) => (
                      <tr key={s.key}>
                        <td>
                          <SiteLabel>{s.label}</SiteLabel>
                          {s.domain && s.domain !== s.label && <SubLabel>{s.domain}</SubLabel>}
                        </td>
                        <td className="num" title={s.diskFiles ? `${s.diskFiles} files` : undefined}>
                          {fmtBytes(s.diskBytes)}
                        </td>
                        <td className="num" title={s.mediaDbFiles ? `${s.mediaDbFiles} files` : undefined}>
                          {fmtBytes(s.mediaDbBytes)}
                        </td>
                        <td
                          className="num"
                          title={Object.entries(s.tables)
                            .map(([t, v]) => `${t}: ${v.n} rows, ${fmtBytes(v.b)}`)
                            .join("\n")}
                        >
                          {fmtBytes(s.dbBytes)}
                        </td>
                        <td className="num">{s.dbRows || "—"}</td>
                        <td className="num">{s.quotaGb ? `${s.quotaGb} GB` : "—"}</td>
                      </tr>
                    ))}
                    {sites.length === 0 && (
                      <tr>
                        <td colSpan={6}>No per-site usage recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </TableWrap>

              {data.buckets.length > 0 && (
                <>
                  <SectionTitle>Other CDN buckets (no site match)</SectionTitle>
                  <TableWrap>
                    <Table>
                      <tbody>
                        {data.buckets.map((b) => (
                          <tr key={b.dir}>
                            <td>{b.dir}</td>
                            <td className="num">{fmtBytes(b.bytes)}</td>
                            <td className="num">{b.files} files</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                </>
              )}

              <TotalsRow>
                <span>
                  CDN total <b>{fmtBytes(data.totals.cdnBytes)}</b> · {data.totals.cdnFiles} files
                  {!data.cdnPresent && " (CDN root not present on this host)"}
                </span>
                <span>
                  tgv_db <b>{fmtBytes(data.totals.databaseBytes)}</b>
                </span>
                <span>
                  demo clones{" "}
                  {data.totals.demoClones ? (
                    <b>
                      {data.totals.demoClones.count} · {fmtBytes(data.totals.demoClones.bytes)}
                    </b>
                  ) : (
                    <b>n/a</b>
                  )}
                </span>
              </TotalsRow>
            </>
          )}
        </Body>
      )}
    </Shell>
  );
}
