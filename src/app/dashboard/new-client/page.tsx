"use client";

import { useState, useMemo } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import TopNav from "@/app/components/TopNav";
import {
  VERTICALS,
  VERTICAL_IDS,
  MODULES,
  MODULE_IDS,
  TIERS,
  TIER_IDS,
  STORAGE,
  getPrice,
  validateModuleCompatibility,
  ClientSpecSchema,
  type VerticalId,
  type ModuleId,
  type TierId,
} from "@/lib/registry";

type WizardState = {
  clientName: string;
  domain: string;
  subdomain: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  vertical: VerticalId | "";
  tier: TierId;
  modules: ModuleId[];
  storageGB: number;
  customFlag: boolean;
  customDescription: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
};

const INITIAL: WizardState = {
  clientName: "",
  domain: "",
  subdomain: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  vertical: "",
  tier: "basic",
  modules: [],
  storageGB: STORAGE.includedGB,
  customFlag: false,
  customDescription: "",
  primaryColor: "",
  accentColor: "",
  logoUrl: "",
};

const STEPS = [
  { key: "info", label: "Client info" },
  { key: "vertical", label: "Vertical" },
  { key: "tier", label: "Tier" },
  { key: "modules", label: "Modules" },
  { key: "storage", label: "Storage + custom" },
  { key: "review", label: "Review" },
] as const;

export default function NewClientWizard() {
  const [stepIdx, setStepIdx] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; deployId: string }
    | { ok: false; error: string }
    | null
  >(null);

  const step = STEPS[stepIdx].key;

  const price = useMemo(
    () =>
      getPrice({
        tier: state.tier,
        modules: state.modules,
        storageGB: state.storageGB,
      }),
    [state.tier, state.modules, state.storageGB],
  );

  const compat = useMemo(
    () => validateModuleCompatibility({ tier: state.tier, modules: state.modules }),
    [state.tier, state.modules],
  );

  function patch(p: Partial<WizardState>) {
    setState((s) => ({ ...s, ...p }));
  }

  function toggleModule(id: ModuleId) {
    setState((s) =>
      s.modules.includes(id)
        ? { ...s, modules: s.modules.filter((m) => m !== id) }
        : { ...s, modules: [...s.modules, id] },
    );
  }

  function applyVertical(id: VerticalId) {
    const v = VERTICALS[id];
    setState((s) => ({
      ...s,
      vertical: id,
      tier: v.defaultTier,
      modules: [...v.defaultModules],
    }));
  }

  function canAdvance(): { ok: boolean; reason?: string } {
    if (step === "info") {
      if (!state.clientName.trim()) return { ok: false, reason: "Client name required" };
      if (state.domain.trim().length < 3) return { ok: false, reason: "Domain required (≥3 chars)" };
      if (!state.contactName.trim()) return { ok: false, reason: "Contact name required" };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contactEmail)) return { ok: false, reason: "Valid contact email required" };
    }
    if (step === "vertical" && !state.vertical) return { ok: false, reason: "Pick a vertical" };
    if (step === "modules" && !compat.ok) return { ok: false, reason: compat.reason };
    if (step === "storage") {
      if (state.customFlag && !state.customDescription.trim()) {
        return { ok: false, reason: "Describe the custom work" };
      }
    }
    return { ok: true };
  }

  async function submit() {
    if (!state.vertical) return;
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        clientName: state.clientName.trim(),
        domain: state.domain.trim(),
        subdomain: state.subdomain.trim() || undefined,
        vertical: state.vertical,
        tier: state.tier,
        modules: state.modules,
        storageGB: state.storageGB,
        customFlag: state.customFlag,
        customDescription: state.customFlag ? state.customDescription.trim() : undefined,
        contact: {
          name: state.contactName.trim(),
          email: state.contactEmail.trim(),
          phone: state.contactPhone.trim() || undefined,
        },
        branding:
          state.primaryColor || state.accentColor || state.logoUrl
            ? {
                primaryColor: state.primaryColor || undefined,
                accentColor: state.accentColor || undefined,
                logoUrl: state.logoUrl || undefined,
              }
            : undefined,
      };

      const parsed = ClientSpecSchema.safeParse(payload);
      if (!parsed.success) {
        setResult({ ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/admin/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setResult({ ok: false, error: body.error || `HTTP ${res.status}` });
      } else {
        setResult({ ok: true, deployId: body.deployId });
      }
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setSubmitting(false);
    }
  }

  const advance = canAdvance();

  return (
    <>
      <TopNav />
      <PageMain>
        <Header>
          <h1>New Client</h1>
          <p>Deterministic 5-minute deploy. Step {stepIdx + 1} of {STEPS.length}.</p>
        </Header>

        <StepsBar>
          {STEPS.map((s, i) => (
            <StepPip key={s.key} $active={i === stepIdx} $done={i < stepIdx}>
              <span>{i + 1}</span>
              <label>{s.label}</label>
            </StepPip>
          ))}
        </StepsBar>

        <Layout>
          <FormCol>
            {step === "info" && <StepInfo state={state} patch={patch} />}
            {step === "vertical" && <StepVertical state={state} applyVertical={applyVertical} />}
            {step === "tier" && <StepTier state={state} patch={patch} />}
            {step === "modules" && <StepModules state={state} toggleModule={toggleModule} compat={compat} />}
            {step === "storage" && <StepStorage state={state} patch={patch} />}
            {step === "review" && <StepReview state={state} price={price} />}

            <Nav>
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                disabled={stepIdx === 0 || submitting}
              >
                ← Back
              </button>
              {stepIdx < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => advance.ok && setStepIdx((i) => i + 1)}
                  disabled={!advance.ok || submitting}
                  title={advance.reason || ""}
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !advance.ok}
                >
                  {submitting ? "Submitting…" : "Submit + Deploy"}
                </button>
              )}
            </Nav>

            {!advance.ok && advance.reason && <Warn>{advance.reason}</Warn>}
            {result && result.ok && (
              <Ok>
                Submitted. deployId <code>{result.deployId}</code>. Deploy engine (Phase 2 Step 4) will pick this up once live.
              </Ok>
            )}
            {result && !result.ok && <Err>{result.error}</Err>}
          </FormCol>

          <SummaryCol>
            <SummaryCard>
              <h3>Pricing</h3>
              <Row><span>Tier — {TIERS[state.tier].name}</span><strong>${price.detail.tier.monthlyUsd}/mo</strong></Row>
              <Row>
                <span>Storage — {state.storageGB}GB ({price.detail.storage.overageGB}GB over)</span>
                <strong>${price.detail.storage.monthlyUsd}/mo</strong>
              </Row>
              <Divider />
              <Row><span>Monthly</span><strong>${price.monthlyUsd}/mo</strong></Row>
              <Row $muted><span>One-time modules ({price.detail.modules.length})</span><strong>${price.oneTimeUsd}</strong></Row>
              <ModuleBreakdown>
                {price.detail.modules.map((m) => (
                  <li key={m.id}>{MODULES[m.id].name} — ${m.oneTimeUsd}</li>
                ))}
                {price.detail.modules.length === 0 && <li>(no modules selected)</li>}
              </ModuleBreakdown>
            </SummaryCard>
          </SummaryCol>
        </Layout>
      </PageMain>
    </>
  );
}

