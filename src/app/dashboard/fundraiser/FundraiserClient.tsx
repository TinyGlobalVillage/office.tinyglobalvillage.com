"use client";
// The Fundraiser desk — staff's view of every fundraiser on tgv.com (beta). Built on the suite kit
// the Villagers suite modals share (_suite/SuiteControlKit), so it reads like Course / Performers:
// the switch's state, the totals, then one card per fundraiser with a staff close.
// Data: /api/admin/fundraiser (requireStaff).
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import Tooltip from "../../components/ui/Tooltip";
import { Banner, Body, Card, CardHead, Dim, Err, Pill, Row, RowHelp, RowLabel, RowMain, Stat, StatL, StatN, Stats, Switch, TenantName, fmtWhen } from "../../components/villagers/_suite/SuiteControlKit";

type Fundraiser = {
  id: string; title: string; status: string; currency: string; endsAt: string | null; createdAt: string; closedByStaff: string | null;
  coordinator: { name: string; email: string };
  goalCents: number; cashCents: number; feeCents: number; inKindCents: number;
  items: number; received: number; waiting: number; onTheWay: number; url: string;
};
type Data = {
  flag: "off" | "admin" | "on";
  totals: { fundraisers: number; live: number; cashCents: number; feeCents: number; inKindCents: number; received: number; waiting: number };
  fundraisers: Fundraiser[];
  viewerRole: string;
};

const Wrap = styled.div`
  max-width: 62rem;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
`;
const Title = styled.h1`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  color: ${colors.gold};
`;
const BetaTag = styled.span`
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(${rgb.gold}, 0.6);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;
const Track = styled.div`
  height: 0.45rem;
  border-radius: 999px;
  background: rgba(${rgb.cyan}, 0.12);
  overflow: hidden;
`;
const Fill = styled.div<{ $pct: number }>`
  width: ${(p) => p.$pct}%;
  height: 100%;
  background: ${colors.green};
`;
const Link = styled.a`
  color: ${colors.cyan};
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

const FLAG_COPY: Record<Data["flag"], string> = {
  admin: "BETA — TGV's team can run fundraisers; villagers can't yet. Public fundraiser pages open for anyone with the link.",
  on: "OPEN — every villager can run fundraisers.",
  off: "OFF — fundraisers are hidden for everyone, public pages included.",
};

export default function FundraiserClient() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/fundraiser", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || json?.error || "Couldn't load fundraisers");
      setData(json);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const hold = async (f: Fundraiser, close: boolean) => {
    setSaving(f.id);
    try {
      const res = await fetch("/api/admin/fundraiser", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: f.id, close }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "That didn't save");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Wrap>
      <Title>Fundraiser <BetaTag>Beta</BetaTag></Title>
      <Dim>Every fundraiser on tgv.com: what it's raising in things and in cash. Staff only.</Dim>
      <Body style={{ marginTop: "1rem" }}>
        {err ? <Err>{err}</Err> : null}
        {!data && !err ? <Dim>Loading…</Dim> : null}
        {data ? (
          <>
            <Banner $danger={data.flag === "off"}>{FLAG_COPY[data.flag]}</Banner>
            <Dim>The switch lives in Villagers → Dashboard Config, under “fundraiser” (admins).</Dim>
            <Stats>
              <Stat><StatN>{data.totals.live}</StatN><StatL>live of {data.totals.fundraisers}</StatL></Stat>
              <Stat><StatN>{money(data.totals.cashCents)}</StatN><StatL>cash given</StatL></Stat>
              <Stat><StatN>{money(data.totals.inKindCents)}</StatN><StatL>in things received ({data.totals.received})</StatL></Stat>
              <Stat><StatN>{money(data.totals.feeCents)}</StatN><StatL>2% fees</StatL></Stat>
              <Stat><StatN>{data.totals.waiting}</StatN><StatL>offers waiting on coordinators</StatL></Stat>
            </Stats>
            {!data.fundraisers.length ? <Dim>No fundraisers yet.</Dim> : null}
            {data.fundraisers.map((f) => {
              const raised = f.cashCents + f.inKindCents;
              const pct = f.goalCents > 0 ? Math.min(100, Math.floor((raised * 100) / f.goalCents)) : 0;
              const held = !!f.closedByStaff;
              return (
                <Card key={f.id}>
                  <CardHead>
                    <TenantName>{f.title}</TenantName>
                    <Pill $on={f.status === "live"}>{held ? "Closed by staff" : f.status === "live" ? "Live" : f.status === "closed" ? "Closed" : "Draft"}</Pill>
                  </CardHead>
                  <Dim>
                    {f.coordinator.name || "—"} · {f.coordinator.email} · started {fmtWhen(f.createdAt)}
                    {f.endsAt ? ` · ends ${fmtWhen(f.endsAt)}` : ""}
                    {f.status !== "draft" ? <> · <Link href={f.url} target="_blank" rel="noreferrer">Open the public page</Link></> : null}
                  </Dim>
                  <Track role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${f.title} raised so far`}><Fill $pct={pct} /></Track>
                  <Dim>
                    {money(raised, f.currency)} of {money(f.goalCents, f.currency)} ({pct}%) — {money(f.cashCents, f.currency)} cash, {money(f.inKindCents, f.currency)} in things ·{" "}
                    {f.items} item{f.items === 1 ? "" : "s"}, {f.received} received, {f.onTheWay} on the way, {f.waiting} waiting
                  </Dim>
                  <Row>
                    <RowMain>
                      <RowLabel>Staff close</RowLabel>
                      <RowHelp>
                        {held
                          ? `Closed by ${f.closedByStaff}. The coordinator can't reopen it until this is lifted.`
                          : "Stops the fundraiser taking gifts; its coordinator can't reopen it. Use for abuse or a request."}
                      </RowHelp>
                    </RowMain>
                    <Tooltip label={held ? "Lift the staff close" : "Close this fundraiser"}>
                      <Switch type="button" $on={held} $danger disabled={saving === f.id} aria-pressed={held} aria-label={held ? "Lift the staff close" : "Close this fundraiser"} onClick={() => hold(f, !held)} />
                    </Tooltip>
                  </Row>
                </Card>
              );
            })}
          </>
        ) : null}
      </Body>
    </Wrap>
  );
}
