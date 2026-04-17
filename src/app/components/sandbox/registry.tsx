"use client";

import { useState, useEffect } from "react";

const PINK = "#ff4ecb";
const PINK_RGB = "255,78,203";
const MUTED = "rgba(255,255,255,0.18)";
const MUTED_TEXT = "rgba(255,255,255,0.35)";

export type SandboxEntry = {
  key: string;
  name: string;
  category: "Navigation" | "Toggles" | "Menus" | "Editor Controls";
  summary: string;
  usage: string;
  code: string;
  Demo: React.FC;
};

// ── Reusable highlighter ────────────────────────────────────────────────
function Highlight({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        padding: 8,
        borderRadius: 12,
        border: `1px dashed rgba(${PINK_RGB},0.55)`,
        boxShadow: `0 0 22px rgba(${PINK_RGB},0.28), inset 0 0 12px rgba(${PINK_RGB},0.08)`,
        background: `rgba(${PINK_RGB},0.04)`,
      }}
    >
      {label && (
        <span
          style={{
            position: "absolute",
            top: -9,
            left: 10,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            padding: "1px 6px",
            background: "rgba(6,8,12,1)",
            color: PINK,
            border: `1px solid rgba(${PINK_RGB},0.5)`,
            borderRadius: 4,
          }}
        >{label}</span>
      )}
      {children}
    </div>
  );
}

// ── GPG demo ────────────────────────────────────────────────────────────
function useGPGColumns() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setCols(1);
      else if (w < 900) setCols(2);
      else if (w < 1200) setCols(3);
      else setCols(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

function GPGDemo() {
  const total = 12;
  const cols = useGPGColumns();
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [cols]);

  const pageSize = cols;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const items = Array.from({ length: pageSize }, (_, i) => start + i).filter((n) => n < total);
  const showPager = total > pageSize;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Subdued grid viewport — column count scales with viewport */}
      <Highlight label={`GPG · ${cols}-col`}>
        <div
          className="w-full"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 8,
            minWidth: 240,
          }}
        >
          {items.map((i) => (
            <div
              key={i}
              className="rounded-lg flex items-center justify-center aspect-square"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${MUTED}` }}
            >
              <span className="text-[10px] font-mono" style={{ color: MUTED_TEXT }}>{i + 1}</span>
            </div>
          ))}
        </div>
      </Highlight>

      {/* Pager — only renders when total > pageSize */}
      {showPager ? (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            style={{
              width: 28, height: 28, borderRadius: 999,
              border: `1px solid rgba(${PINK_RGB},0.5)`,
              background: `rgba(${PINK_RGB},0.12)`,
              color: PINK, fontSize: 14, fontWeight: 700,
              cursor: safePage === 0 ? "not-allowed" : "pointer",
              opacity: safePage === 0 ? 0.4 : 1,
            }}
          >‹</button>
          <span style={{ color: PINK, fontSize: 12, fontWeight: 700 }}>{safePage + 1} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            style={{
              width: 28, height: 28, borderRadius: 999,
              border: `1px solid rgba(${PINK_RGB},0.5)`,
              background: `rgba(${PINK_RGB},0.12)`,
              color: PINK, fontSize: 14, fontWeight: 700,
              cursor: safePage === totalPages - 1 ? "not-allowed" : "pointer",
              opacity: safePage === totalPages - 1 ? 0.4 : 1,
            }}
          >›</button>
        </div>
      ) : (
        <span className="text-[10px]" style={{ color: MUTED_TEXT }}>
          (no pager — total ≤ pageSize)
        </span>
      )}
    </div>
  );
}

// ── TPG demo ────────────────────────────────────────────────────────────
function TPGDemo() {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const total = 3;
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Subdued table */}
      <div className="w-full rounded-xl overflow-hidden" style={{ border: `1px solid ${MUTED}` }}>
        {["Row A", "Row B", "Row C", "Row D"].map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: i < 3 ? `1px solid ${MUTED}` : "none", background: i % 2 ? "rgba(255,255,255,0.02)" : "transparent" }}>
            <span className="text-[11px] font-mono" style={{ color: MUTED_TEXT }}>{r}</span>
            <span className="flex-1" />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
          </div>
        ))}
      </div>

      <Highlight label="TPG">
        <div className="flex items-center gap-3 flex-wrap">
          <span style={{ color: PINK, fontSize: 11, fontWeight: 600 }}>Page {page} of {total} · 24 results</span>
          <span className="flex-1" />
          <button
            onClick={() => setSize(10)}
            style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.12)`, color: PINK, fontSize: 11 }}
            title="Reset"
          >↺</button>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid rgba(${PINK_RGB},0.5)`, background: "rgba(6,8,12,0.9)", color: PINK, fontSize: 11 }}
          >
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.12)`, color: PINK, fontSize: 12, opacity: page === 1 ? 0.4 : 1 }}
          >‹</button>
          <button
            onClick={() => setPage((p) => Math.min(total, p + 1))}
            disabled={page === total}
            style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.12)`, color: PINK, fontSize: 12, opacity: page === total ? 0.4 : 1 }}
          >›</button>
        </div>
      </Highlight>
    </div>
  );
}

// ── ACR demo ────────────────────────────────────────────────────────────
function ACRDemo() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setCols(1);
      else if (w < 900) setCols(2);
      else if (w < 1200) setCols(3);
      else setCols(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <Highlight label="ACR">
      <div className="flex flex-col gap-3 w-full">
        <div className="text-[10px] font-mono" style={{ color: PINK }}>
          viewport → <b>{cols === 1 ? "GPG (mobile)" : `TPG ${cols}-col`}</b>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, width: 320 }}>
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="aspect-square rounded" style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${MUTED}` }} />
          ))}
        </div>
        <div className="text-[10px]" style={{ color: MUTED_TEXT }}>Resize the window — cols switch at 600/900/1200.</div>
      </div>
    </Highlight>
  );
}

