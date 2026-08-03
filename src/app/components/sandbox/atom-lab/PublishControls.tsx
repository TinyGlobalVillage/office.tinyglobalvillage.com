"use client";
/**
 * Publish — the button that takes an atom out of the lab.
 *
 * Saving is already automatic and already private: a spec edited here is a
 * DRAFT in Office's data/atom-lab/. Publishing writes it to tgv_db, and the
 * next page any tenant renders picks it up — no build, no deploy, three sites
 * at once. So the control has to make three things obvious at a glance:
 * whether this atom is published at all, whether what you are looking at is
 * ahead of what the world sees, and how to put the last version back.
 *
 * The revert is why every publish is kept as a numbered release. It is one
 * click and it never rebuilds anything, because reverting only moves a pointer.
 *
 * Admin-only, like the route behind it. A non-admin sees nothing here rather
 * than a button that will fail.
 */
import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../../theme";
import Tooltip from "../../ui/Tooltip";
import { type AtomSpec } from "./atomSpec";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;

type Release = {
  key: string;
  version: number;
  note: string | null;
  author: string | null;
  createdAt: string;
  live: boolean;
  spec: AtomSpec;
};

/** unavailable = no table / no database. The lab still works; publishing doesn't. */
type Status = "loading" | "ready" | "hidden" | "unavailable";

const Wrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const PublishBtn = styled.button<{ $ahead: boolean }>`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 4px 9px;
  border-radius: 999px;
  white-space: nowrap;
  cursor: pointer;
  color: ${({ $ahead }) => ($ahead ? "#03121a" : PINK)};
  background: ${({ $ahead }) => ($ahead ? PINK : `rgba(${PINK_RGB}, 0.08)`)};
  border: 1px solid rgba(${PINK_RGB}, ${({ $ahead }) => ($ahead ? 0.9 : 0.35)});
  &:hover:not(:disabled) {
    background: ${({ $ahead }) => ($ahead ? PINK : `rgba(${PINK_RGB}, 0.16)`)};
  }
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const LiveChip = styled.button`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 999px;
  white-space: nowrap;
  cursor: pointer;
  color: rgba(${PINK_RGB}, 0.85);
  background: transparent;
  border: 1px dashed rgba(${PINK_RGB}, 0.35);
`;

const Sheet = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 40;
  width: 260px;
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 10px;
  background: #0b0d13;
  border: 1px solid rgba(${PINK_RGB}, 0.35);
  box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.8);
`;

const Row = styled.div<{ $live: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 7px;
  border-radius: 7px;
  font-size: 11px;
  color: ${({ $live }) => ($live ? PINK : "rgba(220, 225, 240, 0.75)")};
  background: ${({ $live }) => ($live ? `rgba(${PINK_RGB}, 0.1)` : "transparent")};
  &:hover {
    background: rgba(${PINK_RGB}, 0.07);
  }
`;

const Meta = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  opacity: 0.7;
`;

const MiniBtn = styled.button`
  flex: none;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: 999px;
  cursor: pointer;
  color: ${PINK};
  background: rgba(${PINK_RGB}, 0.1);
  border: 1px solid rgba(${PINK_RGB}, 0.3);
  &:hover {
    background: rgba(${PINK_RGB}, 0.2);
  }
`;

const Empty = styled.div`
  padding: 10px 8px;
  font-size: 11px;
  opacity: 0.6;
`;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The releases for one atom, or why there are none to show. */
async function fetchReleases(key: string): Promise<{ status: Status; releases: Release[] }> {
  try {
    const res = await fetch(`/api/atom-lab/releases?key=${encodeURIComponent(key)}`);
    if (res.status === 401 || res.status === 403) return { status: "hidden", releases: [] };
    if (!res.ok) return { status: "unavailable", releases: [] };
    const data = (await res.json()) as { releases?: Release[] };
    return { status: "ready", releases: data.releases ?? [] };
  } catch {
    return { status: "unavailable", releases: [] };
  }
}

export default function PublishControls({ atomKey, spec }: { atomKey: string; spec: AtomSpec }) {
  const [status, setStatus] = useState<Status>("loading");
  const [releases, setReleases] = useState<Release[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloads, setReloads] = useState(0);

  // Switching atoms resets the panel DURING RENDER rather than in an effect, so
  // the new atom never renders for a frame wearing the old one's release list.
  const [shownKey, setShownKey] = useState(atomKey);
  if (shownKey !== atomKey) {
    setShownKey(atomKey);
    setStatus("loading");
    setReleases([]);
    setOpen(false);
  }

  /**
   * `alive` is why the panel can be trusted. Switching atoms fires a second
   * request before the first has answered, and the first answer lands last
   * often enough to matter: without this the panel showed "unpublished" for an
   * atom that had releases, which is the one lie this control must not tell.
   */
  useEffect(() => {
    let alive = true;
    void fetchReleases(atomKey).then((next) => {
      if (!alive) return;
      setStatus(next.status);
      setReleases(next.releases);
    });
    return () => {
      alive = false;
    };
  }, [atomKey, reloads]);

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        await fetch("/api/atom-lab/releases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: atomKey, ...body }),
        });
        setReloads((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [atomKey],
  );

  if (status === "hidden") return null;

  const live = releases.find((r) => r.live) ?? null;
  // What the world sees vs what is on screen. Nothing to publish when they match.
  const ahead = !live || !same(live.spec, spec);

  return (
    <Wrap>
      <Tooltip
        label={
          status === "unavailable"
            ? "Publishing is unavailable — apply sql/atom-specs.sql"
            : ahead
              ? "Ship this spec to every site — no deploy"
              : "Live everywhere, and unchanged"
        }
        accent={PINK}
      >
        <PublishBtn
          $ahead={ahead && status === "ready"}
          disabled={busy || status !== "ready" || !ahead}
          onClick={() => void act({ action: "publish", spec })}
        >
          {busy ? "…" : "Publish"}
        </PublishBtn>
      </Tooltip>

      <Tooltip label="Releases — revert to any of them" accent={PINK}>
        <LiveChip onClick={() => setOpen((o) => !o)}>
          {status !== "ready" ? "—" : live ? `live v${live.version}` : "unpublished"}
        </LiveChip>
      </Tooltip>

      {open && (
        <Sheet>
          {releases.length === 0 ? (
            <Empty>
              Never published. This atom renders the spec baked into the code on every site.
            </Empty>
          ) : (
            <>
              {releases.map((r) => (
                <Row key={r.version} $live={r.live}>
                  <strong>v{r.version}</strong>
                  <Meta>
                    {new Date(r.createdAt).toLocaleDateString()}
                    {r.author ? ` · ${r.author}` : ""}
                    {r.note ? ` · ${r.note}` : ""}
                  </Meta>
                  {r.live ? (
                    <MiniBtn disabled={busy} onClick={() => void act({ action: "unpublish" })}>
                      Unpublish
                    </MiniBtn>
                  ) : (
                    <MiniBtn
                      disabled={busy}
                      onClick={() => void act({ action: "revert", version: r.version })}
                    >
                      Revert
                    </MiniBtn>
                  )}
                </Row>
              ))}
            </>
          )}
        </Sheet>
      )}
    </Wrap>
  );
}
