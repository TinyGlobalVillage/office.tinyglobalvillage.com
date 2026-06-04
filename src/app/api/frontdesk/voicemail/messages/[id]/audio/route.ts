/**
 * Voicemail message playback. If the file is encrypted (.wav.gpg), decrypts
 * to a temp file using the GPG key, streams it back, and removes the temp.
 *
 * Mirrors the pattern used by /api/frontdesk/calls/recordings/[id]/audio.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import os from "node:os";
import crypto from "node:crypto";

export const runtime = "nodejs";

const VM_DIR =
  "/srv/refusion-core/clients/office.tinyglobalvillage.com/telephony/data/voicemails";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const plain = path.join(VM_DIR, `${id}.wav`);
  const encrypted = path.join(VM_DIR, `${id}.wav.gpg`);

  if (existsSync(plain)) {
    const buf = await fs.readFile(plain);
    return wavResponse(buf);
  }
  if (existsSync(encrypted)) {
    const tmp = path.join(os.tmpdir(), `vm-${crypto.randomBytes(8).toString("hex")}.wav`);
    const result = spawnSync(
      "gpg",
      ["--batch", "--yes", "--output", tmp, "--decrypt", encrypted],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    if (result.status !== 0) {
      return NextResponse.json(
        { error: "Decryption failed", stderr: result.stderr?.toString() ?? "" },
        { status: 500 }
      );
    }
    try {
      const buf = await fs.readFile(tmp);
      return wavResponse(buf);
    } finally {
      fs.unlink(tmp).catch(() => {});
    }
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  for (const ext of [".wav", ".wav.gpg"]) {
    const f = path.join(VM_DIR, `${id}${ext}`);
    if (existsSync(f)) await fs.unlink(f);
  }
  return NextResponse.json({ ok: true });
}

function wavResponse(buf: Buffer): Response {
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}