// ── Lightswitch demo ────────────────────────────────────────────────────
function LightswitchSwitch({ on, onChange, highlighted }: { on: boolean; onChange: (v: boolean) => void; highlighted?: boolean }) {
  const color = highlighted ? PINK : "rgba(255,255,255,0.4)";
  const rgb = highlighted ? PINK_RGB : "255,255,255";
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        position: "relative", width: 44, height: 18, borderRadius: 999,
        border: `1px solid ${on ? `rgba(${rgb},0.7)` : "rgba(255,255,255,0.15)"}`,
        background: on ? `rgba(${rgb},0.18)` : "rgba(255,255,255,0.04)",
        boxShadow: on && highlighted ? `0 0 12px rgba(${rgb},0.5)` : "none",
        transition: "all 0.2s",
      }}
    >
      <span
        style={{
          position: "absolute", top: 1, left: on ? 26 : 2,
          width: 14, height: 14, borderRadius: "50%",
          background: on ? color : "rgba(255,255,255,0.3)",
          boxShadow: on && highlighted ? `0 0 10px rgba(${rgb},0.8), 0 0 2px rgba(${rgb},1)` : "0 1px 2px rgba(0,0,0,0.3)",
          transition: "all 0.2s",
        }}
      />
    </button>
  );
}

function LightswitchDemo() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  const [c, setC] = useState(true);
  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      {[
        { label: "Notifications", state: a, set: setA, hl: false },
        { label: "Sound effects",  state: b, set: setB, hl: false },
      ].map((r, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
          <span className="text-[12px]" style={{ color: MUTED_TEXT }}>{r.label}</span>
          <LightswitchSwitch on={r.state} onChange={r.set} highlighted={false} />
        </div>
      ))}
      <Highlight label="Lightswitch">
        <div className="flex items-center justify-between px-4 py-2 rounded-lg w-full" style={{ minWidth: 280 }}>
          <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.85)" }}>Expand section</span>
          <LightswitchSwitch on={c} onChange={setC} highlighted />
        </div>
      </Highlight>
    </div>
  );
}

// ── ECL demo ────────────────────────────────────────────────────────────
function ECLDemo() {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="flex flex-col gap-2 w-full max-w-md">
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED_TEXT }}>Zoom</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: expanded ? "55%" : "0%", background: "rgba(0,191,255,0.4)" }} />
        </div>
        {expanded && (
          <>
            <button style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(0,228,253,0.25)", background: "rgba(0,228,253,0.08)", color: "rgba(0,228,253,0.8)", fontSize: 11 }}>↺</button>
            <input defaultValue="1.0" className="w-10 text-center rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 11, padding: "2px 4px" }} />
          </>
        )}
        <Highlight label="ECL">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: PINK }}>{expanded ? "Collapse" : "Expand"}</span>
            <LightswitchSwitch on={expanded} onChange={setExpanded} highlighted />
          </div>
        </Highlight>
      </div>
      <span className="text-[10px]" style={{ color: MUTED_TEXT }}>Toggling ECL hides only the controls (↺ + input), not the row or label.</span>
    </div>
  );
}

