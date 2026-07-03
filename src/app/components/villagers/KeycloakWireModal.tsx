"use client";

// KeycloakWireModal — E18: wire a tenant app to Keycloak as an OIDC
// relying-party, from the Villagers surface.
//
// The operator-shaped version of Group D's manual per-site kcadm steps:
// pick a deployed app (any clients/<domain>/ with a .env.local), and one
// click creates the confidential realm client (slashed + unslashed callback
// forms), mints the secret, and file-drops KC_ISSUER / KC_CLIENT_ID /
// KC_CLIENT_SECRET into that app's .env.local — the secret never reaches
// this browser. Flipping AUTH_IDP=keycloak (the D9 cutover flag) is a
// separate, default-OFF option so wiring stays reversible prep, not a
// cutover. Everything lands in the Keycloak HCM's activity timeline.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";
import { askConfirm } from "../dialogService";

const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;

const Stack = styled.div`
  display: flex; flex-direction: column; gap: 0.75rem;
`;

const Row = styled.div`
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
`;

const CandidateRow = styled.div`
  display: flex; flex-direction: column; gap: 0.45rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: rgba(0,0,0,0.18);
`;

const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.78rem;
  color: var(--t-text);
`;

const Pill = styled.span<{ $tone: "ok" | "warn" | "muted" }>`
  display: inline-flex; align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.5)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.5)` :
    "var(--t-border)"};
  color: ${p =>
    p.$tone === "ok" ? colors.cyan :
    p.$tone === "warn" ? colors.pink :
    "var(--t-textFaint)"};
  background: ${p =>
    p.$tone === "ok" ? `rgba(${rgb.cyan}, 0.08)` :
    p.$tone === "warn" ? `rgba(${rgb.pink}, 0.08)` :
    "transparent"};
`;

const WireBtn = styled.button`
  padding: 0.3rem 0.6rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 0.375rem;
  background: rgba(${rgb.gold}, 0.12);
  color: ${colors.gold};
  border: 1px solid rgba(${rgb.gold}, 0.5);
  &:hover:not(:disabled) { background: rgba(${rgb.gold}, 0.22); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ToggleBtn = styled.button<{ $on: boolean }>`
  padding: 0.25rem 0.55rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  border-radius: 999px;
  background: ${p => (p.$on ? `rgba(${rgb.cyan}, 0.12)` : "transparent")};
  color: ${p => (p.$on ? colors.cyan : "var(--t-textFaint)")};
  border: 1px solid ${p => (p.$on ? `rgba(${rgb.cyan}, 0.5)` : "var(--t-border)")};
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  line-height: 1.55;
`;

const ErrorText = styled.div`
  font-size: 0.6875rem; color: ${colors.pink};
  font-family: var(--font-geist-mono), monospace;
`;

const ResultBox = styled.div`
  padding: 0.5rem 0.6rem;
  border: 1px solid rgba(${rgb.cyan}, 0.35);
  border-radius: 0.4rem;
  background: rgba(${rgb.cyan}, 0.05);
  font-size: 0.6875rem;
  line-height: 1.6;
  color: var(--t-text);
  font-family: var(--font-geist-mono), monospace;
  white-space: pre-wrap;
