"use client";

// HandshakeModal — Villagers → Handshake. A read-only window onto Gio's
// self-custodied HNS: coin balances, deposit addresses (with a QR for
// phone-side pasting), and the six TLDs with their renewal and transfer state.
//
// Deposit-only BY CONSTRUCTION, not by a flag: Office ships no signer and no
// key material, so there is no code path here that could move a coin even if
// somebody wanted one. The wallet lives in Bob Wallet / hsd; this is a mirror.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import ADDM from "@tgv/module-component-library/components/ui/ADDM";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
  Input,
} from "@/app/styled";
import NeonX from "../NeonX";

/* ── shapes mirroring /api/villagers/handshake ─────────────────────────── */

type AddrBalance = { address: string; doos: number; coins: number; error?: string };
type Coin = {
  symbol: string;
  name: string;
  decimals: number;
  source: "hsd" | "none";
  note?: string;
  addresses: AddrBalance[];
  total: number | null;
  qr: string | null;
};
type NameRow =
  | {
      name: string;
      state: string;
      owned: boolean;
      renewalHeight: number | null;
      expiryHeight: number | null;
      blocksUntilExpiry: number | null;
      expiresAt: string | null;
      transferHeight: number | null;
      finalizeHeight: number | null;
      finalizeReady: boolean;
      recordHex: string | null;
    }
  | { name: string; error: string };
type Payload = {
  config: { hsdUrl: string; names: string[]; coins: Array<{ symbol: string; addresses: string[] }> };
  height: number | null;
  chainError: string | null;
  coins: Coin[];
  names: NameRow[];
  readAt: string;
};

/* ── chrome ────────────────────────────────────────────────────────────── */

const Sub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  margin-top: 0.125rem;
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Notice = styled.div`
  border: 1px solid rgba(${rgb.gold}, 0.4);
  background: rgba(${rgb.gold}, 0.07);
  border-radius: 0.5rem;
  padding: 0.65rem 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--t-text);
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--t-border);
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.18);
`;

const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.72rem;
  color: var(--t-text);
  word-break: break-all;
`;

const Faint = styled.span`
  font-size: 0.7rem;
  color: var(--t-textFaint);
`;

const Spacer = styled.span`
  margin-left: auto;
`;

const Amount = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.95rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--t-text);
`;

const Pill = styled.span<{ $tone: "ok" | "warn" | "bad" | "muted" }>`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  border: 1px solid
    ${(p) =>
      p.$tone === "ok"
        ? `rgba(${rgb.cyan}, 0.5)`
        : p.$tone === "warn"
          ? `rgba(${rgb.gold}, 0.55)`
          : p.$tone === "bad"
            ? `rgba(${rgb.pink}, 0.55)`
            : "var(--t-border)"};
  color: ${(p) =>
    p.$tone === "ok"
      ? `rgba(${rgb.cyan}, 0.95)`
      : p.$tone === "warn"
        ? `rgba(${rgb.gold}, 0.95)`
        : p.$tone === "bad"
          ? `rgba(${rgb.pink}, 0.95)`
          : "var(--t-textFaint)"};
`;

const Qr = styled.img`
  width: 132px;
  height: 132px;
  border-radius: 0.5rem;
  background: #fff;
  padding: 6px;
`;

const MiniBtn = styled.button`
  appearance: none;
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.3rem 0.6rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(${rgb.cyan}, 0.4);
  background: rgba(${rgb.cyan}, 0.08);
  color: rgba(${rgb.cyan}, 0.95);
  &:hover {
    background: rgba(${rgb.cyan}, 0.16);
  }
  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

const DangerBtn = styled(MiniBtn)`
  border-color: rgba(${rgb.pink}, 0.4);
  background: rgba(${rgb.pink}, 0.07);
  color: rgba(${rgb.pink}, 0.95);
  &:hover {
    background: rgba(${rgb.pink}, 0.15);
  }
`;

const ErrorText = styled.div`
  font-size: 0.75rem;
  color: rgba(${rgb.pink}, 0.95);
