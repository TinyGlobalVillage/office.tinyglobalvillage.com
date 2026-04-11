import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";

const CLIENT_ROOT = "/srv/refusion-core/client";

export async function GET() {
  try {
    const entries = await readdir(CLIENT_ROOT, { withFileTypes: true });

    const projects = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const portFile = `${CLIENT_ROOT}/${e.name}/.port`;
          let port: string | null = null;
          if (existsSync(portFile)) {
            port = (await readFile(portFile, "utf-8")).trim();
          }
          return {
            name: e.name,
            port,
            url: `https://${e.name}`,
          };
        })
    );

    return Response.json(projects);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
