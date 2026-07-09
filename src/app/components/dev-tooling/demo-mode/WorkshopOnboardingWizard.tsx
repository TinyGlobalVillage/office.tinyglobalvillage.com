"use client";

// WorkshopOnboardingWizard — "Set up this Mac" for the authenticated Workshop
// (workshop-multiuser-authenticated Stage 3). Slide-by-slide modal whose real work
// happens in ONE copy-pasted terminal command (workshop-bootstrap.sh); every step
// the script completes on the laptop reports back via the onboarding API and lights
// a green check here — no other copy-paste, "automatic under the hood".
//
//   Slide 1  prereqs (approved registry row · Tailscale · Remote Login) → get command
//   Slide 2  the one-liner + LIVE per-step checklist (poll /api/workshop/onboard)
//   Slide 3  all green → start your first workshop
//
// Access is gated by data/workshop/accounts.json (approved:true rows only — Gio adds
// rows manually; locked decision). Opened from DemoModeControlModal.

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalSubtitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../../NeonX";

/* ── Types ─────────────────────────────────────────────────────── */
type StepStatus = "pending" | "run" | "ok" | "fail";
type Step = { id: string; status: StepStatus; detail?: string };
type OnboardResp = {
  ok: boolean;
  account: string;
  registered: boolean;
  approved: boolean;
  bootstrappedAt: string | null;
  webport: number | null;
  steps: Step[];
};

const STEP_LABELS: Record<string, string> = {
  "machine-check": "Machine check (node + pnpm)",
  "ssh-key": "SSH key created + sent to RCS",
  "rcs-access": "This machine can reach RCS",
  "reverse-access": "RCS can reach this machine",
  workspace: "Full @tgv workspace synced",
  install: "Dependencies installed (serialized)",
  "tunnel-test": "DB + web tunnels verified",
  done: "Workshop-ready",
};

/* ── Styled (mirrors DemoModeControlModal) ─────────────────────── */
const Stack = styled.div`display:flex;flex-direction:column;gap:1rem;`;
const Section = styled.section`
  display:flex;flex-direction:column;gap:.55rem;padding:.875rem 1rem;
  border:1px solid rgba(${rgb.cyan},.2);border-radius:.625rem;background:rgba(${rgb.cyan},.04);
`;
const SectionTitle = styled.h3`
  margin:0 0 .1rem;font-size:.6875rem;font-weight:700;text-transform:uppercase;
  letter-spacing:.12em;color:${colors.cyan};
`;
const Hint = styled.div`font-size:.78rem;color:var(--t-textFaint);line-height:1.55;`;
const Btn = styled.button<{ $tone?: "ok" | "warn" | "danger" }>`
  background:${(p) => (p.$tone === "danger" ? `rgba(${rgb.red},.12)` : p.$tone === "warn" ? `rgba(${rgb.gold},.12)` : `rgba(${rgb.cyan},.14)`)};
  border:1px solid ${(p) => (p.$tone === "danger" ? `rgba(${rgb.red},.5)` : p.$tone === "warn" ? `rgba(${rgb.gold},.5)` : `rgba(${rgb.cyan},.55)`)};
  color:${(p) => (p.$tone === "danger" ? colors.red : p.$tone === "warn" ? colors.gold : colors.cyan)};
  font-size:.74rem;font-weight:700;padding:.4rem .7rem;border-radius:.4rem;cursor:pointer;
  align-self:flex-start;
  &:disabled{opacity:.4;cursor:not-allowed;}
`;
const OneLiner = styled.code`
  display:block;padding:.6rem .75rem;border-radius:.5rem;background:rgba(0,0,0,.35);
  border:1px solid rgba(${rgb.cyan},.3);font-size:.72rem;line-height:1.5;
  word-break:break-all;user-select:all;
`;
const StepRow = styled.div<{ $s: StepStatus }>`
  display:flex;gap:.6rem;align-items:baseline;font-size:.82rem;padding:.3rem .5rem;
  border-radius:.4rem;
  color:${(p) => (p.$s === "ok" ? colors.green : p.$s === "fail" ? colors.red : p.$s === "run" ? colors.cyan : "var(--t-textFaint)")};
  background:rgba(${(p) => (p.$s === "fail" ? rgb.red : p.$s === "run" ? rgb.cyan : "0,0,0")},${(p) => (p.$s === "pending" ? "0" : ".07")});
`;
const StepDetail = styled.span`font-size:.72rem;color:var(--t-textFaint);`;
const Mark = styled.span`width:1.1rem;flex:0 0 auto;text-align:center;font-weight:700;`;

