import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const DB_REGISTRY: Record<
  string,
  { displayName: string; owner: string; color: string }
> = {
  refusionist_db: { displayName: "Refusionist", owner: "refusionist_app", color: "#ff4ecb" },
  giocoelho_db:   { displayName: "Gio Coelho",  owner: "giocoelho",       color: "#00bfff" },
  tgv_db:         { displayName: "TGV",          owner: "tgv_app",         color: "#f7b700" },
};

export function isAllowedDb(db: string): boolean {
  return db in DB_REGISTRY;
}

// Collapse whitespace so multiline queries don't break the shell -c argument
function normalize(query: string) {
  return query.replace(/\s+/g, " ").trim();
}

export async function psql(db: string, query: string): Promise<string> {
  const { stdout } = await execAsync(
    `sudo -u postgres psql -d ${db} -c ${JSON.stringify(normalize(query))} --no-align --tuples-only -F '|'`
  );
  return stdout;
}

export async function psqlCsv(db: string, query: string): Promise<string> {
  const { stdout } = await execAsync(
    `sudo -u postgres psql -d ${db} -c ${JSON.stringify(normalize(query))} --csv`
  );
  return stdout;
}
