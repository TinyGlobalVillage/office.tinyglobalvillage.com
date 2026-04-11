import { NextRequest } from "next/server";
import { isAllowedDb, psql } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ db: string }> }
) {
  const { db } = await params;
  if (!isAllowedDb(db)) return new Response("Not found", { status: 404 });

  try {
    const out = await psql(
      db,
      `SELECT t.tablename,
              pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename)::regclass)) AS size,
              COALESCE(s.n_live_tup, 0) AS row_estimate
       FROM pg_tables t
       LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
       WHERE t.schemaname = 'public'
       ORDER BY t.tablename`
    );

    const tables = out
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const [name, size, rows] = line.split("|");
        return {
          name: name?.trim(),
          size: size?.trim() ?? "—",
          rowEstimate: parseInt(rows?.trim() ?? "0", 10) || 0,
        };
      })
      .filter((t) => t.name);

    return Response.json(tables);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