function StepInfo({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <Section>
      <h2>Client info</h2>
      <Field>
        <label>Client name *</label>
        <input value={state.clientName} onChange={(e) => patch({ clientName: e.target.value })} placeholder="Acme Yoga" />
      </Field>
      <Row2>
        <Field>
          <label>Domain *</label>
          <input value={state.domain} onChange={(e) => patch({ domain: e.target.value })} placeholder="acme-yoga.com" />
        </Field>
        <Field>
          <label>Subdomain (optional)</label>
          <input value={state.subdomain} onChange={(e) => patch({ subdomain: e.target.value })} placeholder="acme" />
        </Field>
      </Row2>
      <h3>Contact</h3>
      <Row2>
        <Field>
          <label>Name *</label>
          <input value={state.contactName} onChange={(e) => patch({ contactName: e.target.value })} placeholder="Jane Doe" />
        </Field>
        <Field>
          <label>Email *</label>
          <input type="email" value={state.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} placeholder="jane@acme.com" />
        </Field>
      </Row2>
      <Field>
        <label>Phone (optional)</label>
        <input value={state.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })} />
      </Field>
      <h3>Branding (optional)</h3>
      <Row2>
        <Field>
          <label>Primary hex</label>
          <input value={state.primaryColor} onChange={(e) => patch({ primaryColor: e.target.value })} placeholder="#5ec8ff" />
        </Field>
        <Field>
          <label>Accent hex</label>
          <input value={state.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} placeholder="#ff4ecb" />
        </Field>
      </Row2>
      <Field>
        <label>Logo URL</label>
        <input value={state.logoUrl} onChange={(e) => patch({ logoUrl: e.target.value })} placeholder="https://…" />
      </Field>
    </Section>
  );
}

