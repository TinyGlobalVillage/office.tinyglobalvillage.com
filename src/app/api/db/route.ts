import { DB_REGISTRY, psql } from "@/lib/db";

export async function GET() {
  const dbs = await Promise.all(
    Object.entries(DB_REGISTRY).map(async ([name, meta]) => {
      try {
        const out = await psql(
          name,
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
        );
        return { name, ...meta, tableCount: parseInt(out.trim(), 10) || 0 };
      } catch {
        return { name, ...meta, tableCount: 0, error: true };
      }
    })
  );
  return Response.json(dbs);
}
