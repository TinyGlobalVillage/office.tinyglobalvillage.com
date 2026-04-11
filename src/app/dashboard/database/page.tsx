"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TopNav from "../../components/TopNav";

// ── Types ─────────────────────────────────────────────────────────
type DbInfo = {
  name: string;
  displayName: string;
  color: string;
  tableCount: number;
};

type TableInfo = {
  name: string;
  size: string;
  rowEstimate: number;
};

type ColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
};

type TableData = {
  columns: ColumnInfo[];
  rows: Record<string, string>[];
  totalRows: number;
  limit: number;
  offset: number;
};

const STATUS_COLOR: Record<string, string> = {
  refusionist_db: "#ff4ecb",
  giocoelho_db:   "#00bfff",
  tgv_db:         "#f7b700",
};

// ── Main page ─────────────────────────────────────────────────────
export default function DatabasePage() {
  const [databases, setDatabases] = useState<DbInfo[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loadingDbs, setLoadingDbs] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // SQL editor
  const [sql, setSql] = useState("");
  const [sqlResult, setSqlResult] = useState<string | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlRunning, setSqlRunning] = useState(false);

  useEffect(() => {
    fetch("/api/db")
      .then((r) => r.json())
      .then(setDatabases)
      .finally(() => setLoadingDbs(false));
  }, []);

  const selectDb = useCallback(async (dbName: string) => {
    setSelectedDb(dbName);
    setSelectedTable(null);
    setTableData(null);
    setSql("");
    setSqlResult(null);
    setSqlError(null);
    setLoadingTables(true);
    try {
      const res = await fetch(`/api/db/${dbName}/tables`);
      setTables(await res.json());
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const selectTable = useCallback(async (db: string, table: string) => {
    setSelectedTable(table);
    setTableData(null);
    setLoadingData(true);
    setSql(`SELECT * FROM "${table}" LIMIT 50;`);
    setSqlResult(null);
    setSqlError(null);
    try {
      const res = await fetch(`/api/db/${db}/table/${table}?limit=50`);
      setTableData(await res.json());
    } finally {
      setLoadingData(false);
    }
  }, []);

  const runSql = useCallback(async () => {
    if (!selectedDb || !sql.trim() || sqlRunning) return;
    setSqlRunning(true);
    setSqlResult(null);
    setSqlError(null);

    try {
      const res = await fetch(`/api/db/${selectedDb}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
      });

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let csv = "";
      let err = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const raw = chunk.replace(/^data: /, "").trim();
          if (!raw) continue;
          try {
            const { type, data } = JSON.parse(raw);
            if (type === "csv") csv += data;
            if (type === "err") err += data + "\n";
          } catch { /* skip */ }
        }
      }

      if (err) setSqlError(err.trim());
      if (csv) setSqlResult(csv.trim());
    } catch (e) {
      setSqlError(String(e));
    } finally {
      setSqlRunning(false);
    }
  }, [selectedDb, sql, sqlRunning]);

  const color = selectedDb ? (STATUS_COLOR[selectedDb] ?? "#00bfff") : "#00bfff";

  return (
    <>
      <TopNav />
      <main className="flex min-h-screen pt-24 pb-8 px-4 max-w-[1400px] mx-auto w-full gap-4">

        {/* ── Left: DB list ────────────────────────────────────── */}
        <aside className="w-56 shrink-0 flex flex-col gap-3 pt-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 px-1">
            Databases
          </h2>
          {loadingDbs ? (
            [0,1,2].map(i => <Skeleton key={i} h={64} />)
          ) : (
            databases.map((db) => (
              <button
                key={db.name}
                onClick={() => selectDb(db.name)}
                className="text-left px-4 py-3 rounded-xl transition-all duration-150"
                style={{
                  background: selectedDb === db.name
                    ? `linear-gradient(135deg, ${db.color}22, ${db.color}08)`
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selectedDb === db.name ? db.color + "55" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <div className="font-bold text-sm" style={{ color: db.color }}>
                  {db.displayName}
                </div>
                <div className="text-xs text-white/40 mt-0.5">{db.tableCount} tables</div>
                <div className="text-[10px] text-white/25 font-mono mt-0.5">{db.name}</div>
              </button>
            ))
          )}
        </aside>

        {/* ── Middle: Table list ───────────────────────────────── */}
        <aside className="w-52 shrink-0 flex flex-col gap-2 pt-4 border-l border-white/5 pl-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 px-1">
            {selectedDb ? "Tables" : "Select a DB"}
          </h2>
          {loadingTables ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={32} />)
          ) : (
            tables.map((t) => (
              <button
                key={t.name}
                onClick={() => selectedDb && selectTable(selectedDb, t.name)}
                className="text-left px-3 py-2 rounded-lg text-xs transition-all"
                style={{
                  background: selectedTable === t.name
                    ? `${color}18`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${selectedTable === t.name ? color + "44" : "transparent"}`,
                  color: selectedTable === t.name ? color : "rgba(255,255,255,0.6)",
                }}
              >
                <div className="font-mono truncate">{t.name}</div>
                <div className="text-white/30 text-[10px] mt-0.5">
                  ~{t.rowEstimate.toLocaleString()} rows · {t.size}
                </div>
              </button>
            ))
          )}
        </aside>

        {/* ── Right: Data + SQL editor ─────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 pt-4 min-w-0 border-l border-white/5 pl-4">

          {/* Header */}
          {selectedTable ? (
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold font-mono" style={{ color }}>
                {selectedTable}
              </h1>
              {tableData && (
                <span className="text-xs text-white/40">
                  {tableData.totalRows.toLocaleString()} total rows
                </span>
              )}
            </div>
          ) : (
            <div className="text-white/25 text-sm pt-4">
              {selectedDb ? "← Select a table" : "← Select a database"}
            </div>
          )}

          {/* Column chips */}
          {tableData && (
            <div className="flex flex-wrap gap-1.5">
              {tableData.columns.map((col) => (
                <span
                  key={col.name}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono"
                  style={{
                    background: `${color}12`,
                    border: `1px solid ${color}22`,
                    color: "rgba(255,255,255,0.6)",
                  }}
                  title={`${col.type}${col.nullable ? " | nullable" : ""}${col.default ? ` | default: ${col.default}` : ""}`}
                >
                  <span style={{ color }}>{col.name}</span>
                  <span className="text-white/30 ml-1">{col.type}</span>
                </span>
              ))}
            </div>
          )}

          {/* Data table */}
          {loadingData ? (
            <Skeleton h={200} />
          ) : tableData?.rows.length ? (
            <DataTable data={tableData} color={color} />
          ) : null}

          {/* SQL Editor */}
          {selectedDb && (
            <SqlEditor
              value={sql}
              onChange={setSql}
              onRun={runSql}
              running={sqlRunning}
              result={sqlResult}
              error={sqlError}
              color={color}
            />
          )}
        </div>
      </main>
    </>
  );
}

