"use client";

// MeetCaptionsControlModal — the platform-wide gate for meet live captions
// (Utils → Media & Transcription → Meet Captions).
//
// Captions pipe every captioned meeting's audio through the meet-captions service
// (services/meet-captions, a hidden LiveKit participant) into a self-hosted whisper.cpp server —
// audio never leaves the box, which is exactly why the gate lives HERE: the operator decides when
// the box can afford the load. Seeded OFF until the RAM upgrade.
//
// Shape: HardeningControlModal shell (Telephony's pattern) + SuiteControlKit primitives; config
// read/write via /api/admin/meet-captions/config (shared-JSON seam, lib/meet-captions-config.ts).

import { useCallback, useEffect, useState } from "react";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import HardeningControlModal, { type HCMSection } from "../HardeningControlModal";
import AuditLogTimeline from "../_shared/AuditLogTimeline";
import {
  Banner,
  Body,
  Card,
  Dim,
  Err,
  Pill,
  Row,
  RowHelp,
  RowLabel,
  RowMain,
  Switch,
} from "../../villagers/_suite/SuiteControlKit";

type CaptionsConfig = {
  globalKillswitch: boolean;
  whisperEndpoint: string;
  whisperModel: string;
  language: string;
  maxRooms: number;
};

type ServiceStatus = {
  service: "online" | "offline" | "error";
  whisper?: "online" | "offline" | "unknown";
  rooms?: Array<{ room: string; startedAt: string; tracks: number; segments: number; droppedChunks: number }>;
};

export type MeetCaptionsControlModalProps = { onClose: () => void };

