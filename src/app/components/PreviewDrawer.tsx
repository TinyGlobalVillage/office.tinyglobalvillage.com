"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import styled from "styled-components";
import { colors, rgb } from "../theme";
import { DrawerBackdrop, DrawerPanel, DrawerHeader, PanelIconBtn } from "../styled";

// ── Context ──────────────────────────────────────────────────────
type PreviewCtx = {
  isOpen: boolean;
  domain: string | null;
  openPreview: (domain: string) => void;
  closePreview: () => void;
  togglePreview: () => void;
};

const Ctx = createContext<PreviewCtx | null>(null);

export function usePreview() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreview must be inside PreviewProvider");
  return ctx;
}

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [domain, setDomain] = useState<string | null>(null);

  const openPreview = useCallback((d: string) => {
    setDomain(d);
    setIsOpen(true);
  }, []);

  return (
    <Ctx.Provider
      value={{
        isOpen,
        domain,
        openPreview,
        closePreview: () => setIsOpen(false),
        togglePreview: () => setIsOpen((p) => !p),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// ── Styled ───────────────────────────────────────────────────────

const Backdrop = styled(DrawerBackdrop)`
  z-index: 40;
  background: rgba(0, 0, 0, 0.5);
`;

const Panel = styled(DrawerPanel)`
  right: 0;
  z-index: 50;
  width: clamp(320px, 65vw, 1100px);
  border-left: 1px solid rgba(${rgb.pink}, 0.2);
  box-shadow: -8px 0 40px rgba(0, 0, 0, 0.7);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme="light"] & {
    border-left-color: rgba(${rgb.pink}, 0.12);
    box-shadow: -8px 0 40px rgba(0, 0, 0, 0.06);
  }
`;

const Header = styled(DrawerHeader)`
  gap: 0.75rem;
  padding: 0.75rem 1rem;
`;

const ProjectSelect = styled.select`
  flex: 1;
  font-size: 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  outline: none;
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.pink}, 0.3);
  color: var(--t-text);
  transition: border-color 0.15s;

  &:focus {
    border-color: rgba(${rgb.pink}, 0.5);
  }

  [data-theme="light"] & {
    border-color: rgba(${rgb.pink}, 0.2);
  }
`;

const UrlBar = styled.div`
  display: flex;
  align-items: center;
  padding: 0.375rem 1rem;
  flex-shrink: 0;
  font-size: 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--t-border);
  color: var(--t-textGhost);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.02);
  }
`;

const LockIcon = styled.span`
  color: ${colors.green};
`;

const IframeWrap = styled.div`
  flex: 1;
  position: relative;
  background: #000;

  [data-theme="light"] & {
    background: #f0f0f0;
  }

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--t-textGhost);
`;

const EmptyIcon = styled.span`
  font-size: 3rem;
`;

const EmptyText = styled.p`
  font-size: 0.875rem;
`;

const QuickLink = styled.button`
  font-size: 0.75rem;
  background: none;
  border: none;
  color: var(--t-textGhost);
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: ${colors.pink};
  }
`;

const LinkBtn = styled.a`
  color: var(--t-textFaint);
  font-size: 0.875rem;
  transition: color 0.15s;
  text-decoration: none;

  &:hover {
    color: ${colors.pink};
  }
`;

// ── Drawer component ─────────────────────────────────────────────
type Project = { name: string; port: string | null; url: string };

export default function PreviewDrawer() {
  const { isOpen, domain, openPreview, closePreview } = usePreview();
  const [projects, setProjects] = useState<Project[]>([]);
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const currentUrl = domain ? `https://${domain}` : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) closePreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closePreview]);

  return (
    <>
      {isOpen && <Backdrop onClick={closePreview} />}

      <Panel
        style={{
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <Header>
          <PanelIconBtn onClick={closePreview}>✕</PanelIconBtn>

          <ProjectSelect
            value={domain ?? ""}
            onChange={(e) => openPreview(e.target.value)}
            disabled={loading}
          >
            <option value="">— select project —</option>
            {projects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
                {p.port ? ` :${p.port}` : ""}
              </option>
            ))}
          </ProjectSelect>

          <PanelIconBtn onClick={() => setIframeKey((k) => k + 1)} title="Reload preview">
            ↺
          </PanelIconBtn>

          {currentUrl && (
            <LinkBtn href={currentUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab">
              ↗
            </LinkBtn>
          )}
        </Header>

        {currentUrl && (
          <UrlBar>
            <LockIcon>🔒</LockIcon>&nbsp;{currentUrl}
          </UrlBar>
        )}

        <IframeWrap>
          {currentUrl ? (
            <iframe
              key={iframeKey}
              src={currentUrl}
              title={`Preview: ${domain}`}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          ) : (
            <EmptyState>
              <EmptyIcon>🌐</EmptyIcon>
              <EmptyText>Select a project to preview</EmptyText>
              {!loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {projects.slice(0, 6).map((p) => (
                    <QuickLink key={p.name} onClick={() => openPreview(p.name)}>
                      {p.name}
                    </QuickLink>
                  ))}
                </div>
              )}
            </EmptyState>
          )}
        </IframeWrap>
      </Panel>
    </>
  );
}
