"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";

/* ── Types ─────────────────────────────────────────────────────── */

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
  refusionist_db: colors.pink,
  giocoelho_db: colors.cyan,
  tgv_db: colors.gold,
};

/* ── Styled Components ─────────────────────────────────────────── */

const PageMain = styled.main`
  display: flex;
  min-height: 100vh;
  padding: 6rem 1rem 2rem;
  max-width: 87.5rem;
  margin: 0 auto;
  width: 100%;
  gap: 1rem;
`;

const Sidebar = styled.aside<{ $width: number; $borderLeft?: boolean }>`
  width: ${(p) => p.$width}px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: ${(p) => (p.$borderLeft ? "0.5rem" : "0.75rem")};
  padding-top: 1rem;
  ${(p) =>
    p.$borderLeft &&
    `border-left: 1px solid var(--t-border); padding-left: 1rem;`}
`;

const SidebarTitle = styled.h2`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--t-textGhost);
  padding: 0 0.25rem;
`;

const DbButton = styled.button<{ $active: boolean; $color: string }>`
  text-align: left;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) =>
    p.$active
      ? `linear-gradient(135deg, ${p.$color}22, ${p.$color}08)`
      : "var(--t-inputBg)"};
  border: 1px solid
    ${(p) => (p.$active ? `${p.$color}55` : "var(--t-border)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? `${p.$color}10` : "var(--t-surface)")};
  }
`;

const DbName = styled.div<{ $color: string }>`
  font-weight: 700;
  font-size: 0.875rem;
  color: ${(p) => p.$color};
`;

const DbTableCount = styled.div`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  margin-top: 0.125rem;
`;

const DbSlug = styled.div`
  font-size: 10px;
  color: var(--t-textGhost);
  font-family: monospace;
  margin-top: 0.125rem;
`;

const TableButton = styled.button<{ $active: boolean; $color: string }>`
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$active ? `${p.$color}18` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$active ? `${p.$color}44` : "transparent")};
  color: ${(p) => (p.$active ? p.$color : "var(--t-textMuted)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? `${p.$color}12` : "var(--t-surface)")};
  }
`;

const TableBtnName = styled.div`
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TableBtnMeta = styled.div`
  color: var(--t-textGhost);
  font-size: 10px;
  margin-top: 0.125rem;
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
  min-width: 0;
  border-left: 1px solid var(--t-border);
  padding-left: 1rem;
`;

const ContentHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ContentTitle = styled.h1<{ $color: string }>`
  font-size: 1.125rem;
  font-weight: 700;
  font-family: monospace;
  color: ${(p) => p.$color};
`;

const RowCount = styled.span`
  font-size: 0.75rem;
  color: var(--t-textGhost);
`;

const Placeholder = styled.div`
  color: var(--t-textGhost);
  font-size: 0.875rem;
  padding-top: 1rem;
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
`;

const ColumnChip = styled.span<{ $color: string }>`
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 10px;
  font-family: monospace;
  background: ${(p) => p.$color}12;
  border: 1px solid ${(p) => p.$color}22;
  color: var(--t-textMuted);
`;

const ChipName = styled.span<{ $color: string }>`
  color: ${(p) => p.$color};
`;

const ChipType = styled.span`
  color: var(--t-textGhost);
  margin-left: 0.25rem;
`;

const SkeletonBlock = styled.div<{ $h: number }>`
  border-radius: 0.75rem;
  width: 100%;
  height: ${(p) => p.$h}px;
  background: var(--t-inputBg);
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

/* Data table */

const DataTableWrap = styled.div<{ $color: string }>`
  overflow: auto;
  border-radius: 0.75rem;
  max-height: 40vh;
  border: 1px solid ${(p) => p.$color}22;
`;

const StyledTable = styled.table`
  width: 100%;
  font-size: 0.75rem;
  font-family: monospace;
  border-collapse: collapse;
`;