// ── Eye Icon demo ───────────────────────────────────────────────────────
function EyeBtn({ visible, onChange, highlighted }: { visible: boolean; onChange: (v: boolean) => void; highlighted?: boolean }) {
  const color = highlighted ? PINK : "rgba(0,228,253,0.6)";
  const rgb = highlighted ? PINK_RGB : "0,228,253";
  return (
    <button
      onClick={() => onChange(!visible)}
      style={{
        width: 22, height: 22, borderRadius: 4,
        border: `1px solid rgba(${rgb},${visible ? 0.5 : 0.2})`,
        background: `rgba(${rgb},${visible ? 0.15 : 0.04})`,
        color: visible ? color : "rgba(255,255,255,0.3)",
        boxShadow: visible && highlighted ? `0 0 10px rgba(${rgb},0.5)` : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12,
      }}
    >{visible ? "👁" : "⊘"}</button>
  );
}

function EyeIconDemo() {
  const [show1, setShow1] = useState(true);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(true);
  return (
    <div className="flex flex-col gap-2 w-full max-w-md">
      {[
        { label: "Header block", state: show1, set: setShow1, hl: false },
        { label: "Sidebar widget", state: show2, set: setShow2, hl: false },
      ].map((r, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
          <span className="text-[12px]" style={{ color: MUTED_TEXT }}>{r.label}</span>
          <EyeBtn visible={r.state} onChange={r.set} />
        </div>
      ))}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.85)" }}>Footer section</span>
        <Highlight label="EYE">
          <EyeBtn visible={show3} onChange={setShow3} highlighted />
        </Highlight>
      </div>
    </div>
  );
}

// ── QMBM demo ───────────────────────────────────────────────────────────
function QMBMBubble({ highlighted, onClick }: { highlighted?: boolean; onClick: () => void }) {
  const color = highlighted ? PINK : "rgba(247,183,0,0.6)";
  const rgb = highlighted ? PINK_RGB : "247,183,0";
  return (
    <button
      onClick={onClick}
      style={{
        width: 16, height: 16, borderRadius: "50%",
        border: `1px solid rgba(${rgb},0.6)`,
        background: `rgba(${rgb},0.15)`,
        color,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: highlighted ? `0 0 8px rgba(${rgb},0.5)` : "none",
      }}
    >?</button>
  );
}

function QMBMDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 w-full max-w-md" style={{ minHeight: 200 }}>
      <div className="flex items-center gap-2">
        <label className="text-[12px]" style={{ color: MUTED_TEXT }}>API Key</label>
        <QMBMBubble onClick={() => {}} />
      </div>
      <input className="w-full px-3 py-1.5 rounded text-xs" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${MUTED}`, color: MUTED_TEXT }} placeholder="sk-…" readOnly />
      <div className="flex items-center gap-2" style={{ position: "relative" }}>
        <label className="text-[12px]" style={{ color: "rgba(255,255,255,0.85)" }}>Webhook secret</label>
        <Highlight label="QMBM">
          <QMBMBubble highlighted onClick={() => setOpen((v) => !v)} />
        </Highlight>
        {open && (
          <div
            style={{
              position: "absolute", top: 26, left: 0, zIndex: 10,
              width: 260, padding: 12, borderRadius: 10,
              background: "rgba(6,8,12,0.98)",
              border: `1px solid rgba(${PINK_RGB},0.45)`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 16px rgba(${PINK_RGB},0.2)`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: PINK }}>Webhook secret</span>
              <button onClick={() => setOpen(false)} className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>✕</button>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
              Used to sign outbound webhook payloads. Rotate quarterly. Clients verify via HMAC-SHA256.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DDM demo ────────────────────────────────────────────────────────────
