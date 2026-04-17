"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { ModalBackdrop, CloseBtn } from "../../styled";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Sections = {
  mailboxPanel: boolean;
  previewPane: boolean;
  composeToolbar: boolean;
  attachmentBar: boolean;
  ccBcc: boolean;
  threadView: boolean;
};

type Display = {
  zoom: number;
  splitMode: "vertical" | "horizontal" | "fullList";
  defaultAccount: string;
};

type Settings = {
  sections: Sections;
  display: Display;
};

type AccountOption = { key: string; label: string; email: string };

type Props = {
  accounts?: AccountOption[];
  onClose: () => void;
  onSaved: (settings: Settings) => void;
};

const SECTION_LABELS: Record<keyof Sections, string> = {
  mailboxPanel: "Mailbox panel",
  previewPane: "Preview pane",
  composeToolbar: "Compose toolbar",
  attachmentBar: "Attachment bar",
  ccBcc: "Show Cc/Bcc by default",
  threadView: "Thread view",
};

const SECTION_DESCRIPTIONS: Record<keyof Sections, string> = {
  mailboxPanel: "Show the folder/mailbox sidebar",
  previewPane: "Show email reading pane alongside list",
  composeToolbar: "Show formatting toolbar in compose window",
  attachmentBar: "Show attachment preview bar in reading pane",
  ccBcc: "Show Cc and Bcc fields by default in compose",
  threadView: "Group emails by conversation thread",
};

const ZOOM_STEPS = [0.8, 0.9, 1.0, 1.1, 1.25];
const SPLIT_MODES: { value: Display["splitMode"]; label: string }[] = [
  { value: "vertical", label: "Side by side" },
  { value: "horizontal", label: "Top/bottom" },
  { value: "fullList", label: "List only" },
];

/* ------------------------------------------------------------------ */
/*  Styled                                                             */
/* ------------------------------------------------------------------ */

const Backdrop = styled(ModalBackdrop)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Container = styled.div`
  width: 100%;
  max-width: 28rem;
  margin: 0 16px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 80vh;
  background: rgba(10, 13, 18, 0.99);
  border: 1px solid rgba(${rgb.cyan}, 0.18);
  box-shadow: 0 20px 80px rgba(0, 0, 0, 0.8);

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.99);
    border-color: var(--t-border);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const HeaderTitle = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const CloseButton = styled(CloseBtn)`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  [data-theme="light"] & {
    color: var(--t-textFaint);
    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
  }
`;

const ScrollBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 32px 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const SectionTitle = styled.h3`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.3);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const ToggleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ToggleRow = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  [data-theme="light"] & {
    &:hover {
      background: rgba(0, 0, 0, 0.03);
    }
  }
`;

const ToggleInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ToggleName = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const ToggleDesc = styled.div`
  font-size: 10px;
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.3);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const SwitchTrack = styled.div<{ $on: boolean }>`
  width: 36px;
  height: 20px;
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.4)` : "rgba(255, 255, 255, 0.1)")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.6)` : "rgba(255, 255, 255, 0.15)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.3)` : "rgba(0, 0, 0, 0.1)")};
    border-color: ${(p) => (p.$on ? `rgba(${rgb.cyan}, 0.5)` : "rgba(0, 0, 0, 0.15)")};
  }
`;

const SwitchThumb = styled.div<{ $on: boolean }>`
  position: absolute;
  top: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  transition: all 0.15s;
  left: ${(p) => (p.$on ? "calc(100% - 16px)" : "2px")};
  background: ${(p) => (p.$on ? colors.cyan : "rgba(255, 255, 255, 0.3)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$on ? colors.cyan : "rgba(0, 0, 0, 0.25)")};
  }
`;

const SubLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--t-textMuted, rgba(255, 255, 255, 0.6));
`;

const AccountList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
`;

const AccountBtn = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  text-align: left;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.12)` : "rgba(255, 255, 255, 0.04)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.35)` : "rgba(255, 255, 255, 0.08)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.08)` : "var(--t-surface)")};
    border-color: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.3)` : "var(--t-border)")};
  }
`;

const RadioDot = styled.div<{ $active: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${(p) => (p.$active ? colors.cyan : "rgba(255, 255, 255, 0.2)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? colors.cyan : "rgba(0, 0, 0, 0.15)")};
  }
`;

const AccountLabel = styled.span<{ $active: boolean }>`
  font-size: 11px;
  font-weight: 600;
  color: ${(p) => (p.$active ? colors.cyan : "rgba(255, 255, 255, 0.6)")};

  [data-theme="light"] & {
    color: ${(p) => (p.$active ? colors.cyan : "var(--t-textMuted)")};
  }
`;

const AccountEmail = styled.span`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const ChipRow = styled.div`
  display: flex;
  gap: 6px;
