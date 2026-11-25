"use client";
// Wishlist orders — TGV's buying queue for wishlist "Add to cart" purchases. One card per paid order: what
// to buy and where, who it's for, and its step (New → Ordered → Shipped → Done) with tracking and a note.
// The ship-to address opens on tgv.com (it's sealed with tgv.com's key). Data: /api/admin/wishlist-orders.
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors } from "../../theme";
import PillBar from "@tgv/module-component-library/components/ui/PillBar";
import { Body, Card, CardHead, Dim, Err, Pill, Stat, StatL, StatN, Stats, TenantName, fmtWhen } from "../../components/villagers/_suite/SuiteControlKit";

type Status = "new" | "ordered" | "shipped" | "done";
type Order = {
  id: string; status: Status; quantity: number; amountCents: number; feeCents: number; currency: string; test: boolean;
  tracking: string; staffNote: string; purchasedAt: string | null;
  buyer: { name: string; email: string; note: string };
  item: { name: string; sourceUrl: string | null; store: string; imageUrl: string | null };
  list: { title: string; url: string };
  owner: { name: string; email: string };
  addressUrl: string;
};
type Data = { orders: Order[]; totals: Record<Status, number> };

const STEPS: { key: Status; label: string }[] = [
  { key: "new", label: "New" },
  { key: "ordered", label: "Ordered" },
  { key: "shipped", label: "Shipped" },
  { key: "done", label: "Done" },
];

const Wrap = styled.div`
  max-width: 62rem;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
`;
const Title = styled.h1`
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  color: ${colors.gold};
`;
const Link = styled.a`
  color: ${colors.cyan};
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;
const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.5rem;
`;
const Input = styled.input`
  font: inherit;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  border: 1px solid ${colors.border};
  background: transparent;
  color: inherit;
`;
const Save = styled.button`
  font: inherit;
  font-weight: 700;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1px solid ${colors.cyan};
  background: transparent;
  color: ${colors.cyan};
  cursor: pointer;
  justify-self: start;
  &:disabled { opacity: 0.5; cursor: default; }
`;

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export default function WishlistOrdersClient() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<Status | "open">("open");
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/wishlist-orders", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.detail || json?.error || "Couldn't load orders");
      setData(json);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = data ? data.orders.filter((o) => (filter === "open" ? o.status !== "done" : o.status === filter)) : [];
  return (
    <Wrap>
      <Title>Wishlist orders</Title>
      <Dim>Visitors paid TGV to buy these for someone's wishlist. Order each one from its store and ship it to the list's owner.</Dim>
      <Body style={{ marginTop: "1rem" }}>
        {err ? <Err>{err}</Err> : null}
        {!data && !err ? <Dim>Loading…</Dim> : null}
        {data ? (
          <>
            <Stats>
              {STEPS.map((s) => <Stat key={s.key}><StatN>{data.totals[s.key]}</StatN><StatL>{s.label.toLowerCase()}</StatL></Stat>)}
            </Stats>
            <PillBar
              ariaLabel="Orders"
              active={filter}
              onChange={(k) => setFilter(k as Status | "open")}
              segments={[{ key: "open", label: "Open", count: data.orders.filter((o) => o.status !== "done").length }, ...STEPS.map((s) => ({ key: s.key, label: s.label, count: data.totals[s.key] }))]}
            />
            {!shown.length ? <Dim>Nothing here.</Dim> : shown.map((o) => <OrderCard key={o.id} order={o} onSaved={load} onError={setErr} />)}
          </>
        ) : null}
      </Body>
    </Wrap>
  );
}

function OrderCard({ order: o, onSaved, onError }: { order: Order; onSaved: () => void; onError: (m: string) => void }) {
  const [status, setStatus] = useState<Status>(o.status);
  const [tracking, setTracking] = useState(o.tracking);
  const [note, setNote] = useState(o.staffNote);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/wishlist-orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: o.id, status, tracking, note }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "That didn't save");
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHead>
        <TenantName>{o.quantity > 1 ? `${o.quantity} × ` : ""}{o.item.name}</TenantName>
        <Pill $on={o.status !== "done"}>{STEPS.find((s) => s.key === o.status)?.label}{o.test ? " · test" : ""}</Pill>
      </CardHead>
      <Dim>
        Paid {money(o.amountCents, o.currency)} + {money(o.feeCents, o.currency)} handling{o.purchasedAt ? ` · ${fmtWhen(o.purchasedAt)}` : ""}
        {o.item.sourceUrl ? <> · <Link href={o.item.sourceUrl} target="_blank" rel="noreferrer nofollow">Buy on {o.item.store || "the store"}</Link></> : null}
      </Dim>
      <Dim>
        For {o.owner.name || "—"} ({o.owner.email}) · <Link href={o.list.url} target="_blank" rel="noreferrer">{o.list.title}</Link> ·{" "}
        <Link href={o.addressUrl} target="_blank" rel="noreferrer">Ship-to address</Link>
      </Dim>
      <Dim>From {o.buyer.name || "—"} ({o.buyer.email}){o.buyer.note ? ` — “${o.buyer.note}”` : ""}</Dim>
      <PillBar ariaLabel="Order step" kind="choice" active={status} onChange={(k) => setStatus(k as Status)} segments={STEPS} />
      <Fields>
        <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number" aria-label="Tracking number" />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Staff note" aria-label="Staff note" />
      </Fields>
      <Save type="button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Save>
    </Card>
  );
}
