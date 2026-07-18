"use client";

// ModulesClient — the tile family for PLATFORM module surfaces. Rendered by
// modules/page.tsx (admin-gated server-side; this client never loads for a non-admin).
//
// First child: Module-Dashboard — pops the tgv.com Harness Studio in a NEW TAB (not an
// iframe: the tgv.com editor surfaces refuse cross-origin framing and their session
// cookie isn't sent third-party — same lesson as the Villagers Page Editor tile). The
// shared .tinyglobalvillage.com member session carries the operator in; the studio's
// own superadmin gate is the final wall. Lang/base live behind the tile gear
// (ModuleDashboardConfigModal, localStorage tgv-module-dashboard-cfg).
//
// Future siblings (Module-Storefront, Module-Course, …) slot in as more tiles here.

import { useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import TopNav from "../../components/TopNav";
import { ModulesIcon, EditorIcon, SettingsIcon } from "../../components/icons";
import ModuleDashboardConfigModal from "../../components/modules/ModuleDashboardConfigModal";
import { EmailCampaignsPanel } from "@tgv/module-email-campaigns";

/* ── Styled (Villagers tile canon, violet accent) ─────────────────── */

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 0 0.25rem 4rem;
  max-width: 80rem;
  margin: 0 auto;
  width: 100%;

  @media (min-width: 768px) {
    padding: 0 1rem 4rem;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.25rem 0 1rem;
`;

const TitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: ${colors.violet};
  text-shadow: 0 0 10px rgba(${rgb.violet}, 0.4);

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const PageSubtitle = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  color: var(--t-textFaint);
  line-height: 1.45;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.75rem;
`;

const Tile = styled.button`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  background: rgba(${rgb.violet}, 0.04);
  border: 1px solid rgba(${rgb.violet}, 0.3);
  border-radius: 0.625rem;
  color: var(--t-text);
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.violet}, 0.1);
    border-color: rgba(${rgb.violet}, 0.55);
    box-shadow: 0 0 18px rgba(${rgb.violet}, 0.15);
  }
`;

const TileTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: ${colors.violet};
  letter-spacing: 0.04em;
`;

const TileSub = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  line-height: 1.45;
`;

const TileWrap = styled.div`
  position: relative;
  display: grid;
`;

const TileGear = styled.button`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1;
  background: rgba(${rgb.violet}, 0.08);
  border: 1px solid rgba(${rgb.violet}, 0.35);
  color: ${colors.violet};
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    border-color: rgba(${rgb.violet}, 0.7);
    box-shadow: 0 0 8px rgba(${rgb.violet}, 0.25);
  }
`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border-radius: 0.5rem;
  cursor: pointer;
  background: rgba(${rgb.violet}, 0.08);
  border: 1px solid rgba(${rgb.violet}, 0.35);
  color: ${colors.violet};
  font-size: 0.8rem;
  font-weight: 700;
  transition: all 0.15s;

  &:hover {
    background: rgba(${rgb.violet}, 0.16);
    border-color: rgba(${rgb.violet}, 0.6);
  }
`;

/* ── Page ──────────────────────────────────────────────────────── */

export default function ModulesClient() {
  const [openMdConfig, setOpenMdConfig] = useState(false);
  const [view, setView] = useState<"grid" | "email">("grid");

  // Open the Module-Dashboard Harness Studio in a NEW TAB. Deliberately NOT
  // "noopener" so the studio's Close button can window.close() the tab (the
  // Page Editor / Template Studio contract).
  const launchModuleDashboardStudio = () => {
    const fallbackBase =
      process.env.NEXT_PUBLIC_TGV_URL ?? "https://tinyglobalvillage.com";
    let cfg = { lang: "en", base: fallbackBase };
    try {
      const raw = localStorage.getItem("tgv-module-dashboard-cfg");
      if (raw) {
        const c = JSON.parse(raw);
        cfg = {
          lang: typeof c.lang === "string" && c.lang ? c.lang : cfg.lang,
          base: typeof c.base === "string" && c.base ? c.base : cfg.base,
        };
      }
    } catch {
      /* ignore malformed cfg */
    }
    const url = `${cfg.base}/${encodeURIComponent(cfg.lang)}/editor/module-dashboard?popout=1`;
    window.open(url, "_blank");
  };

  // Email Campaigns opens INLINE (system-scoped editor) — same panel the member
  // Support tab mounts tenant-scoped. Keeps everything inside the Modules surface
  // instead of a separate top-level tile.
  if (view === "email") {
    return (
      <>
        <TopNav />
        <PageMain>
          <HeaderRow>
            <BackBtn type="button" onClick={() => setView("grid")}>← Modules</BackBtn>
            <TitleWrap>
              <span style={{ fontSize: 22 }} aria-hidden>✉️</span>
              <PageTitle>Email Campaigns</PageTitle>
            </TitleWrap>
          </HeaderRow>
          <PageSubtitle style={{ marginBottom: "1.25rem" }}>
            The TGV-wide outbound-email templates — pick a category, edit the branded email,
            preview it live, and send yourself a test. Members edit their own site&apos;s copies
            from their dashboard Support tab.
          </PageSubtitle>
          <EmailCampaignsPanel apiBase="/api/email-campaigns" scopeLabel="System" />
        </PageMain>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <PageMain>
        <HeaderRow>
          <TitleWrap>
            <ModulesIcon size={26} style={{ color: colors.violet }} />
            <PageTitle>Modules</PageTitle>
          </TitleWrap>
        </HeaderRow>
        <PageSubtitle style={{ marginBottom: "1.25rem" }}>
          Platform module surfaces — what ships from here is absorbed by every member
          dashboard, no code deploy. More modules slot in as they come online.
        </PageSubtitle>

        <Grid>
          <TileWrap>
            <Tile type="button" onClick={launchModuleDashboardStudio}>
              <TileTop><EditorIcon size={18} /> Module-Dashboard</TileTop>
              <TileSub>
                Harness Studio — style the dashboard&apos;s bare bones (colors, fonts,
                sizing, spacing, navbar) on a blank harness and publish it to every
                dashboard. Opens on the Village in a new tab; config behind the gear.
              </TileSub>
            </Tile>
            <TileGear
              type="button"
              onClick={() => setOpenMdConfig(true)}
              title="Module-Dashboard settings"
              aria-label="Module-Dashboard settings"
            >
              <SettingsIcon size={14} />
            </TileGear>
          </TileWrap>

          <TileWrap>
            <Tile type="button" onClick={() => setView("email")}>
              <TileTop><span style={{ fontSize: 18 }} aria-hidden>✉️</span> Email Campaigns</TileTop>
              <TileSub>
                Branded outbound-email templates — edit the system-wide copies every member
                site inherits (welcome, receipts, domain reminders…). Preview live and send
                yourself a test.
              </TileSub>
            </Tile>
          </TileWrap>
        </Grid>
      </PageMain>

      {openMdConfig && <ModuleDashboardConfigModal onClose={() => setOpenMdConfig(false)} />}
    </>
  );
}