`;

type Candidate = {
  domain: string;
  authIdp: string | null;
  envHasKcClient: boolean;
  kcClientExists: boolean;
  redirectUris: string[];
};

export default function KeycloakWireModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [includeLoginRedirect, setIncludeLoginRedirect] = useState(true);
  const [setAuthIdp, setSetAuthIdp] = useState(false);
  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hardening/keycloak/wire-client", {
        credentials: "same-origin", cache: "no-store",
      });
      if (!res.ok) {
        setError(`Candidate scan failed (HTTP ${res.status})`);
        return;
      }
      setError(null);
      setCandidates(((await res.json()).candidates ?? []) as Candidate[]);
    } catch {
      setError("Candidate scan failed (network)");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const wire = useCallback(async (c: Candidate) => {
    const confirmed = await askConfirm({
      title: `Wire ${c.domain} to Keycloak?`,
      message: c.kcClientExists
        ? "Reuses the existing realm client and file-drops any missing KC_* keys into the app's .env.local (existing keys untouched)."
        : `Creates realm client ${c.domain} and file-drops KC_* into the app's .env.local (existing keys untouched).`,
      detail: setAuthIdp
        ? "AUTH_IDP WILL be flipped to keycloak — the app cuts over on its next pm2 reload."
        : "AUTH_IDP stays as-is; cutover remains a separate step.",
      confirmLabel: "Wire",
    });
    if (!confirmed) return;
    setBusyDomain(c.domain);
    try {
      const res = await fetch("/api/hardening/keycloak/wire-client", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: c.domain, includeLoginRedirect, setAuthIdp }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResults(prev => ({ ...prev, [c.domain]: `FAILED: ${body.error ?? `HTTP ${res.status}`}` }));
      } else {
        const lines = [
          body.createdClient ? "realm client CREATED" : "realm client reused",
          body.wroteEnv?.length ? `env written: ${body.wroteEnv.join(", ")}` : "env: nothing to write",
          body.skippedEnv?.length ? `env skipped (already set): ${body.skippedEnv.join(", ")}` : null,
          body.authIdpSet ? "AUTH_IDP=keycloak SET" : null,
          ...(body.nextSteps ?? []).map((s: string) => `next: ${s}`),
        ].filter(Boolean);
        setResults(prev => ({ ...prev, [c.domain]: lines.join("\n") }));
        load();
      }
    } catch {
      setResults(prev => ({ ...prev, [c.domain]: "FAILED: network error" }));
    } finally {
      setBusyDomain(null);
    }
  }, [includeLoginRedirect, setAuthIdp, load]);

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="52rem" onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Wire Client to Keycloak</ModalTitle>
              <Sub>
                Provision a deployed tenant app as an OIDC relying-party — client, secret
                file-drop, redirect URIs. The secret never leaves the server.
              </Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            <Row>
              <ToggleBtn
                type="button"
                $on={includeLoginRedirect}
                onClick={() => setIncludeLoginRedirect(v => !v)}
              >
                register /login return URIs: {includeLoginRedirect ? "on" : "off"}
              </ToggleBtn>
              <ToggleBtn
                type="button"
                $on={setAuthIdp}
                onClick={() => setSetAuthIdp(v => !v)}
              >
                flip AUTH_IDP=keycloak now: {setAuthIdp ? "on" : "off"}
              </ToggleBtn>
            </Row>
            <Note>
              Wiring is reversible prep: the app keeps its current login until AUTH_IDP flips
              (and needs a `pm2 reload &lt;app&gt; --update-env` either way). /login return URIs let
              enrollment emails land back on the tenant&apos;s own login page later.
            </Note>
            {error && <ErrorText>{error}</ErrorText>}
            {candidates === null && !error && <Note>Scanning clients/ + realm…</Note>}
            {candidates?.length === 0 && <Note>No deployable apps found under clients/.</Note>}
            {candidates?.map(c => {
              const fullyWired = c.kcClientExists && c.envHasKcClient;
              return (
                <CandidateRow key={c.domain}>
                  <Row>
                    <Mono>{c.domain}</Mono>
                    <Pill $tone={c.kcClientExists ? "ok" : "muted"}>
                      {c.kcClientExists ? "realm client OK" : "no realm client"}
                    </Pill>
                    <Pill $tone={c.envHasKcClient ? "ok" : "muted"}>
                      {c.envHasKcClient ? "env wired" : "env not wired"}
                    </Pill>
                    <Pill $tone={c.authIdp === "keycloak" ? "ok" : "warn"}>
                      AUTH_IDP: {c.authIdp ?? "unset"}
                    </Pill>
                    <WireBtn
                      type="button"
                      disabled={busyDomain !== null || (fullyWired && c.authIdp === "keycloak" && !setAuthIdp)}
                      onClick={() => wire(c)}
                    >
                      {busyDomain === c.domain ? "Wiring…" : fullyWired ? "Re-check / repair" : "Wire"}
                    </WireBtn>
                  </Row>
                  {results[c.domain] && <ResultBox>{results[c.domain]}</ResultBox>}
                </CandidateRow>
              );
            })}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
