"use client";
// App access — who sees which mode in the TGV desktop app, and which RCS folders Backend may open
// (plan tgv-desktop-app.md P3). Superadmin: every village + village owners and their root ceilings.
// Village owner: their own village's staff levels. API: /api/app-access. Every change is audited.
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { GlassCard, GlowButton, Input, Label, PillButton, SubtleButton, TextArea } from "@/app/styled";
import { askConfirm, showNotice } from "@/app/components/dialogService";

type Level = {
  id?: string; name: string; modes: string[]; backend_roots: string[];
  backend_writable: boolean; backend_terminal: boolean; backend_git: boolean;
};
type Assignment = { member_id: string; level_id: string; email: string; name: string | null };
type Owner = { member_id: string; email: string; name: string | null; backend_roots: string[] };
type Data = { village: string; levels: Level[]; members: Assignment[]; owners: Owner[]; ceiling: string[]; modes: string[]; superadmin: boolean };

const Page = styled.div`padding: 24px; display: grid; gap: 18px; max-width: 1100px;`;
const Row = styled.div`display: flex; gap: 8px; align-items: center; flex-wrap: wrap;`;
const Grid = styled.div`display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));`;
const H = styled.h2`margin: 0; font-size: 18px;`;
const Small = styled.p`margin: 4px 0 0; font-size: 12px; opacity: 0.6;`;
const Check = styled.label`display: inline-flex; gap: 6px; align-items: center; font-size: 13px; cursor: pointer;`;
const Table = styled.table`width: 100%; border-collapse: collapse; font-size: 13px; td { padding: 6px 4px; border-top: 1px solid rgba(127,127,127,0.15); }`;

async function api(body?: Record<string, unknown>, village = "hq") {
  const res = body
    ? await fetch("/api/app-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ village, ...body }) })
    : await fetch(`/api/app-access?village=${encodeURIComponent(village)}`, { cache: "no-store" });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error ?? "failed");
  return j;
}

const blank = (): Level => ({ name: "", modes: ["village"], backend_roots: [], backend_writable: false, backend_terminal: false, backend_git: false });

function LevelCard({ level, modes, ceiling, onSaved, village }: { level: Level; modes: string[]; ceiling: string[]; onSaved: () => void; village: string }) {
  const [l, setL] = useState<Level>(level);
  const [roots, setRoots] = useState(level.backend_roots.join("\n"));
  const set = (patch: Partial<Level>) => setL((x) => ({ ...x, ...patch }));
  const save = async () => {
    try {
      await api({ action: "level.save", level: { ...l, backend_roots: roots.split("\n").map((s) => s.trim()).filter(Boolean) } }, village);
      onSaved();
    } catch (e) {
      showNotice({ title: "Couldn’t save", message: String((e as Error).message) });
    }
  };
  const del = async () => {
    if (!l.id || !(await askConfirm({ title: `Delete “${l.name}”?`, message: "Staff on this level lose its access.", confirmLabel: "Delete" }))) return;
    await api({ action: "level.delete", id: l.id }, village).catch(() => {});
    onSaved();
  };
  return (
    <GlassCard style={{ padding: 16, display: "grid", gap: 10 }}>
      <Input value={l.name} placeholder="Level name (e.g. Developer)" onChange={(e) => set({ name: e.target.value })} />
      <Row>
        {modes.map((m) => (
          <PillButton key={m} $active={l.modes.includes(m)} type="button"
            onClick={() => set({ modes: l.modes.includes(m) ? l.modes.filter((x) => x !== m) : [...l.modes, m] })}>
            {m}
          </PillButton>
        ))}
      </Row>
      {l.modes.includes("backend") && (
        <>
          <Label>Backend folders (one per line)</Label>
          <TextArea rows={3} value={roots} onChange={(e) => setRoots(e.target.value)} placeholder={ceiling[0] ?? "/srv/workshop"} />
          <Small>Allowed inside: {ceiling.join(", ") || "nothing yet — ask HQ"}</Small>
          <Row>
            <Check><input type="checkbox" checked={l.backend_writable} onChange={(e) => set({ backend_writable: e.target.checked })} /> Can edit</Check>
            <Check><input type="checkbox" checked={l.backend_terminal} onChange={(e) => set({ backend_terminal: e.target.checked })} /> Terminal</Check>
            <Check><input type="checkbox" checked={l.backend_git} onChange={(e) => set({ backend_git: e.target.checked })} /> Git commit</Check>
          </Row>
        </>
      )}
      <Row>
        <GlowButton type="button" onClick={save}>Save</GlowButton>
        {l.id && <SubtleButton type="button" onClick={del}>Delete</SubtleButton>}
      </Row>
    </GlassCard>
  );
}

