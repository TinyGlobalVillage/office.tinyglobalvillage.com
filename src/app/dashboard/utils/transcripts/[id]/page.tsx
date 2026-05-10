/**
 * Full-page transcript editor route.
 *
 *   /dashboard/utils/transcripts/<id>
 *
 * Reached from:
 *   - Office Utils → Media & Transcription → 🎙️ Audio Transcriber tile.
 *     Operator picks a saved transcript in the modal, then clicks
 *     "Open in editor →" — which router.push()es here.
 *   - Direct deep-link / bookmark.
 *
 * The editor itself lives in @tgv/module-connect/transcriber/editor so it
 * can be reused by other tenants (refusionist.com audio annotations,
 * future TGV.com voice-note pages). This page is a thin Next.js shell:
 * resolve the id, render the editor, hand it the router for "Back".
 */
"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import TopNav from "../../../../components/TopNav";
import { TranscriptDocEditor } from "@tgv/module-connect/transcriber";

export default function TranscriptEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const transcriptId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : (raw ?? "");
  }, [params]);

  if (!transcriptId) {
    return (
      <>
        <TopNav />
        <main style={{ padding: "2rem" }}>
          <p>Missing transcript id.</p>
          <button type="button" onClick={() => router.push("/dashboard/utils")}>
            ← Back to Utils
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <TranscriptDocEditor
        transcriptId={transcriptId}
        onExit={() => router.push("/dashboard/utils")}
      />
    </>
  );
}