`;

/* ── helpers ───────────────────────────────────────────────────────────── */

function fmtAmount(v: number | null, decimals: number): string {
  if (v === null) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** Blocks → a human span. Handshake targets a 10-minute block. */
function fmtBlocks(blocks: number): string {
  const days = (blocks * 600) / 86_400;
  if (days >= 60) return `~${Math.round(days / 30)} months`;
  if (days >= 2) return `~${Math.round(days)} days`;
  const hours = days * 24;
  if (hours >= 1) return `~${Math.round(hours)} hours`;
  return "under an hour";
}

/* ── component ─────────────────────────────────────────────────────────── */

export default function HandshakeModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose({ open: true, onClose });

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openCoins, setOpenCoins] = useState(false);
  const [openNames, setOpenNames] = useState(false);
  const [openSource, setOpenSource] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [urlDraft, setUrlDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/villagers/handshake", { cache: "no-store" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      const j = (await r.json()) as Payload;
      setData(j);
      setUrlDraft(j.config.hsdUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Every mutation is a whole-config PUT — the config is tiny and this keeps
   *  the client from having to reason about partial merges. */
  const save = useCallback(
    async (next: { hsdUrl?: string; names?: string[]; coins?: Array<{ symbol: string; addresses: string[] }> }) => {
      if (!data) return;
      setBusy(true);
      setError(null);
      try {
        const body = {
          hsdUrl: next.hsdUrl ?? data.config.hsdUrl,
          names: next.names ?? data.config.names,
          coins: (next.coins ?? data.config.coins).map((c) => {
            const live = data.coins.find((x) => x.symbol === c.symbol);
            return {
              symbol: c.symbol,
              name: live?.name ?? c.symbol,
              decimals: live?.decimals ?? 8,
              source: live?.source ?? "none",
              note: live?.note,
              addresses: c.addresses,
            };
          }),
        };
        const r = await fetch("/api/villagers/handshake", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setBusy(false);
      }
    },
    [data, load],
  );

  const addAddress = useCallback(
    (symbol: string) => {
      const value = (drafts[symbol] ?? "").trim();
      if (!value || !data) return;
      const coins = data.config.coins.map((c) =>
        c.symbol === symbol ? { ...c, addresses: [...c.addresses, value] } : c,
      );
      setDrafts((d) => ({ ...d, [symbol]: "" }));
      void save({ coins });
    },
    [drafts, data, save],
  );

  const removeAddress = useCallback(
    (symbol: string, address: string) => {
      if (!data) return;
      const coins = data.config.coins.map((c) =>
        c.symbol === symbol ? { ...c, addresses: c.addresses.filter((a) => a !== address) } : c,
      );
      void save({ coins });
    },
    [data, save],
  );

  const copy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 1400);
  }, []);

  const tip = data?.height;

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="48rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <div>
              <ModalTitle>Handshake</ModalTitle>
              <Sub>
                Your self-custodied HNS and TLDs, mirrored. Office reads the chain — it holds no
                keys and cannot spend.
                {tip ? ` Chain tip ${tip.toLocaleString()}.` : ""}
              </Sub>
            </div>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>

        <ModalBody>
          <Stack>
            <Notice>
              <strong>Deposit only.</strong> There is no signer in Office, so nothing here can move
              a coin or a name — the addresses below are for receiving. You sign every withdrawal,
              transfer, finalize and renewal in your own wallet. Your seed phrase is the asset;
              this screen is only a window onto it.
            </Notice>

            {error && <ErrorText>{error}</ErrorText>}
            {data?.chainError && (
              <ErrorText>Chain source unreachable — {data.chainError}. Addresses still shown.</ErrorText>
            )}
            {!data && !error && <Faint>Reading the chain…</Faint>}

            {data && (
              <>
                <ADDM
                  label="Coins"
                  count={data.coins.length}
                  accent="gold"
                  contained
                  open={openCoins}
                  onOpenChange={setOpenCoins}
                >
                  <Stack>
                    {data.coins.map((coin) => (
                      <div key={coin.symbol} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        <Row>
                          <strong style={{ fontSize: "0.8rem", letterSpacing: "0.06em" }}>
                            {coin.symbol}
                          </strong>
                          <Faint>{coin.name}</Faint>
                          {coin.source === "none" && <Pill $tone="muted">no chain source</Pill>}
                          <Spacer />
                          <Amount>{fmtAmount(coin.total, coin.decimals)}</Amount>
                          <Faint>{coin.symbol}</Faint>
                        </Row>

                        {coin.addresses.length === 0 && (
                          <Faint style={{ padding: "0 0.65rem" }}>
                            {coin.note ?? "No deposit address yet."}
                          </Faint>
                        )}

                        {coin.addresses.map((a) => (
                          <Row key={a.address}>
                            <Mono>{a.address}</Mono>
                            {a.error ? (
                              <Pill $tone="bad">unreadable</Pill>
                            ) : coin.source === "hsd" ? (
                              <Pill $tone="ok">{a.coins} utxo</Pill>
                            ) : null}
                            <Spacer />
                            <MiniBtn onClick={() => copy(a.address)}>
                              {copied === a.address ? "copied" : "copy"}
                            </MiniBtn>
                            <DangerBtn disabled={busy} onClick={() => removeAddress(coin.symbol, a.address)}>
                              remove
                            </DangerBtn>
                          </Row>
                        ))}

                        {coin.qr && (
                          <Row style={{ justifyContent: "center", gap: "0.9rem" }}>
                            <Qr src={coin.qr} alt={`${coin.symbol} deposit address QR`} />
                            <Faint style={{ maxWidth: "18rem" }}>
                              Scan to deposit from a phone. This encodes the first address above —
                              always compare the first and last four characters against your wallet
                              before sending.
                            </Faint>
                          </Row>
                        )}

                        <Row>
                          <Input
                            $accent="gold"
                            placeholder={`Add a ${coin.symbol} receive address…`}
                            value={drafts[coin.symbol] ?? ""}
                            onChange={(e) => setDrafts((d) => ({ ...d, [coin.symbol]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && addAddress(coin.symbol)}
                            style={{ flex: 1, minWidth: "14rem" }}
                          />
                          <MiniBtn disabled={busy} onClick={() => addAddress(coin.symbol)}>
                            add
                          </MiniBtn>
                        </Row>
                      </div>
                    ))}
                  </Stack>
                </ADDM>

                <ADDM
                  label="TLDs"
                  count={data.names.length}
                  accent="gold"
                  contained
                  open={openNames}
                  onOpenChange={setOpenNames}
                >
                  <Stack>
                    {data.names.length === 0 && <Faint>No names watched.</Faint>}
                    {data.names.map((n) => {
                      if ("error" in n) {
                        return (
                          <Row key={n.name}>
                            <Mono>{n.name}/</Mono>
                            <Spacer />
                            <Pill $tone="bad">lookup failed</Pill>
                          </Row>
                        );
                      }
                      const expiringSoon =
                        n.blocksUntilExpiry !== null && n.blocksUntilExpiry < 13_000; // ~90 days
                      return (
                        <Row key={n.name}>
                          <Mono style={{ fontSize: "0.8rem" }}>{n.name}/</Mono>
                          <Pill $tone={n.owned ? "ok" : "muted"}>{n.state}</Pill>
                          {n.recordHex && <Pill $tone="ok">records set</Pill>}
                          {n.transferHeight !== null && (
                            <Pill $tone={n.finalizeReady ? "warn" : "muted"}>
                              {n.finalizeReady ? "finalize ready" : "transfer locked"}
                            </Pill>
                          )}
                          <Spacer />
                          {n.blocksUntilExpiry !== null && (
                            <Faint>
                              renew in{" "}
                              <span style={{ color: expiringSoon ? `rgba(${rgb.gold}, 0.95)` : undefined }}>
                                {fmtBlocks(n.blocksUntilExpiry)}
                              </span>
                            </Faint>
                          )}
                        </Row>
                      );
                    })}
                    <Faint>
                      A Handshake name expires if it is not renewed within ~105,000 blocks (about two
                      years). Once these leave Namebase, that renewal is yours to sign — nobody
                      emails you about it.
                    </Faint>
                  </Stack>
                </ADDM>

                <ADDM
                  label="Chain source"
                  accent="gold"
                  contained
                  open={openSource}
                  onOpenChange={setOpenSource}
                >
                  <Stack>
                    <Faint>
                      An hsd node's HTTP API. Public by default so this screen works today; point it
                      at your own hsd later and nothing else changes.
                    </Faint>
                    <Row>
                      <Input
                        $accent="gold"
                        value={urlDraft}
                        onChange={(e) => setUrlDraft(e.target.value)}
                        style={{ flex: 1, minWidth: "16rem" }}
                      />
                      <MiniBtn disabled={busy || urlDraft === data.config.hsdUrl} onClick={() => save({ hsdUrl: urlDraft })}>
                        save
                      </MiniBtn>
                      <MiniBtn disabled={busy} onClick={() => void load()}>
                        refresh
                      </MiniBtn>
                    </Row>
                    <Faint>
                      Last read {new Date(data.readAt).toLocaleTimeString()}
                      {data.height ? ` · tip ${data.height.toLocaleString()}` : ""}
                    </Faint>
                  </Stack>
                </ADDM>
              </>
            )}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