export default function AppAccessPage() {
  const [village, setVillage] = useState("hq");
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerRoots, setOwnerRoots] = useState("");

  const load = useCallback(async () => {
    try {
      setErr("");
      setData(await api(undefined, village));
      setAdding(false);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [village]);
  useEffect(() => { load(); }, [load]);

  const assign = async (mail: string, levelId: string | null) => {
    try {
      await api({ action: "assign", email: mail, levelId }, village);
      setEmail("");
      load();
    } catch (e) {
      showNotice({ title: "Couldn’t assign", message: (e as Error).message });
    }
  };

  return (
    <Page>
      <div>
        <H>App access</H>
        <Small>Which modes each staff level sees in the TGV app, and the RCS folders Backend may open.</Small>
      </div>
      {data?.superadmin && (
        <Row>
          <Label>Village</Label>
          <Input style={{ width: 160 }} value={village} onChange={(e) => setVillage(e.target.value.toLowerCase())} />
        </Row>
      )}
      {err && <Small style={{ color: "#ef4444", opacity: 1 }}>{err}</Small>}
      {data && (
        <>
          <Row><H style={{ fontSize: 15 }}>Staff levels</H><SubtleButton type="button" onClick={() => setAdding(true)}>+ New level</SubtleButton></Row>
          <Grid>
            {data.levels.map((l) => <LevelCard key={l.id} level={l} modes={data.modes} ceiling={data.ceiling} onSaved={load} village={village} />)}
            {adding && <LevelCard level={blank()} modes={data.modes} ceiling={data.ceiling} onSaved={load} village={village} />}
          </Grid>

          <H style={{ fontSize: 15 }}>Staff</H>
          <GlassCard style={{ padding: 16 }}>
            <Table><tbody>
              {data.members.map((m) => (
                <tr key={m.member_id}>
                  <td>{m.name ?? ""} <span style={{ opacity: 0.6 }}>{m.email}</span></td>
                  <td style={{ width: 220 }}>
                    <select value={m.level_id} onChange={(e) => assign(m.email, e.target.value || null)}>
                      {data.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      <option value="">— remove —</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody></Table>
            <Row style={{ marginTop: 10 }}>
              <Input style={{ flex: 1 }} placeholder="member@email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select id="lvl" defaultValue="">
                <option value="" disabled>Level…</option>
                {data.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <GlowButton type="button" onClick={() => {
                const v = (document.getElementById("lvl") as HTMLSelectElement).value;
                if (email && v) assign(email, v);
              }}>Add</GlowButton>
            </Row>
          </GlassCard>

          {data.superadmin && (
            <>
              <H style={{ fontSize: 15 }}>Village owners</H>
              <GlassCard style={{ padding: 16, display: "grid", gap: 8 }}>
                <Small>An owner runs this village’s Office and its staff levels. Their folders are the ceiling for every level here.</Small>
                {data.owners.map((o) => (
                  <Row key={o.member_id}>
                    <span style={{ flex: 1 }}>{o.name ?? ""} <span style={{ opacity: 0.6 }}>{o.email}</span> — {o.backend_roots.join(", ") || "no folders"}</span>
                    <SubtleButton type="button" onClick={async () => { await api({ action: "owner.save", email: o.email, remove: true }, village).catch(() => {}); load(); }}>Remove</SubtleButton>
                  </Row>
                ))}
                <Row>
                  <Input style={{ flex: 1 }} placeholder="owner@email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
                  <Input style={{ flex: 2 }} placeholder="folders, comma-separated" value={ownerRoots} onChange={(e) => setOwnerRoots(e.target.value)} />
                  <GlowButton type="button" onClick={async () => {
                    try {
                      await api({ action: "owner.save", email: ownerEmail, backend_roots: ownerRoots.split(",").map((s) => s.trim()).filter(Boolean) }, village);
                      setOwnerEmail(""); setOwnerRoots(""); load();
                    } catch (e) { showNotice({ title: "Couldn’t save", message: (e as Error).message }); }
                  }}>Save owner</GlowButton>
                </Row>
              </GlassCard>
            </>
          )}
        </>
      )}
    </Page>
  );
}