/* ── Component ─────────────────────────────────────────────────── */
export default function WorkshopOnboardingWizard({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });
  const [info, setInfo] = useState<OnboardResp | null>(null);
  const [oneliner, setOneliner] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"mac" | "pc">("mac"); // For Mac | For PC (WSL2)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/workshop/onboard", { cache: "no-store" });
      const j: OnboardResp = await r.json();
      if (j.ok) setInfo(j);
    } catch { /* transient poll misses are fine */ }
  }, []);

  useEffect(() => {
    void poll();
    timer.current = setInterval(poll, 3000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [poll]);

  const start = useCallback(async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/workshop/onboard", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "could not start onboarding");
      setOneliner(j.oneliner);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }, []);

  const steps = info?.steps ?? [];
  const allGreen = steps.length > 0 && steps.every((s) => s.status === "ok");
  const anyProgress = steps.some((s) => s.status !== "pending");
  const mark = (s: StepStatus) => (s === "ok" ? "✔" : s === "fail" ? "✖" : s === "run" ? "…" : "○");

  return (
    // stopPropagation: this wizard stacks over DemoModeControlModal's backdrop —
    // a backdrop click should close ONLY the wizard, not the modal underneath.
    <ModalBackdrop onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <ModalContainer onClick={(e) => e.stopPropagation()} style={{ maxWidth: "38rem" }}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle $color={colors.cyan}>🔑 Set up this Mac for Workshop</ModalTitle>
            <ModalSubtitle>
              authenticated live-dev · workshop-{info?.account ?? "…"}.tinyglobalvillage.com
            </ModalSubtitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {info && !info.approved && (
              <Section>
                <SectionTitle>Not approved yet</SectionTitle>
                <Hint>
                  “{info.account}” isn’t in the approved workshop registry. Ask Gio to add a row for you
                  in <code>data/workshop/accounts.json</code> (account · macHost · reserved webport), then reopen this wizard.
                </Hint>
              </Section>
            )}

            {info?.approved && (
              <>
                <Section>
                  <SectionTitle>1 · Before you start</SectionTitle>
                  <PillBar variant="flat"
                    segments={[{ key: "mac", label: "For Mac" }, { key: "pc", label: "For PC" }]}
                    active={platform}
                    onChange={(k) => setPlatform(k as "mac" | "pc")}
                    accent={rgb.cyan}
                    ariaLabel="Machine platform"
                  />
                  {platform === "mac" ? (
                    <Hint>
                      Two things this wizard can’t click for you: <b>Tailscale</b> must be running (RCS reaches
                      your laptop over the mesh), and <b>Remote Login</b> must be ON (System Settings → General →
                      Sharing). Everything else — SSH keys, workspace sync, installs, tunnels — is automatic.
                    </Hint>
                  ) : (
                    <Hint>
                      PC = Windows with <b>WSL2</b> (Ubuntu). Three prerequisites: WSL2 installed
                      (<code>wsl --install</code> in PowerShell, once), then INSIDE the Ubuntu shell:{" "}
                      <b>Tailscale</b> (<code>curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up</code>)
                      so RCS reaches the Linux side directly. The setup command below handles everything else —
                      including starting sshd — and must be pasted into the <b>Ubuntu (WSL2)</b> terminal, not PowerShell.
                    </Hint>
                  )}
                  <Btn onClick={start} disabled={busy}>
                    {busy ? "Generating…" : oneliner ? "Regenerate command (new token)" : "Generate my setup command"}
                  </Btn>
                  {err && <Hint style={{ color: colors.red }}>{err}</Hint>}
                </Section>

                {oneliner && (
                  <Section>
                    <SectionTitle>
                      2 · Paste this in {platform === "mac" ? "Terminal on the new Mac" : "the Ubuntu (WSL2) terminal on the new PC"}
                    </SectionTitle>
                    <OneLiner>{oneliner + (platform === "pc" ? " --platform pc" : "")}</OneLiner>
                    <Btn onClick={() => { void navigator.clipboard.writeText(oneliner + (platform === "pc" ? " --platform pc" : "")); }}>Copy</Btn>
                    <Hint>One-time token — regenerating invalidates the previous command.</Hint>
                  </Section>
                )}

                {(oneliner || anyProgress) && (
                  <Section>
                    <SectionTitle>3 · Live progress</SectionTitle>
                    {steps.map((s) => (
                      <StepRow key={s.id} $s={s.status}>
                        <Mark>{mark(s.status)}</Mark>
                        <span>{STEP_LABELS[s.id] ?? s.id}</span>
                        {s.detail && <StepDetail>— {s.detail}</StepDetail>}
                      </StepRow>
                    ))}
                    {steps.some((s) => s.status === "fail") && (
                      <Hint style={{ color: colors.gold }}>
                        A step failed — fix what its note says on the laptop, then re-run the same command
                        (it’s idempotent; finished steps re-verify and skip ahead).
                      </Hint>
                    )}
                  </Section>
                )}

                {(allGreen || info.bootstrappedAt) && (
                  <Section>
                    <SectionTitle>4 · Ready 🎉</SectionTitle>
                    <Hint>
                      This Mac is workshop-ready{info.webport ? ` (reserved webport ${info.webport})` : ""}. Close
                      this wizard and click <b>Start workshop</b> — your instance will live at{" "}
                      <b>workshop-{info.account}.tinyglobalvillage.com</b> with your real Office login and
                      read-only prod data.
                    </Hint>
                    <Btn $tone="ok" onClick={onClose}>Close &amp; start a workshop</Btn>
                  </Section>
                )}
              </>
            )}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
