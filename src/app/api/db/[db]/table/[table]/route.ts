import { NextRequest } from "next/server";
import { isAllowedDb, psqlCsv, psql } from "@/lib/db";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuote = !inQuote; continue; }
    if (line[i] === "," && !inQuote) { values.push(cur); cur = ""; continue; }
    cur += line[i];
  }
  values.push(cur);
  return values;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ db: string; table: string }> }
) {
  const { db, table } = await params;
  if (!isAllowedDb(db)) return new Response("Not found", { status: 404 });
  if (!SAFE_IDENT.test(table)) return new Response("Invalid table", { status: 400 });

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  try {
    const [colOut, countOut, dataOut] = await Promise.all([
      psql(
        db,
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name='${table}'
         ORDER BY ordinal_position`
      ),
      psql(db, `SELECT COUNT(*) FROM "${table}"`),
      psqlCsv(db, `SELECT * FROM "${table}" LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const columns = colOut
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const [name, type, nullable, def] = line.split("|");
        return {
          name: name?.trim(),
          type: type?.trim(),
          nullable: nullable?.trim() === "YES",
          default: def?.trim() || null,
        };
      })
      .filter((c) => c.name);

    const totalRows = parseInt(countOut.trim(), 10) || 0;

    const csvLines = dataOut.split("\n").filter((l) => l.trim());
    const headers = parseCsvLine(csvLines[0] ?? "");
    const rows = csvLines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
      return obj;
    });

    return Response.json({ columns, rows, totalRows, limit, offset });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