function DDMDemo() {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("Markdown");
  return (
    <div className="flex flex-col gap-3 w-full max-w-md" style={{ minHeight: 200 }}>
      <div className="flex items-center gap-2">
        <label className="text-[12px]" style={{ color: MUTED_TEXT }}>Theme</label>
        <button className="px-3 py-1 rounded-full text-[11px]" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${MUTED}`, color: MUTED_TEXT }}>Dark ▾</button>
      </div>
      <div style={{ position: "relative" }}>
        <Highlight label="DDM">
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-4 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-2"
            style={{ background: `rgba(${PINK_RGB},0.14)`, border: `1px solid rgba(${PINK_RGB},0.5)`, color: PINK }}
          >
            Save as: {val}
            <span style={{ fontSize: 8 }}>▼</span>
          </button>
        </Highlight>
        {open && (
          <div
            style={{
              position: "absolute", top: 52, left: 8, zIndex: 10, width: 180,
              padding: 4, borderRadius: 10,
              background: "rgba(6,8,12,0.98)",
              border: `1px solid rgba(${PINK_RGB},0.45)`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 16px rgba(${PINK_RGB},0.2)`,
            }}
          >
            {["Markdown", "JSON", "HTML", "Plain text"].map((opt) => (
              <button
                key={opt}
                onClick={() => { setVal(opt); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 rounded text-[11px]"
                style={{ color: val === opt ? PINK : "rgba(255,255,255,0.7)", background: val === opt ? `rgba(${PINK_RGB},0.1)` : "transparent" }}
              >{opt}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ACR (defined earlier) ──
// ── SRT demo ────────────────────────────────────────────────────────────
function SRTDemo() {
  const [v, setV] = useState(1);
  return (
    <div className="flex flex-col gap-2 w-full max-w-md">
      <Highlight label="SRT">
        <div className="flex items-center gap-3 px-3 py-2 w-full" style={{ minWidth: 360 }}>
          <span className="text-[11px] font-bold uppercase tracking-wider w-14" style={{ color: PINK }}>Zoom</span>
          <input
            type="range" min={0.5} max={2} step={0.05} value={v}
            onChange={(e) => setV(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: PINK }}
          />
          <button onClick={() => setV(1)} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.15)`, color: PINK, fontSize: 11 }}>↺</button>
          <input
            value={v.toFixed(2)}
            onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setV(n); }}
            className="w-12 text-center rounded text-xs px-1 py-0.5"
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid rgba(${PINK_RGB},0.35)`, color: PINK, fontVariantNumeric: "tabular-nums" }}
          />
          <LightswitchSwitch on={true} onChange={() => {}} highlighted={false} />
        </div>
      </Highlight>
      {/* Sibling rows subdued */}
      {["X-Axis", "Y-Axis"].map((lbl) => (
        <div key={lbl} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
          <span className="text-[11px] font-bold uppercase tracking-wider w-14" style={{ color: MUTED_TEXT }}>{lbl}</span>
          <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: "50%", background: "rgba(255,255,255,0.15)" }} />
          </div>
          <span className="text-[10px]" style={{ color: MUTED_TEXT }}>0.00</span>
        </div>
      ))}
    </div>
  );
}