function StepVertical({ state, applyVertical }: { state: WizardState; applyVertical: (id: VerticalId) => void }) {
  return (
    <Section>
      <h2>Pick a vertical</h2>
      <p>Selecting a vertical seeds defaults for tier + modules. You can still override downstream.</p>
      <CardGrid>
        {VERTICAL_IDS.map((id) => {
          const v = VERTICALS[id];
          const selected = state.vertical === id;
          return (
            <VerticalCard key={id} $selected={selected} onClick={() => applyVertical(id)} type="button">
              <h4>{v.name}</h4>
              <small>{v.tagline}</small>
              <DefaultList>
                <li>tier: <code>{v.defaultTier}</code></li>
                <li>
                  modules:{" "}
                  {v.defaultModules.length === 0
                    ? <em>none</em>
                    : v.defaultModules.map((m) => <code key={m}>{m}</code>)}
                </li>
              </DefaultList>
            </VerticalCard>
          );
        })}
      </CardGrid>
    </Section>
  );
}

function StepTier({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <Section>
      <h2>Pick a tier</h2>
      <TierGrid>
        {TIER_IDS.map((id) => {
          const t = TIERS[id];
          const selected = state.tier === id;
          return (
            <TierCard key={id} $selected={selected} onClick={() => patch({ tier: id })} type="button">
              <TierHead>
                <h4>{t.name}</h4>
                <big>${t.monthlyUsd}<small>/mo</small></big>
              </TierHead>
              <ul>{t.includes.map((line, i) => <li key={i}>{line}</li>)}</ul>
            </TierCard>
          );
        })}
      </TierGrid>
    </Section>
  );
}

function StepModules({
  state,
  toggleModule,
  compat,
}: {
  state: WizardState;
  toggleModule: (id: ModuleId) => void;
  compat: { ok: true } | { ok: false; reason: string; offending: string[] };
}) {
  return (
    <Section>
      <h2>Modules</h2>
      <p>One-time module fees. Some modules require cart tier.</p>
      <ModuleList>
        {MODULE_IDS.map((id) => {
          const m = MODULES[id];
          const checked = state.modules.includes(id);
          const gated = !!m.requiresTier && m.requiresTier !== state.tier && state.tier !== "cart";
          return (
            <ModuleRow key={id} $checked={checked} $gated={gated}>
              <input type="checkbox" checked={checked} onChange={() => toggleModule(id)} />
              <div>
                <strong>{m.name}</strong>
                <small>{m.summary}</small>
                {m.requiresTier && <Pill>requires {m.requiresTier}</Pill>}
              </div>
              <ModulePrice>${m.oneTimeFeeUsd}</ModulePrice>
            </ModuleRow>
          );
        })}
      </ModuleList>
      {!compat.ok && <Warn>{compat.reason}</Warn>}
    </Section>
  );
}