const TableHead = styled.thead<{ $color: string }>`
  tr {
    background: ${(p) => p.$color}12;
    border-bottom: 1px solid ${(p) => p.$color}22;
  }
`;

const Th = styled.th<{ $color: string }>`
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  color: ${(p) => p.$color};
`;

const Tr = styled.tr`
  border-bottom: 1px solid var(--t-border);
  transition: background 0.1s;

  &:hover {
    background: var(--t-inputBg);
  }
`;

const Td = styled.td`
  padding: 0.375rem 0.75rem;
  color: var(--t-textMuted);
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NullCell = styled.span`
  color: var(--t-textGhost);
  font-style: italic;
`;

/* SQL Editor */

const SqlEditorWrap = styled.div<{ $color: string }>`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-radius: 0.75rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid ${(p) => p.$color}22;

  [data-theme="light"] & {
    background: var(--t-inputBg);
  }
`;

const SqlHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SqlLabel = styled.span`
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--t-textGhost);
`;

const SqlRunBtn = styled.button<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  background: linear-gradient(to right, ${(p) => p.$color}cc, ${(p) => p.$color}88);
  color: #0a0a0a;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const SqlShortcut = styled.span`
  font-size: 10px;
  opacity: 0.6;
  margin-left: 0.25rem;
`;

const SqlTextarea = styled.textarea<{ $color: string }>`
  width: 100%;
  resize: vertical;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-family: monospace;
  outline: none;
  min-height: 80px;
  background: var(--t-inputBg);
  border: 1px solid ${(p) => p.$color}33;
  color: var(--t-text);

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

const SqlError = styled.pre`
  font-size: 0.75rem;
  color: ${colors.red};
  font-family: monospace;
  white-space: pre-wrap;
  background: rgba(${rgb.red}, 0.08);
  border-radius: 0.5rem;
  padding: 0.75rem;
`;

/* SQL result table */

const SqlResultWrap = styled.div<{ $color: string }>`
  overflow: auto;
  border-radius: 0.5rem;
  max-height: 16rem;
  border: 1px solid ${(p) => p.$color}22;
`;

const SqlResultFooter = styled.div`
  padding: 0.25rem 0.5rem;
  font-size: 10px;
  color: var(--t-textGhost);
  border-top: 1px solid var(--t-border);
`;

const SqlOk = styled.span`
  font-size: 0.75rem;
  color: #00dc64;
`;

/* ── Components ────────────────────────────────────────────────── */

export default function DatabasePage() {
  const [databases, setDatabases] = useState<DbInfo[]>([]);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loadingDbs, setLoadingDbs] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

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

  const color = selectedDb ? (STATUS_COLOR[selectedDb] ?? colors.cyan) : colors.cyan;

  return (
    <>
      <TopNav />
      <PageMain>
        {/* Left: DB list */}
        <Sidebar $width={224}>
          <SidebarTitle>Databases</SidebarTitle>
          {loadingDbs
            ? [0, 1, 2].map((i) => <SkeletonBlock key={i} $h={64} />)
            : databases.map((db) => (
                <DbButton
                  key={db.name}
                  $active={selectedDb === db.name}
                  $color={db.color}
                  onClick={() => selectDb(db.name)}
                >
                  <DbName $color={db.color}>{db.displayName}</DbName>
                  <DbTableCount>{db.tableCount} tables</DbTableCount>
                  <DbSlug>{db.name}</DbSlug>
                </DbButton>
              ))}
        </Sidebar>

        {/* Middle: Table list */}
        <Sidebar $width={208} $borderLeft>
          <SidebarTitle>{selectedDb ? "Tables" : "Select a DB"}</SidebarTitle>
          {loadingTables
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} $h={32} />)
            : tables.map((t) => (
                <TableButton
                  key={t.name}
                  $active={selectedTable === t.name}
                  $color={color}
                  onClick={() => selectedDb && selectTable(selectedDb, t.name)}
                >
                  <TableBtnName>{t.name}</TableBtnName>
                  <TableBtnMeta>
                    ~{t.rowEstimate.toLocaleString()} rows · {t.size}
                  </TableBtnMeta>
                </TableButton>
              ))}
        </Sidebar>

        {/* Right: Data + SQL */}
        <ContentArea>
          {selectedTable ? (
            <ContentHeader>
              <ContentTitle $color={color}>{selectedTable}</ContentTitle>
              {tableData && (
                <RowCount>{tableData.totalRows.toLocaleString()} total rows</RowCount>
              )}
            </ContentHeader>
          ) : (
            <Placeholder>
              {selectedDb ? "← Select a table" : "← Select a database"}
            </Placeholder>
          )}

          {tableData && (
            <ChipRow>
              {tableData.columns.map((col) => (
                <ColumnChip
                  key={col.name}
                  $color={color}
                  title={`${col.type}${col.nullable ? " | nullable" : ""}${col.default ? ` | default: ${col.default}` : ""}`}
                >
                  <ChipName $color={color}>{col.name}</ChipName>
                  <ChipType>{col.type}</ChipType>
                </ColumnChip>
              ))}
            </ChipRow>
          )}

          {loadingData ? (
            <SkeletonBlock $h={200} />
          ) : tableData?.rows.length ? (
            <DataTableComponent data={tableData} color={color} />
          ) : null}

          {selectedDb && (
            <SqlEditorComponent
              value={sql}
              onChange={setSql}
              onRun={runSql}
              running={sqlRunning}
              result={sqlResult}
              error={sqlError}
              color={color}
            />
          )}
        </ContentArea>
      </PageMain>
    </>
  );
}