// ── Reset Button demo ───────────────────────────────────────────────────
function ResetBtnDemo() {
  const [v, setV] = useState(1.35);
  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      {[
        { label: "X-Axis", hl: false },
        { label: "Y-Axis", hl: false },
      ].map((r) => (
        <div key={r.label} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
          <span className="text-[11px] w-14" style={{ color: MUTED_TEXT }}>{r.label}</span>
          <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: "50%", background: "rgba(255,255,255,0.15)" }} />
          </div>
          <button style={{ width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(0,228,253,0.2)", background: "rgba(0,228,253,0.05)", color: "rgba(0,228,253,0.4)", fontSize: 10 }}>↺</button>
        </div>
      ))}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
        <span className="text-[11px] w-14" style={{ color: "rgba(255,255,255,0.85)" }}>Zoom</span>
        <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${(v / 2) * 100}%`, background: "rgba(0,191,255,0.4)" }} />
        </div>
        <Highlight label="RESET">
          <button
            onClick={() => setV(1)}
            style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid rgba(${PINK_RGB},0.5)`, background: `rgba(${PINK_RGB},0.15)`, color: PINK, fontSize: 12, fontWeight: 700 }}
          >↺</button>
        </Highlight>
        <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>{v.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── TSG demo ────────────────────────────────────────────────────────────
function TSGDemo() {
  const [icons, setIcons] = useState(false);
  const [all, setAll] = useState(true);
  return (
    <div className="flex flex-col gap-3 w-full max-w-lg">
      <Highlight label="TSG">
        <div className="flex items-center gap-6 px-4 py-2 rounded-lg w-full" style={{ minWidth: 360, background: `rgba(${PINK_RGB},0.04)` }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: PINK }}>Labels</span>
            <LightswitchSwitch on={icons} onChange={setIcons} highlighted />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: icons ? PINK : MUTED_TEXT }}>Icons</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: PINK }}>{all ? "Collapse all" : "Expand all"}</span>
            <LightswitchSwitch on={all} onChange={setAll} highlighted />
          </div>
        </div>
      </Highlight>
      {/* Subdued dashboard sections below */}
      {["Sessions", "Members", "Payouts"].map((s) => (
        <div key={s} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${MUTED}` }}>
          <span className="text-[12px]" style={{ color: MUTED_TEXT }}>{s}</span>
          <LightswitchSwitch on={all} onChange={() => {}} highlighted={false} />
        </div>
      ))}
    </div>
  );
}

// ── SBDM demo ───────────────────────────────────────────────────────────
const SBDM_OPTIONS = [
  "Argentina", "Australia", "Brazil", "Canada", "Chile", "Denmark",
  "Egypt", "France", "Germany", "Greece", "India", "Italy",
  "Japan", "Kenya", "Mexico", "Norway", "Poland", "Portugal",
  "Spain", "Sweden", "Thailand", "Turkey",
];

function SBDMDemo() {
  const [outer, setOuter] = useState("");
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState("");
  const [asc, setAsc] = useState(true);

  const filtered = SBDM_OPTIONS
    .filter((o) => o.toLowerCase().includes((open ? inner : outer).toLowerCase()))
    .sort((a, b) => (asc ? a.localeCompare(b) : b.localeCompare(a)));

  return (
    <div className="flex flex-col gap-3 w-full max-w-md" style={{ minHeight: 360 }}>
      {/* Subdued sibling form rows */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider" style={{ color: MUTED_TEXT }}>Email</label>
        <input className="w-full px-3 py-1.5 rounded text-xs" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${MUTED}`, color: MUTED_TEXT }} placeholder="user@example.com" readOnly />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider" style={{ color: MUTED_TEXT }}>Tag</label>
        <input className="w-full px-3 py-1.5 rounded text-xs" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${MUTED}`, color: MUTED_TEXT }} placeholder="optional" readOnly />
      </div>

      {/* Highlighted SBDM */}
      <div className="flex flex-col gap-1" style={{ position: "relative" }}>
        <label className="text-[10px] uppercase tracking-wider" style={{ color: PINK }}>Country</label>
        <Highlight label="SBDM">
          <div className="flex items-center w-full" style={{ minWidth: 320, position: "relative" }}>
            <span style={{ position: "absolute", left: 10, color: `rgba(${PINK_RGB},0.7)`, fontSize: 12, pointerEvents: "none" }}>🔍</span>
            <input
              value={outer}
              onChange={(e) => setOuter(e.target.value)}
              placeholder="Search countries…"
              className="flex-1 pl-8 pr-10 py-1.5 rounded-lg outline-none text-xs"
              style={{
                background: `rgba(${PINK_RGB},0.06)`,
                border: `1px solid rgba(${PINK_RGB},0.5)`,
                color: PINK,
              }}
            />
            <button
              onClick={() => setOpen((v) => !v)}
              style={{
                position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                width: 26, height: 26, borderRadius: 6,
                background: open ? `rgba(${PINK_RGB},0.25)` : `rgba(${PINK_RGB},0.12)`,
                border: `1px solid rgba(${PINK_RGB},0.5)`,
                color: PINK, fontSize: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title={open ? "Close" : "Browse all"}
            >▾</button>
          </div>
        </Highlight>

        {open && (
          <div
            style={{
              position: "absolute", top: 80, left: 0, right: 0, zIndex: 20,
              maxHeight: 240, padding: 6,
              background: "rgba(6,8,12,0.99)",
              border: `1px solid rgba(${PINK_RGB},0.45)`,
              borderRadius: 10,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 18px rgba(${PINK_RGB},0.2)`,
              display: "flex", flexDirection: "column", gap: 4,
            }}
          >
            <div className="flex items-center gap-2 px-1">
              <input
                value={inner}
                onChange={(e) => setInner(e.target.value)}
                placeholder="Search inside…"
                autoFocus
                className="flex-1 px-2 py-1 rounded text-[11px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${PINK_RGB},0.3)`, color: "rgba(255,255,255,0.85)" }}
              />
              <button
                onClick={() => setAsc((v) => !v)}
                className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `rgba(${PINK_RGB},0.14)`, border: `1px solid rgba(${PINK_RGB},0.5)`, color: PINK, whiteSpace: "nowrap" }}
                title="Toggle sort order"
              >
                {asc ? "Z-A" : "A-Z"} ↕
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 180, scrollbarWidth: "thin" }}>
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-[10px]" style={{ color: MUTED_TEXT }}>No matches.</div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o}
                    onClick={() => { setOuter(o); setOpen(false); setInner(""); }}
                    className="w-full text-left px-3 py-1 rounded text-[11px]"
                    style={{ color: outer === o ? PINK : "rgba(255,255,255,0.7)", background: outer === o ? `rgba(${PINK_RGB},0.1)` : "transparent" }}
                    onMouseEnter={(ev) => { if (outer !== o) (ev.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={(ev) => { if (outer !== o) (ev.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >{o}</button>
                ))
              )}
            </div>
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider" style={{ color: MUTED_TEXT, borderTop: `1px solid rgba(${PINK_RGB},0.15)` }}>
              {filtered.length} of {SBDM_OPTIONS.length} · sorted {asc ? "A → Z" : "Z → A"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── SuggestionBox demo ──────────────────────────────────────────────────
function SuggestionBoxDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 140,
          height: 100,
          borderRadius: 16,
          border: open ? "2px dashed " + PINK : "2px dashed " + MUTED,
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "border-color 0.2s",
        }}
      >
        <Highlight label="tile">
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              padding: "6px 16px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #ff4ecb, #a855f7)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(255,78,203,0.3)",
            }}
          >
            {open ? "Close" : "Make a suggestion"}
          </button>
        </Highlight>
      </div>
      {open && (
        <div
          style={{
            width: 220,
            padding: 16,
            borderRadius: 12,
            background: "rgba(255,78,203,0.04)",
            border: "1px solid rgba(255,78,203,0.2)",
          }}
        >
          <div style={{ fontSize: 10, color: PINK, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
            SuggestionBox Modal
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,78,203,0.15)", width: "80%" }} />
            <div style={{ height: 6, borderRadius: 3, background: "rgba(0,191,255,0.15)", width: "100%" }} />
            <div style={{ height: 6, borderRadius: 3, background: "rgba(0,191,255,0.1)", width: "60%" }} />
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: "linear-gradient(135deg, #ff4ecb, #a855f7)", color: "#fff", fontWeight: 700 }}>
              Send to admin
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Registry ────────────────────────────────────────────────────────────
export const REGISTRY: SandboxEntry[] = [
  {
    key: "GPG",
    name: "Gallery Pagination Group",
    category: "Navigation",
    summary: "Responsive paginated grid: columns scale 1 → 2 → 3 → 5 across the 600/900/1200px breakpoints, page size always equals column count. Pager (28px circle ‹ ›  + `N / M` counter) only renders when `total > pageSize` — small datasets show as a static grid with no pager.",
    usage: "Wrap any repeated-card collection. Use the canonical Tailwind grid `grid-cols-1 min-[600px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-5`. Track current column count via `matchMedia` for slicing. Reset page to 0 when filter or column count changes.",
    code: `// Hook (mirrors refusionist AnnouncementsWidget)
function useGPGColumns() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setCols(1);
      else if (w < 900) setCols(2);
      else if (w < 1200) setCols(3);
      else setCols(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

// Render
const cols = useGPGColumns();
const pageSize = cols;
const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
const showPager = items.length > pageSize;
const visible = items.slice(page * pageSize, (page + 1) * pageSize);

<>
  <div className="grid grid-cols-1 min-[600px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-5 gap-3">
    {visible.map(renderCard)}
  </div>
  {showPager && (
    <PagerRow>
      <PagerBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</PagerBtn>
      <PagerInfo>{page + 1} / {totalPages}</PagerInfo>
      <PagerBtn disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>›</PagerBtn>
    </PagerRow>
  )}
</>`,
    Demo: GPGDemo,
  },
  {
    key: "TPG",
    name: "Table Pagination Group",
    category: "Navigation",
    summary: "Full pagination bar: page info (left), controls (right) = reset + page-size selector + prev/next. Used for grid/table views on tablet+. Two modes: standalone (fixed sizes 5/10/25/50) or inside ACR (column-count multiples).",
    usage: "Place below a table/grid. Show reset button only when custom page size is active. `TpgBtn` is 5×10 padding, radius 8. Dropdown options reflect mode.",
    code: `<TpgRow>
  <TpgInfo>Page {page} of {total} · {count} results</TpgInfo>
  <TpgControls>
    {custom && <ResetBtn onClick={resetSize}>↺</ResetBtn>}
    <TpgSelect value={size} onChange={setSize}>
      {sizes.map(n => <option key={n}>{n}</option>)}
    </TpgSelect>
    <TpgBtn onClick={prev} disabled={page === 1}>‹</TpgBtn>
    <TpgBtn onClick={next} disabled={page === total}>›</TpgBtn>
  </TpgControls>
</TpgRow>`,
    Demo: TPGDemo,
  },
  {
    key: "ACR",
    name: "Adaptive Collection Renderer",
    category: "Navigation",
    summary: "Orchestrator that switches between GPG (mobile) and TPG (tablet+) based on viewport. Detects columns via `matchMedia` at 600/900/1200px. Default page size = column count so every page fills one row.",
    usage: "Wrap any repeated-card collection. Provide a shared `renderCard()`. ACR picks the view mode, column count, and page size — child GPG/TPG just render from it.",
    code: `<ACR
  items={items}
  renderCard={(item) => <Card {...item} />}
  breakpoints={{ 600: 1, 900: 2, 1200: 3, Infinity: 5 }}
/>`,
    Demo: ACRDemo,
  },
  {
    key: "Lightswitch",
    name: "Lightswitch",
    category: "Toggles",
    summary: "The 3D circle-on-a-stick toggle for collapse/expand and on/off semantics. Glows when on, dims when off, greyed when there's no content to toggle. Use for collapse/expand, on/off, mobile-preview switchers, batch-collapse in TSG.",
    usage: "Do NOT use for show/hide visibility — that's the Eye Icon Toggle. Keep the semantic split clean.",
    code: `<Lightswitch
  on={expanded}
  onChange={setExpanded}
  disabled={!hasContent}
/>`,
    Demo: LightswitchDemo,
  },
  {
    key: "ECL",
    name: "Expand-Collapse Lightswitch",
    category: "Toggles",
    summary: "A single Lightswitch per component that toggles whether the component's interactive controls are visible (off = controls hidden; label, row, and ECL itself stay visible). Side-label reads 'Collapse' when expanded, 'Expand' when collapsed — immediately left of the switch.",
    usage: "Exactly one ECL per component. On an SRT it hides slider+reset+input. Controlled (`expanded` + `onExpandedChange`) or uncontrolled.",
    code: `<Row>
  <Label>{name}</Label>
  {expanded && <Slider {...} />}
  <CollapseLabel>{expanded ? "Collapse" : "Expand"}</CollapseLabel>
  <Lightswitch on={expanded} onChange={setExpanded} />
</Row>`,
    Demo: ECLDemo,
  },
  {
    key: "EyeIcon",
    name: "Eye Icon Toggle",
    category: "Toggles",
    summary: "22×22 cyan square button with IconEye/IconEyeOff. Toggles whether a component **renders on the page** (show/hide). Replaces the Lightswitch for visibility specifically — Lightswitch is reserved for expand/collapse and on/off state.",
    usage: "Whole eyeball = visible, crossed-out eyeball = hidden. 4px radius, cyan when visible, dim gray when hidden.",
    code: `<EyeBtn visible={visible} onClick={() => setVisible(v => !v)}>
  {visible ? <IconEye /> : <IconEyeOff />}
</EyeBtn>`,
    Demo: EyeIconDemo,
  },
  {
    key: "QMBM",
    name: "Question-Mark-Bubble Modal",
    category: "Menus",
    summary: "Small `?` bubble that opens an info card with title + body. Use instead of hover-tooltips when the explanation is longer than a sentence or needs to be touch-friendly. Portaled to body so ancestor overflow/z-index doesn't clip it.",
    usage: "Click toggles, Escape closes, × closes, outside-click closes. Themes: neutral/cyan/lavender. Placements: modal (backdrop) or popover (inside an open modal).",
    code: `<QMBM
  theme="cyan"
  placement="popover"
  title="Webhook secret"
  body="Used to sign outbound payloads…"
/>`,
    Demo: QMBMDemo,
  },
  {
    key: "DDM",
    name: "Dropdown Menu",
    category: "Menus",
    summary: "Rounded-pill dropdown. Two variants: simple (whole trigger toggles) and split-pill (left half = default action, right half = triangle that opens menu, divided by 1.5px border). Mystic-purple gradient on hover, filled triangle arrow, fade+slide-down menu entry.",
    usage: "Escape closes before any parent modal's Escape. Outside-click closes. Action pairs use `min-width: 140px` to stay visually matched.",
    code: `<DDMWrapper>
  <DDMTrigger onClick={toggle}>
    {value} <Triangle />
  </DDMTrigger>
  {open && (
    <DDMMenu>
      {options.map(o => <DDMItem onClick={() => pick(o)}>{o}</DDMItem>)}
    </DDMMenu>
  )}
</DDMWrapper>`,
    Demo: DDMDemo,
  },
  {
    key: "SBDM",
    name: "Search Bar Dropdown Menu",
    category: "Menus",
    summary: "Hybrid type-ahead + browse pattern. Single rounded input with a 🔍 icon (left) and a ▾ dropdown arrow (right). Typing filters in place. Clicking the arrow opens a panel below with its own inner search bar and an A-Z ⇄ Z-A sort toggle whose label reads the OPPOSITE of the current state.",
    usage: "Use when the dataset is large enough that typing alone is faster than scrolling, but the user might not know the exact name. Examples: country picker, tag selector, model picker. Don't use for small fixed lists (≤8 items) — use a DDM instead. Selecting a list item fills the trigger input and closes the panel.",
    code: `<SBDMWrapper>
  <SBDMTrigger>
    <SearchIcon />
    <input value={value} onChange={onChange} placeholder="Search…" />
    <ArrowBtn onClick={() => setOpen(o => !o)}>▾</ArrowBtn>
  </SBDMTrigger>

  {open && (
    <SBDMPanel>
      <PanelHeader>
        <input value={inner} onChange={...} placeholder="Search inside…" autoFocus />
        <SortToggle onClick={() => setAsc(a => !a)}>
          {asc ? "Z-A" : "A-Z"} ↕
        </SortToggle>
      </PanelHeader>
      <PanelList>
        {items
          .filter(matches(inner))
          .sort(asc ? az : za)
          .map(item => (
            <PanelItem onClick={() => select(item)}>{item}</PanelItem>
          ))}
      </PanelList>
    </SBDMPanel>
  )}
</SBDMWrapper>`,
    Demo: SBDMDemo,
  },
  {
    key: "SRT",
    name: "Sliding Resize Toggle",
    category: "Editor Controls",
    summary: "Editor slider with cyan gradient track + 3D radial-glow thumb. Four pieces: slider, Reset Button (↺), ValueInput (square, tabular numerals, typing moves slider), and ECL at far right. The canonical 3-axis block is Zoom / X-Axis / Y-Axis in that order.",
    usage: "Use resetValue prop or auto-pick (0 if range straddles 0, else 1 if covers 1, else midpoint). ValueInput is controlled — typing updates slider immediately.",
    code: `<SRT
  label="Zoom"
  min={0.5} max={2} step={0.05}
  resetValue={1}
  value={v} onChange={setV}
/>`,
    Demo: SRTDemo,
  },
  {
    key: "ResetButton",
    name: "Reset Button",
    category: "Editor Controls",
    summary: "20×20 cyan-bordered square with ↺ glyph. Canonical 'back to default' affordance. Sits left of editable value inputs.",
    usage: "Reuse this exact element anywhere an editor control needs a reset affordance. Don't invent a new look.",
    code: `<ResetBtn onClick={() => setValue(defaultValue)}>↺</ResetBtn>

// styled
const ResetBtn = styled.button\`
  width: 20px; height: 20px; border-radius: 4px;
  border: 1px solid rgba(0,228,253,0.25);
  background: rgba(0,228,253,0.08);
  color: rgba(0,228,253,0.95);
  font-size: 12px;
  &:hover { background: rgba(0,228,253,0.2); }
\`;`,
    Demo: ResetBtnDemo,
  },
  {
    key: "TSG",
    name: "Tab Switch Group",
    category: "Editor Controls",
    summary: "Horizontal control row at the top of a dashboard tab. Contains: (1) Labels/Icons Lightswitch (toggles text labels vs. SVG icons), (2) Collapse-All Lightswitch (expands/collapses every collapsible section in the tab).",
    usage: "Both switches left-aligned. Tooltip on hover (mouse) or always visible (touch). Add a TSG to every new dashboard tab with collapsible sections.",
    code: `<TSG>
  <Lightswitch on={iconMode} onChange={setIconMode} />
  <Label>Labels / Icons</Label>
  <Lightswitch on={allExpanded} onChange={setAllExpanded} />
  <Label>{allExpanded ? "Collapse all" : "Expand all"}</Label>
</TSG>`,
    Demo: TSGDemo,
  },
  {
    key: "SB",
    name: "SuggestionBox",
    category: "Navigation",
    summary: "Dashed-border dashboard tile that opens a feature-request modal. Users describe an idea, Claude AI generates a structured implementation plan, GPG paginates responses. A 'Send to admin team' button emails the full conversation via Fastmail JMAP with an 'Implement immediately' CTA that routes to Sandbox staging.",
    usage: "Add as the final dashboard tile. Tile has transparent background with dashed pink border. Modal has three phases: form (name + description), chat (Claude conversation with GPG), sent (confirmation). The API route handles both Claude chat and email sending via action parameter.",
    code: `// Tile (in dashboard page.tsx tiles array)
{ key: "Suggest", title: "Suggest", subtitle: "Feature ideas",
  glow: "pink", icon: <span>\u{1F4A1}</span>,
  onClick: () => setSuggestionOpen(true) }

// Special dashed border in tile renderer
const isSuggest = tile.key === "Suggest";
style={{
  background: isSuggest ? "transparent" : \u0060rgba(...)\u0060,
  border: isSuggest ? \u0060dashed...\u0060 : \u0060solid...\u0060,
}}

// Modal import
import SuggestionBoxModal from "./suggestion/SuggestionBoxModal";
{suggestionOpen && <SuggestionBoxModal onClose={() => setSuggestionOpen(false)} />}`,
    Demo: SuggestionBoxDemo,
  },
];

export const CATEGORIES: Array<SandboxEntry["category"]> = ["Navigation", "Toggles", "Menus", "Editor Controls"];