function StepStorage({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  const overage = Math.max(0, state.storageGB - STORAGE.includedGB);
  return (
    <Section>
      <h2>Storage + custom work</h2>
      <Field>
        <label>Storage allocation ({state.storageGB} GB)</label>
        <input
          type="range"
          min={STORAGE.includedGB}
          max={STORAGE.maxGB}
          value={state.storageGB}
          onChange={(e) => patch({ storageGB: parseInt(e.target.value, 10) })}
        />
        <small>
          Included: {STORAGE.includedGB} GB · Overage: ${STORAGE.overageUsdPerGB}/GB · Current overage: {overage} GB = ${overage * STORAGE.overageUsdPerGB}/mo
        </small>
      </Field>
      <Field>
        <label>
          <input type="checkbox" checked={state.customFlag} onChange={(e) => patch({ customFlag: e.target.checked })} />
          {" "}This is a custom / RFP client
        </label>
      </Field>
      {state.customFlag && (
        <Field>
          <label>Describe the custom work</label>
          <textarea
            rows={5}
            value={state.customDescription}
            onChange={(e) => patch({ customDescription: e.target.value })}
            placeholder="Scope, special features, deadlines, anything the RFP record should capture."
          />
        </Field>
      )}
    </Section>
  );
}

function StepReview({ state, price }: { state: WizardState; price: ReturnType<typeof getPrice> }) {
  return (
    <Section>
      <h2>Review + submit</h2>
      <ReviewBlock>
        <h4>Client</h4>
        <Row><span>Name</span><strong>{state.clientName}</strong></Row>
        <Row><span>Domain</span><strong>{state.domain}{state.subdomain ? ` (sub: ${state.subdomain})` : ""}</strong></Row>
        <Row><span>Vertical</span><strong>{state.vertical || "—"}</strong></Row>
        <Row><span>Tier</span><strong>{state.tier}</strong></Row>
        <Row><span>Modules</span><strong>{state.modules.length ? state.modules.join(", ") : "—"}</strong></Row>
        <Row><span>Storage</span><strong>{state.storageGB} GB</strong></Row>
        <Row><span>Custom</span><strong>{state.customFlag ? "yes" : "no"}</strong></Row>
      </ReviewBlock>
      <ReviewBlock>
        <h4>Contact</h4>
        <Row><span>{state.contactName}</span><strong>{state.contactEmail}</strong></Row>
        {state.contactPhone && <Row><span>Phone</span><strong>{state.contactPhone}</strong></Row>}
      </ReviewBlock>
      <ReviewBlock>
        <h4>Pricing</h4>
        <Row><span>Monthly</span><strong>${price.monthlyUsd}/mo</strong></Row>
        <Row><span>One-time</span><strong>${price.oneTimeUsd}</strong></Row>
      </ReviewBlock>
    </Section>
  );
}

/* ── Styled Components ─────────────────────────────────────────── */

const PageMain = styled.main`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem 0 4rem;
  color: var(--t-text);
`;

const Header = styled.header`
  h1 { margin: 0; font-size: 1.75rem; color: ${colors.cyan}; text-shadow: 0 0 8px ${colors.cyan}; }
  p { margin: 0.25rem 0 0; color: var(--t-textMuted); font-size: 0.9rem; }
`;

const StepsBar = styled.nav`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const StepPip = styled.div<{ $active: boolean; $done: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 999px;
  background: ${(p) => p.$active ? `rgba(${rgb.cyan}, 0.18)` : p.$done ? `rgba(${rgb.green}, 0.12)` : "var(--t-inputBg)"};
  border: 1px solid ${(p) => p.$active ? colors.cyan : p.$done ? colors.green : "var(--t-border)"};
  font-size: 0.8rem;
  color: var(--t-text);
  span {
    display: inline-grid;
    place-items: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: ${(p) => p.$active ? colors.cyan : p.$done ? colors.green : "var(--t-textGhost)"};
    color: #000;
    font-weight: 700;
  }
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1.5rem;
  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

const FormCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const SummaryCol = styled.aside`
  position: sticky;
  top: 1rem;
  align-self: start;
`;

const SummaryCard = styled.div`
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  border-radius: 0.75rem;
  padding: 1rem;
  h3 { margin: 0 0 0.75rem; font-size: 1rem; color: ${colors.cyan}; }
`;

const Row = styled.div<{ $muted?: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0;
  color: ${(p) => p.$muted ? "var(--t-textMuted)" : "var(--t-text)"};
  font-size: 0.88rem;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid var(--t-border);
  margin: 0.5rem 0;
`;

const ModuleBreakdown = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--t-textMuted);
  li { padding: 0.15rem 0; }