function DataTableComponent({ data, color }: { data: TableData; color: string }) {
  const cols = data.columns.map((c) => c.name);

  return (
    <DataTableWrap $color={color}>
      <StyledTable>
        <TableHead $color={color}>
          <tr>
            {cols.map((c) => (
              <Th key={c} $color={color}>{c}</Th>
            ))}
          </tr>
        </TableHead>
        <tbody>
          {data.rows.map((row, i) => (
            <Tr key={i}>
              {cols.map((c) => (
                <Td key={c} title={row[c]}>
                  {row[c] === "" ? <NullCell>null</NullCell> : row[c]}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </StyledTable>
    </DataTableWrap>
  );
}

function SqlEditorComponent({
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

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onRun();
    }
  };

  return (
    <SqlEditorWrap $color={color}>
      <SqlHeader>
        <SqlLabel>SQL Editor</SqlLabel>
        <SqlRunBtn $color={color} onClick={onRun} disabled={running || !value.trim()}>
          {running ? "⟳ Running…" : "▶ Run"}
          <SqlShortcut>⌘↵</SqlShortcut>
        </SqlRunBtn>
      </SqlHeader>

      <SqlTextarea
        ref={taRef}
        $color={color}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        rows={4}
        spellCheck={false}
        placeholder='SELECT * FROM users LIMIT 10;'
      />

      {result && <SqlResultTableComponent csv={result} color={color} />}
      {error && <SqlError>{error}</SqlError>}
    </SqlEditorWrap>
  );
}

function SqlResultTableComponent({ csv, color }: { csv: string; color: string }) {
  const lines = csv.split("\n").filter((l) => l.trim());
  if (!lines.length) return <SqlOk>Query OK (no rows returned)</SqlOk>;

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
    <SqlResultWrap $color={color}>
      <StyledTable>
        <TableHead $color={color}>
          <tr>
            {headers.map((h) => (
              <Th key={h} $color={color}>{h}</Th>
            ))}
          </tr>
        </TableHead>
        <tbody>
          {rows.map((row, i) => (
            <Tr key={i}>
              {row.map((cell, j) => (
                <Td key={j} title={cell}>
                  {cell || <NullCell>null</NullCell>}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </StyledTable>
      <SqlResultFooter>
        {rows.length} row{rows.length !== 1 ? "s" : ""}
      </SqlResultFooter>
    </SqlResultWrap>
  );
}