// ── Data table ────────────────────────────────────────────────────
function DataTable({ data, color }: { data: TableData; color: string }) {
  const cols = data.columns.map((c) => c.name);

  return (
    <div className="overflow-auto rounded-xl border border-white/8 max-h-[40vh]" style={{ borderColor: `${color}22` }}>
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr style={{ background: `${color}12`, borderBottom: `1px solid ${color}22` }}>
            {cols.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-bold whitespace-nowrap" style={{ color }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-white/4 hover:bg-white/3 transition-colors"
            >
              {cols.map((c) => (
                <td
                  key={c}
                  className="px-3 py-1.5 text-white/70 whitespace-nowrap max-w-[200px] truncate"
                  title={row[c]}
                >
                  {row[c] === "" ? (
                    <span className="text-white/20 italic">null</span>
                  ) : row[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── SQL editor ────────────────────────────────────────────────────
function SqlEditor({
  value, onChange, onRun, running, result, error, color,
}: {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  running: boolean;
  result: string | null;
  error: string | null;
  color: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Cmd/Ctrl+Enter to run
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onRun();
    }
  };

  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${color}22` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-white/40">SQL Editor</span>
        <button
          onClick={onRun}
          disabled={running || !value.trim()}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-40 transition-all"
          style={{
            background: `linear-gradient(to right, ${color}cc, ${color}88)`,
            color: "#0a0a0a",
          }}
        >
          {running ? "⟳ Running…" : "▶ Run"}
          <span className="text-[10px] opacity-60 ml-1">⌘↵</span>
        </button>
      </div>

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        rows={4}
        spellCheck={false}
        className="w-full resize-y rounded-lg px-3 py-2 text-xs font-mono outline-none"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${color}33`,
          color: "#e2e8f0",
          minHeight: "80px",
        }}
        placeholder="SELECT * FROM users LIMIT 10;"
      />

      {/* Result */}
      {result && <SqlResultTable csv={result} color={color} />}
      {error && (
        <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap bg-red-500/8 rounded-lg p-3">
          {error}
        </pre>
      )}
    </div>
  );
}

// Parse CSV result and render as table
function SqlResultTable({ csv, color }: { csv: string; color: string }) {
  const lines = csv.split("\n").filter((l) => l.trim());
  if (!lines.length) return <span className="text-xs text-green-400">Query OK (no rows returned)</span>;

  const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue; }
      if (line[i] === "," && !inQ) { values.push(cur); cur = ""; continue; }
      cur += line[i];
    }
    values.push(cur);
    return values;
  });

  return (
    <div className="overflow-auto rounded-lg max-h-64" style={{ border: `1px solid ${color}22` }}>
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr style={{ background: `${color}12` }}>
            {headers.map((h) => (
              <th key={h} className="text-left px-2 py-1.5 font-bold whitespace-nowrap" style={{ color }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/5 hover:bg-white/3">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 text-white/70 whitespace-nowrap max-w-[180px] truncate" title={cell}>
                  {cell || <span className="text-white/20 italic">null</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-2 py-1 text-[10px] text-white/30 border-t border-white/5">
        {rows.length} row{rows.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

function Skeleton({ h }: { h: number }) {
  return (
    <div
      className="rounded-xl animate-pulse w-full"
      style={{ height: h, background: "rgba(255,255,255,0.04)" }}
    />
  );
}