`;

const Section = styled.section`
  background: var(--t-surface);
  border: 1px solid var(--t-border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  h2 { margin: 0 0 0.5rem; font-size: 1.2rem; }
  h3 { margin: 1rem 0 0.5rem; font-size: 0.8rem; color: var(--t-textMuted); text-transform: uppercase; letter-spacing: 0.08em; }
  p { margin: 0 0 1rem; color: var(--t-textMuted); font-size: 0.88rem; }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
  label { font-size: 0.85rem; color: var(--t-textMuted); }
  input, textarea {
    background: var(--t-inputBg);
    border: 1px solid var(--t-border);
    color: var(--t-text);
    padding: 0.55rem 0.7rem;
    border-radius: 0.5rem;
    font: inherit;
    &:focus { outline: none; border-color: ${colors.cyan}; }
  }
  input[type="range"] { padding: 0; border: none; background: transparent; }
  input[type="checkbox"] { width: auto; margin-right: 0.3rem; }
  small { color: var(--t-textMuted); font-size: 0.78rem; }
`;

const Row2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
`;

const VerticalCard = styled.button<{ $selected: boolean }>`
  text-align: left;
  padding: 1rem;
  border-radius: 0.625rem;
  background: ${(p) => p.$selected ? `rgba(${rgb.cyan}, 0.14)` : "var(--t-inputBg)"};
  border: 1px solid ${(p) => p.$selected ? colors.cyan : "var(--t-border)"};
  color: var(--t-text);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font: inherit;
  h4 { margin: 0; font-size: 1rem; text-transform: capitalize; color: ${(p) => p.$selected ? colors.cyan : "inherit"}; }
  small { color: var(--t-textMuted); font-size: 0.78rem; }
  &:hover { border-color: ${colors.cyan}; }
`;

const DefaultList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  li { padding: 0.1rem 0; }
  code {
    display: inline-block;
    padding: 0 0.35rem;
    margin: 0 0.2rem 0 0;
    background: var(--t-inputBg);
    border: 1px solid var(--t-border);
    border-radius: 0.25rem;
  }
`;

const TierGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const TierCard = styled.button<{ $selected: boolean }>`
  text-align: left;
  padding: 1.25rem;
  border-radius: 0.625rem;
  background: ${(p) => p.$selected ? `rgba(${rgb.cyan}, 0.14)` : "var(--t-inputBg)"};
  border: 1px solid ${(p) => p.$selected ? colors.cyan : "var(--t-border)"};
  color: var(--t-text);
  cursor: pointer;
  font: inherit;
  &:hover { border-color: ${colors.cyan}; }
  ul { margin: 0.75rem 0 0; padding-left: 1.1rem; color: var(--t-textMuted); font-size: 0.85rem; }
  li { padding: 0.15rem 0; }
`;

const TierHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  h4 { margin: 0; font-size: 1.1rem; }
  big { font-size: 1.5rem; font-weight: 700; color: ${colors.cyan}; }
  small { font-size: 0.85rem; color: var(--t-textMuted); font-weight: 400; }
`;

const ModuleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const ModuleRow = styled.label<{ $checked: boolean; $gated: boolean }>`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  background: ${(p) => p.$checked ? `rgba(${rgb.cyan}, 0.1)` : "var(--t-inputBg)"};
  border: 1px solid ${(p) => p.$checked ? colors.cyan : "var(--t-border)"};
  border-radius: 0.5rem;
  opacity: ${(p) => p.$gated ? 0.6 : 1};
  cursor: pointer;
  color: var(--t-text);
  div { display: flex; flex-direction: column; gap: 0.15rem; }
  small { color: var(--t-textMuted); font-size: 0.78rem; }
`;

const Pill = styled.span`
  display: inline-block;
  padding: 0 0.4rem;
  margin-top: 0.2rem;
  width: fit-content;
  font-size: 0.7rem;
  background: rgba(${rgb.amber}, 0.18);
  border: 1px solid ${colors.amber};
  border-radius: 0.25rem;
`;

const ModulePrice = styled.strong`
  color: ${colors.cyan};
`;

const Nav = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  button {
    padding: 0.6rem 1.2rem;
    background: ${colors.cyan};
    color: #000;
    border: none;
    border-radius: 999px;
    font-weight: 600;
    cursor: pointer;
    font: inherit;
    &:disabled { opacity: 0.4; cursor: not-allowed; }
    &:first-child {
      background: transparent;
      color: var(--t-text);
      border: 1px solid var(--t-border);
    }
  }
`;

const Warn = styled.div`
  padding: 0.6rem 0.85rem;
  background: rgba(${rgb.red}, 0.15);
  border: 1px solid ${colors.red};
  border-radius: 0.5rem;
  font-size: 0.85rem;
`;

const Ok = styled.div`
  padding: 0.7rem 0.9rem;
  background: rgba(${rgb.green}, 0.15);
  border: 1px solid ${colors.green};
  border-radius: 0.5rem;
  code { background: var(--t-inputBg); padding: 0.05rem 0.3rem; border-radius: 0.25rem; }
`;

const Err = styled.div`
  padding: 0.7rem 0.9rem;
  background: rgba(${rgb.red}, 0.15);
  border: 1px solid ${colors.red};
  border-radius: 0.5rem;
  font-family: ui-monospace, monospace;
  font-size: 0.82rem;
`;

const ReviewBlock = styled.div`
  margin-bottom: 1rem;
  h4 { margin: 0 0 0.4rem; color: ${colors.cyan}; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; }
`;
