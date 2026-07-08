"use client";

// StudioConfigModal - the gear-gated config for the Villagers "Page Editor" tile
// (Phase C). Per the "all settings behind a gear" convention. Persists to
// localStorage (tgv-studio-cfg); StudioModal reads it to build the iframe URL.
// Landing slug, language, and the tgv.com base URL are configurable so the same
// tile can point at prod / a staging Village without a code change.

import { useEffect, useState } from "react";
import styled from "styled-components";
import { rgb, colors } from "../../theme";

const TGV_BASE =
  process.env.NEXT_PUBLIC_TGV_URL ?? "https://tinyglobalvillage.com";

export default function StudioConfigModal({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState("home");
  const [lang, setLang] = useState("en");
  const [base, setBase] = useState(TGV_BASE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tgv-studio-cfg");
      if (raw) {
        const c = JSON.parse(raw);
        if (typeof c.slug === "string") setSlug(c.slug);
        if (typeof c.lang === "string") setLang(c.lang);
        if (typeof c.base === "string") setBase(c.base);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const save = () => {
    const cfg = {
      slug: slug.trim() || "home",
      lang: lang.trim() || "en",
      base: base.trim() || TGV_BASE,
    };
    try {
      localStorage.setItem("tgv-studio-cfg", JSON.stringify(cfg));
    } catch {
      /* ignore */
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Title>Page Editor - Studio settings</Title>
        <Field>
          <Label>Landing slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="home" />
        </Field>
        <Field>
          <Label>Language</Label>
          <Input value={lang} onChange={(e) => setLang(e.target.value)} placeholder="en" />
        </Field>
        <Field>
          <Label>Village base URL</Label>
          <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder={TGV_BASE} />
        </Field>
        <Actions>
          {saved && <Saved>Saved</Saved>}
          <Btn type="button" onClick={save}>
            Save settings
          </Btn>
          <BtnGhost type="button" onClick={onClose}>
            Close
          </BtnGhost>
        </Actions>
      </Panel>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
`;

const Panel = styled.div`
  width: 26rem;
  max-width: 94vw;
  background: var(--t-bg);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.75rem;
  padding: 1.25rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
`;

const Title = styled.div`
  font-weight: 700;
  color: ${colors.gold};
  letter-spacing: 0.03em;
  margin-bottom: 1rem;
`;

const Field = styled.div`
  margin-bottom: 0.75rem;
`;

const Label = styled.div`
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--t-textFaint);
  margin-bottom: 0.3rem;
`;

const Input = styled.input`
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.4rem;
  padding: 0.45rem 0.6rem;
  color: var(--t-text);
  font-size: 0.85rem;
  &:focus {
    outline: none;
    border-color: rgba(${rgb.gold}, 0.7);
  }
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const Saved = styled.span`
  margin-right: auto;
  font-size: 0.75rem;
  color: ${colors.gold};
`;

const Btn = styled.button`
  background: rgba(${rgb.gold}, 0.12);
  border: 1px solid rgba(${rgb.gold}, 0.5);
  color: ${colors.gold};
  border-radius: 0.45rem;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
`;

const BtnGhost = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: var(--t-text);
  border-radius: 0.45rem;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
  font-size: 0.8rem;
`;