`;

const Chip = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 6px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.15)` : "rgba(255, 255, 255, 0.04)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.35)` : "rgba(255, 255, 255, 0.08)")};
  color: ${(p) => (p.$active ? colors.cyan : "rgba(255, 255, 255, 0.4)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.1)` : "var(--t-surface)")};
    border-color: ${(p) => (p.$active ? `rgba(${rgb.cyan}, 0.3)` : "var(--t-border)")};
    color: ${(p) => (p.$active ? colors.cyan : "var(--t-textMuted)")};
  }
`;

const ZoomChip = styled(Chip)`
  font-family: monospace;
  font-weight: 700;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.07);

  [data-theme="light"] & {
    border-top-color: var(--t-border);
  }
`;

const CancelBtn = styled.button`
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
  color: rgba(255, 255, 255, 0.4);
  background: none;
  border: none;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  [data-theme="light"] & {
    color: var(--t-textMuted);
    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }
  }
`;

const SaveBtn = styled.button<{ $saved: boolean }>`
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  transition: all 0.15s;
  cursor: pointer;
  background: ${(p) =>
    p.$saved ? `rgba(${rgb.green}, 0.15)` : `rgba(${rgb.cyan}, 0.15)`};
  border: 1px solid
    ${(p) =>
      p.$saved ? `rgba(${rgb.green}, 0.35)` : `rgba(${rgb.cyan}, 0.35)`};
  color: ${(p) => (p.$saved ? `rgba(${rgb.green}, 0.9)` : colors.cyan)};

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  [data-theme="light"] & {
    background: ${(p) =>
      p.$saved ? `rgba(${rgb.green}, 0.1)` : `rgba(${rgb.cyan}, 0.1)`};
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EmailSettings({ accounts = [], onClose, onSaved }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/email/settings")
      .then((r) => r.json())
      .then((d: Settings) => {
        if (d?.sections && d?.display) setSettings(d);
      })
      .catch(() => {});
  }, []);

  const patchSection = (key: keyof Sections, val: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, sections: { ...settings.sections, [key]: val } });
  };

  const patchDisplay = (key: keyof Display, val: Display[keyof Display]) => {
    if (!settings) return;
    setSettings({ ...settings, display: { ...settings.display, [key]: val } });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/email/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data: Settings = await res.json();
      onSaved(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <Backdrop>
      <Container>
        <Header>
          <HeaderTitle>⚙ Email Settings</HeaderTitle>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </Header>

        <ScrollBody>
          {!settings ? (
            <LoadingText>Loading settings…</LoadingText>
          ) : (
            <>
              <section>
                <SectionTitle>Interface Sections</SectionTitle>
                <ToggleList>
                  {(Object.keys(settings.sections) as (keyof Sections)[]).map(
                    (key) => (
                      <ToggleRow key={key}>
                        <ToggleInfo>
                          <ToggleName>{SECTION_LABELS[key]}</ToggleName>
                          <ToggleDesc>{SECTION_DESCRIPTIONS[key]}</ToggleDesc>
                        </ToggleInfo>
                        <SwitchTrack
                          $on={settings.sections[key]}
                          onClick={() =>
                            patchSection(key, !settings.sections[key])
                          }
                        >
                          <SwitchThumb $on={settings.sections[key]} />
                        </SwitchTrack>
                      </ToggleRow>
                    ),
                  )}
                </ToggleList>
              </section>

              <section>
                <SectionTitle>Display</SectionTitle>

                {accounts.length > 1 && (
                  <div style={{ marginBottom: 12 }}>
                    <SubLabel>Default compose account</SubLabel>
                    <AccountList>
                      {accounts.map((a) => (
                        <AccountBtn
                          key={a.key}
                          $active={settings!.display.defaultAccount === a.key}
                          onClick={() =>
                            patchDisplay("defaultAccount", a.key)
                          }
                        >
                          <RadioDot
                            $active={
                              settings!.display.defaultAccount === a.key
                            }
                          />
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <AccountLabel
                              $active={
                                settings!.display.defaultAccount === a.key
                              }
                            >
                              {a.label}
                            </AccountLabel>
                            <AccountEmail>{a.email}</AccountEmail>
                          </div>
                        </AccountBtn>
                      ))}
                    </AccountList>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <SubLabel>Reading pane</SubLabel>
                  <ChipRow>
                    {SPLIT_MODES.map(({ value, label }) => (
                      <Chip
                        key={value}
                        $active={settings.display.splitMode === value}
                        onClick={() => patchDisplay("splitMode", value)}
                      >
                        {label}
                      </Chip>
                    ))}
                  </ChipRow>
                </div>

                <div>
                  <SubLabel>Zoom</SubLabel>
                  <ChipRow>
                    {ZOOM_STEPS.map((z) => (
                      <ZoomChip
                        key={z}
                        $active={settings.display.zoom === z}
                        onClick={() => patchDisplay("zoom", z)}
                      >
                        {Math.round(z * 100)}%
                      </ZoomChip>
                    ))}
                  </ChipRow>
                </div>
              </section>
            </>
          )}
        </ScrollBody>

        <Footer>
          <CancelBtn onClick={onClose}>Cancel</CancelBtn>
          <SaveBtn
            $saved={saved}
            onClick={save}
            disabled={saving || !settings}
          >
            {saved ? "✓ Saved" : saving ? "Saving…" : "Save"}
          </SaveBtn>
        </Footer>
      </Container>
    </Backdrop>
  );
}