export default function MeetCaptionsControlModal({ onClose }: MeetCaptionsControlModalProps) {
  useEscapeToClose({ open: true, onClose });

  const [config, setConfig] = useState<CaptionsConfig | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ whisperEndpoint: string; whisperModel: string; language: string; maxRooms: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cfgRes, stRes] = await Promise.all([
        fetch("/api/admin/meet-captions/config", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/admin/meet-captions/status", { cache: "no-store", credentials: "same-origin" }),
      ]);
      if (cfgRes.ok) {
        const d = (await cfgRes.json()) as { config: CaptionsConfig };
        setConfig(d.config);
        setDraft({
          whisperEndpoint: d.config.whisperEndpoint,
          whisperModel: d.config.whisperModel,
          language: d.config.language,
          maxRooms: String(d.config.maxRooms),
        });
      }
      if (stRes.ok) setStatus((await stRes.json()) as ServiceStatus);
    } catch {
      /* swallow — modal renders with prior or null state */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true);
      setErr(null);
      try {
        const res = await fetch("/api/admin/meet-captions/config", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(patch),
        });
        const d = (await res.json().catch(() => ({}))) as { config?: CaptionsConfig; error?: string };
        if (!res.ok) throw new Error(d.error ?? "save_failed");
        if (d.config) setConfig(d.config);
      } catch (e) {
        setErr(String((e as Error)?.message ?? e));
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 6,
    color: "inherit",
    font: "inherit",
    fontSize: "0.8rem",
    padding: "0.3rem 0.5rem",
    width: "14rem",
    maxWidth: "100%",
  };

  const sections: HCMSection[] = [
    {
      id: "gate",
      title: "Platform Gate",
      qmbm:
        "The master switch for live captions in every meeting. While engaged, the host's \"Live captions\" toggle (meet Settings → Meeting) renders disabled with a pointer back here, and the meet-captions service refuses /start and winds down mid-meeting rooms. " +
        "Ships ENGAGED: streaming Whisper is a continuous CPU/RAM load the current 7.8GB box can't spare next to the prod apps. Release it when the RAM-upgraded box lands. Takes effect immediately, no redeploy — every consumer re-reads the shared JSON per request.",
      body: (
        <Body>
          {config && (
            <Banner $danger={config.globalKillswitch}>
              {config.globalKillswitch
                ? "CAPTIONS OFF PLATFORM-WIDE — hosts cannot turn captions on"
                : "Captions available — hosts turn them on per meeting"}
            </Banner>
          )}
          <Row>
            <RowMain>
              <RowLabel>Global killswitch</RowLabel>
              <RowHelp>
                Engaged = no meeting can be captioned, and running captioners hang up. Default ON
                until the box RAM upgrade.
              </RowHelp>
            </RowMain>
            <Switch
              $on={!!config?.globalKillswitch}
              $danger
              disabled={saving || !config}
              aria-label="Toggle meet captions killswitch"
              onClick={() => config && void save({ globalKillswitch: !config.globalKillswitch })}
            />
          </Row>
          {err && <Err>{err}</Err>}
        </Body>
      ),
    },
    {
      id: "engine",
      title: "Whisper Engine",
      qmbm:
        "Where transcription happens: a whisper.cpp HTTP server on this box (module-transcriber runs the PM2 pair — whisper-stt on :8510 English-only, whisper-stt-ml on :8511 multilingual). The meet-captions service POSTs each ~4s voiced audio window to <endpoint>/inference. " +
        "Model is informational (whisper.cpp loads its model at boot — repoint the endpoint to change models). Language empty = auto-detect per chunk. Max rooms caps concurrent captioned meetings — keep it at 1 until the new box proves out.",
      body: (
        <Body>
          {draft && (
            <>
              <Row>
                <RowMain>
                  <RowLabel>Endpoint</RowLabel>
                  <RowHelp>whisper.cpp server base URL</RowHelp>
                </RowMain>
                <input
                  style={inputStyle}
                  value={draft.whisperEndpoint}
                  aria-label="Whisper endpoint"
                  onChange={(e) => setDraft({ ...draft, whisperEndpoint: e.target.value })}
                />
              </Row>
              <Row>
                <RowMain>
                  <RowLabel>Model</RowLabel>
                  <RowHelp>label only — the server picks its model at boot</RowHelp>
                </RowMain>
                <input
                  style={inputStyle}
                  value={draft.whisperModel}
                  aria-label="Whisper model"
                  onChange={(e) => setDraft({ ...draft, whisperModel: e.target.value })}
                />
              </Row>
              <Row>
                <RowMain>
                  <RowLabel>Language</RowLabel>
                  <RowHelp>ISO code (en, no, …) or empty for auto-detect</RowHelp>
                </RowMain>
                <input
                  style={{ ...inputStyle, width: "6rem" }}
                  value={draft.language}
                  aria-label="Caption language"
                  onChange={(e) => setDraft({ ...draft, language: e.target.value })}
                />
              </Row>
              <Row>
                <RowMain>
                  <RowLabel>Max rooms</RowLabel>
                  <RowHelp>concurrent captioned meetings (1–20)</RowHelp>
                </RowMain>
                <input
                  style={{ ...inputStyle, width: "6rem" }}
                  value={draft.maxRooms}
                  inputMode="numeric"
                  aria-label="Max captioned rooms"
                  onChange={(e) => setDraft({ ...draft, maxRooms: e.target.value })}
                />
              </Row>
              <Row>
                <RowMain>
                  <RowHelp>Saved values apply to the next transcription batch — no restart.</RowHelp>
                </RowMain>
                <button
                  type="button"
                  disabled={saving}
                  aria-label="Save engine settings"
                  style={{
                    ...inputStyle,
                    width: "auto",
                    padding: "0.3rem 0.9rem",
                    cursor: saving ? "default" : "pointer",
                    opacity: saving ? 0.6 : 1,
                  }}
                  onClick={() =>
                    void save({
                      params: {
                        whisperEndpoint: draft.whisperEndpoint,
                        whisperModel: draft.whisperModel,
                        language: draft.language,
                        maxRooms: Number(draft.maxRooms),
                      },
                    })
                  }
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </Row>
            </>
          )}
          {!draft && <Dim>Loading…</Dim>}
        </Body>
      ),
    },
    {
      id: "live",
      title: "Live Status",
      qmbm:
        "The meet-captions control plane (PM2 `meet-captions`, 127.0.0.1:3120, bearer-token) and its view of the whisper engine. \"Service offline\" is NORMAL while the feature is dark — the PM2 process only needs to run once the killswitch is released. Rooms listed here are being captioned right now; each shows how many audio tracks it hears and how many caption segments it has published.",
      body: (
        <Body>
          <Row>
            <RowMain>
              <RowLabel>Captions service</RowLabel>
              <RowHelp>127.0.0.1:3120 (PM2 meet-captions)</RowHelp>
            </RowMain>
            <Pill $on={status?.service === "online"}>{status?.service ?? "…"}</Pill>
          </Row>
          <Row>
            <RowMain>
              <RowLabel>Whisper engine</RowLabel>
              <RowHelp>probed by the service on each status read</RowHelp>
            </RowMain>
            <Pill $on={status?.whisper === "online"}>{status?.whisper ?? "unknown"}</Pill>
          </Row>
          {(status?.rooms ?? []).map((r) => (
            <Card key={r.room}>
              <Row>
                <RowMain>
                  <RowLabel>{r.room}</RowLabel>
                  <RowHelp>
                    since {new Date(r.startedAt).toLocaleTimeString()} · {r.tracks} audio tracks ·{" "}
                    {r.segments} segments{r.droppedChunks ? ` · ${r.droppedChunks} dropped` : ""}
                  </RowHelp>
                </RowMain>
              </Row>
            </Card>
          ))}
          {status?.service === "online" && (status.rooms ?? []).length === 0 && (
            <Dim>No rooms are being captioned right now.</Dim>
          )}
        </Body>
      ),
    },
  ];

  return (
    <HardeningControlModal
      title="Meet Captions"
      subtitle="Self-hosted live captions for meetings — platform gate, whisper engine, live rooms."
      onClose={onClose}
      sections={sections}
      auditLogView={<AuditLogTimeline endpoint="/api/admin/meet-captions/audit-feed" />}
    />
  );
}
