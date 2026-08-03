"use client";
// SVG Lab — Sandbox → Icons. Every icon the office app can reach (162 across
// the ecosystem: office icons + @tgv component-library / tgv-v5 / video-calls /
// page-editor sets, enumerated by scripts/generate-svg-manifest.mjs) loaded
// into an SBDM picker + browse grid. Pick one and play: master currentColor,
// per-layer fill/stroke/stroke-width/opacity/visibility, per-layer X/Y nudge,
// viewBox grow/shrink (bounding box), output width/height px, artboard canvas
// (checker/dark/light/custom bg, frame, zoom). Export = copy markup, download
// .svg / .png; Save keeps a named variant server-side (data/svg-lab/).
//
// The icon is rendered once into a hidden mount, serialized via outerHTML, and
// every edit re-applies onto that markup (svgModel.ts) — components stay
// untouched; the lab edits serialized copies.

import SBDM from "@tgv/module-component-library/components/ui/SBDM";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { useEffect, useMemo, useRef, useState } from "react";
import styled, { css, keyframes } from "styled-components";
import { colors, rgb } from "../../theme";
import NeonX from "../NeonX";
import { useModalLifecycle } from "../../lib/drawerKnobs";
import { SVG_MANIFEST, SVG_SOURCE_GROUPS, type SvgManifestEntry } from "./manifest.generated";
import {
  applyEdits, parseSvg, sanitizeSvgMarkup, fmtViewBox,
  EMPTY_LAYER_EDIT, type LayerEdit, type ParsedSvg, type ViewBox,
} from "./svgModel";

const ACCENT = colors.pink;
const ACCENT_RGB = rgb.pink;

type SvgVariant = {
  id: string;
  name: string;
  sourceKey: string;
  svg: string;
  createdBy: string;
  createdAt: string;
};

const SWATCHES = [colors.pink, colors.cyan, colors.gold, colors.green, colors.violet, "#ffffff", "#0d0f1a"];

/** Icon-grid drawer geometry: below MIN it snaps shut, MAX keeps the stage usable. */
const GRID_MIN_H = 56;
const GRID_MAX_H = 420;
const GRID_DEFAULT_H = 120;
const GRID_CLICK_SLOP = 4;

export type AtomApplyTarget = { key: string; label: string; group?: string };

export default function SvgLabModal({
  onClose,
  embedded = false,
  atomTargets,
  onApplyToAtom,
}: {
  onClose: () => void;
  /**
   * Render WITHOUT the overlay/modal chrome so the lab can live inside another
   * surface — the Sandbox modal's "SVG Lab" PillBar segment. Same body, same
   * state; only the frame, the title header, and Escape-to-close differ (the
   * host owns those).
   */
  embedded?: boolean;
  /** Atoms this SVG can be applied to. Omit to hide the "Apply to atom" action. */
  atomTargets?: AtomApplyTarget[];
  /** Called with the chosen atom + the saved variant id once it's on disk. */
  onApplyToAtom?: (atomKey: string, variantId: string) => void | Promise<void>;
}) {
  useModalLifecycle(embedded ? { skip: true } : undefined);

  // ── picker ──
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [gridOpen, setGridOpen] = useState(true);
  // Icon grid drawer height (px). Drag the rail under it to resize; drag below
  // GRID_MIN_H (or click the rail) and it collapses to the "Browse" pill.
  const [gridH, setGridH] = useState(GRID_DEFAULT_H);
  const [gridDragging, setGridDragging] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);

  // ── loaded icon ──
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string>("");
  const [baseMarkup, setBaseMarkup] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedSvg | null>(null);

  // ── edit state ──
  const [edits, setEdits] = useState<LayerEdit[]>([]);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const [width, setWidth] = useState(24);
  const [height, setHeight] = useState(24);
  const [lockRatio, setLockRatio] = useState(true);
  const [masterColor, setMasterColor] = useState<string>(colors.pink);
  const [selLayer, setSelLayer] = useState<number | null>(null);

  // ── canvas / artboard ──
  const [zoom, setZoom] = useState(6);
  const [canvasBg, setCanvasBg] = useState<"checker" | "dark" | "light" | "custom">("checker");
  const [customBg, setCustomBg] = useState("#0b0d13");
  const [frameOn, setFrameOn] = useState(true);

  // ── export / variants ──
  const [bakeColor, setBakeColor] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [variants, setVariants] = useState<SvgVariant[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEscapeToClose({ open: !embedded, onClose });

  useEffect(() => {
    let alive = true;
    fetch("/api/svg-lab/variants")
      .then((r) => (r.ok ? r.json() : { variants: [] }))
      .then((d) => { if (alive) setVariants(d.variants ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const pendingEntry = useMemo(
    () => SVG_MANIFEST.find((e) => e.key === pendingKey) ?? null,
    [pendingKey],
  );

  // Serialize the hidden mount AFTER the pending component has rendered.
  useEffect(() => {
    if (!pendingEntry) return;
    const el = captureRef.current?.querySelector("svg");
    if (!el) { setPendingKey(null); return; }
    loadMarkup(el.outerHTML, pendingEntry.key, pendingEntry.name);
    setPendingKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEntry]);

  function loadMarkup(rawMarkup: string, key: string | null, name: string) {
    const markup = sanitizeSvgMarkup(rawMarkup);
    const p = parseSvg(markup);
    if (!p) { setNote("Could not parse that SVG."); return; }
    const w0 = p.width && p.width >= 4 ? p.width : p.viewBox?.w ?? 24;
    const h0 = p.height && p.height >= 4 ? p.height : p.viewBox?.h ?? 24;
    setBaseMarkup(markup);
    setParsed(p);
    setCurrentKey(key);
    setCurrentName(name);
    setViewBox(p.viewBox ? { ...p.viewBox } : { x: 0, y: 0, w: w0, h: h0 });
    setWidth(Math.round(w0));
    setHeight(Math.round(h0));
    setEdits(p.layers.map(() => ({ ...EMPTY_LAYER_EDIT })));
    setSelLayer(null);
    setNote(null);
    setZoom(Math.max(1, Math.min(12, Math.round(220 / Math.max(w0, h0)))));
  }

  const filtered = useMemo(
    () => (sourceFilter === "all" ? SVG_MANIFEST : SVG_MANIFEST.filter((e) => e.sourceLabel === sourceFilter)),
    [sourceFilter],
  );

  const editedMarkup = useMemo(() => {
    if (!baseMarkup || !parsed) return null;
    return applyEdits(baseMarkup, { viewBox, width, height, edits, layers: parsed.layers });
  }, [baseMarkup, parsed, viewBox, width, height, edits]);

  const ratio = viewBox && viewBox.w > 0 ? viewBox.h / viewBox.w : 1;

  function setW(v: number) {
    if (!Number.isFinite(v) || v <= 0) return;
    setWidth(Math.round(v));
    if (lockRatio) setHeight(Math.max(1, Math.round(v * ratio)));
  }
  function setH(v: number) {
    if (!Number.isFinite(v) || v <= 0) return;
    setHeight(Math.round(v));
    if (lockRatio) setWidth(Math.max(1, Math.round(v / (ratio || 1))));
  }

  function padViewBox(d: number) {
    setViewBox((vb) => (vb ? { x: vb.x - d, y: vb.y - d, w: Math.max(1, vb.w + d * 2), h: Math.max(1, vb.h + d * 2) } : vb));
  }

  // Drag the rail to resize the icon grid; a plain click (no movement) toggles
  // it shut, and dragging up past GRID_MIN_H collapses it the same way.
  function onGridResizeDown(e: React.PointerEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = gridH;
    let moved = false;
    setGridDragging(true);

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dy) < GRID_CLICK_SLOP) return;
      moved = true;
      const raw = startH + dy;
      if (raw < GRID_MIN_H) {
        setGridOpen(false);
        setGridH(GRID_DEFAULT_H);
      } else {
        setGridOpen(true);
        setGridH(Math.min(GRID_MAX_H, raw));
      }
    };
    const onUp = () => {
      setGridDragging(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      if (!moved) setGridOpen((p) => !p);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  function patchLayer(idx: number, patch: Partial<LayerEdit>) {
    setEdits((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }

  function resetAll() {
    if (!parsed) return;
    setEdits(parsed.layers.map(() => ({ ...EMPTY_LAYER_EDIT })));
    setViewBox(parsed.viewBox ? { ...parsed.viewBox } : viewBox);
    const w0 = parsed.width && parsed.width >= 4 ? parsed.width : parsed.viewBox?.w ?? 24;
    const h0 = parsed.height && parsed.height >= 4 ? parsed.height : parsed.viewBox?.h ?? 24;
    setWidth(Math.round(w0));
    setHeight(Math.round(h0));
  }

  // ── export ──
  function exportMarkup(bake: boolean): string | null {
    if (!baseMarkup || !parsed) return null;
    return applyEdits(baseMarkup, {
      viewBox, width, height, edits, layers: parsed.layers,
      bakeColor: bake ? masterColor : undefined,
    });
  }

  const exportName = (saveName.trim() || currentName || "svg-lab").replace(/[^\w.-]+/g, "-");

  async function copySvg() {
    const m = exportMarkup(bakeColor);
    if (!m) return;
    await navigator.clipboard.writeText(m);
    setNote("Markup copied to clipboard.");
  }

  function downloadSvg() {
    const m = exportMarkup(bakeColor);
    if (!m) return;
    const url = URL.createObjectURL(new Blob([m], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function downloadPng() {
    const m = exportMarkup(true); // PNG must bake — currentColor rasterizes black
    if (!m) return;
    const scale = 4;
    const url = URL.createObjectURL(new Blob([m], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, width * scale);
      cv.height = Math.max(1, height * scale);
      const ctx = cv.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob((b) => {
          if (!b) return;
          const purl = URL.createObjectURL(b);
          const a = document.createElement("a");
          a.href = purl;
          a.download = `${exportName}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(purl), 4000);
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function saveVariant() {
    const m = exportMarkup(bakeColor);
    const name = saveName.trim();
    if (!m || !name) { setNote("Give the variant a name first."); return; }
    const res = await fetch("/api/svg-lab/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sourceKey: currentKey ?? "", svg: m }),
    }).catch(() => null);
    if (!res?.ok) { setNote("Save failed."); return; }
    const d = await res.json();
    setVariants((prev) => [...prev, d.variant]);
    setNote(`Saved “${name}”.`);
  }

  /**
   * Put the current SVG on an atom. The atom spec stores `variant:<id>`, so the
   * markup must exist server-side first — the variant IS the saved artifact
   * (named after the icon when the name field is blank).
   */
  async function applyToAtom(atomKey: string) {
    const m = exportMarkup(bakeColor);
    if (!m) { setNote("Load an icon first."); return; }
    const name = saveName.trim() || `${currentName || "icon"} → ${atomKey}`;
    setApplying(true);
    try {
      const res = await fetch("/api/svg-lab/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sourceKey: currentKey ?? "", svg: m }),
      }).catch(() => null);
      if (!res?.ok) { setNote("Could not save the SVG."); return; }
      const d = await res.json();
      setVariants((prev) => [...prev, d.variant]);
      await onApplyToAtom?.(atomKey, d.variant.id);
      setNote(`Applied “${name}” to ${atomKey}.`);
    } finally {
      setApplying(false);
    }
  }

  async function deleteVariantById(id: string) {
    const res = await fetch(`/api/svg-lab/variants/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setVariants((prev) => prev.filter((v) => v.id !== id));
  }

  function loadVariant(id: string) {
    const v = variants.find((x) => x.id === id);
    if (!v) return;
    loadMarkup(v.svg, v.sourceKey || null, v.name);
    setSaveName(v.name);
  }

  const stageBg =
    canvasBg === "dark" ? "#0b0d13" :
    canvasBg === "light" ? "#f2f2f6" :
    canvasBg === "custom" ? customBg : undefined;

  const layer = selLayer !== null && parsed ? parsed.layers[selLayer] : null;
  const layerEdit = selLayer !== null ? edits[selLayer] : null;

  const Frame = embedded ? EmbeddedFrame : Modal;
  const Shell = embedded ? Passthrough : Overlay;

  return (
    <Shell onMouseDown={(e) => { if (!embedded && e.target === e.currentTarget) onClose(); }}>
      <Frame
        style={{
          ["--ddm-accent" as string]: ACCENT,
          ["--ddm-accent-rgb" as string]: ACCENT_RGB,
        }}
        onMouseDown={(e) => { if (!embedded) e.stopPropagation(); }}
      >
        {!embedded && (
          <ModalHeader>
            <ModalTitle>🧪 SVG Lab</ModalTitle>
            <HeaderSub>{SVG_MANIFEST.length} icons · {SVG_SOURCE_GROUPS.length} sources</HeaderSub>
            <NeonX accent="pink" size="sm" onClick={onClose} title="Close" />
          </ModalHeader>
        )}

        <PickerRow>
          <SBDM
            items={[{ key: "all", label: `All sources (${SVG_MANIFEST.length})` },
              ...SVG_SOURCE_GROUPS.map((g) => ({ key: g.label, label: `${g.label} (${g.count})` }))]}
            value={sourceFilter}
            onSelect={setSourceFilter}
            placeholder="Source"
            ariaLabel="Filter icon source"
          />
          <SBDM
            items={filtered.map((e) => ({ key: e.key, label: e.name, group: e.sourceLabel }))}
            value={currentKey ?? undefined}
            onSelect={(k) => setPendingKey(k)}
            placeholder="Pick an icon…"
            searchPlaceholder="Search icons…"
            ariaLabel="Pick an icon"
            minTriggerWidth={180}
          />
          {variants.length > 0 && (
            <SBDM
              items={variants.map((v) => ({ key: v.id, label: v.name, deletable: true }))}
              onSelect={loadVariant}
              onItemDelete={deleteVariantById}
              triggerLabel={`Saved (${variants.length})`}
              placeholder="Saved variants"
              ariaLabel="Saved variants"
            />
          )}
          <GridToggle type="button" $on={gridOpen} onClick={() => setGridOpen((p) => !p)} title="Browse grid">
            ▦ {gridOpen ? "Hide grid" : "Browse"}
          </GridToggle>
        </PickerRow>

        {gridOpen && (
          <GridStrip $h={gridH}>
            {filtered.map((e) => (
              <GridCell
                key={e.key}
                type="button"
                title={`${e.name} — ${e.sourceLabel}`}
                $active={e.key === currentKey}
                onClick={() => setPendingKey(e.key)}
              >
                <e.Comp />
              </GridCell>
            ))}
          </GridStrip>
        )}
        <GridResizer
          $dragging={gridDragging}
          onPointerDown={onGridResizeDown}
          title={gridOpen ? "Drag to resize · click to collapse" : "Click to open the icon grid"}
          role="separator"
          aria-orientation="horizontal"
        >
          <GridGrip />
        </GridResizer>

        <Body>
          <Stage $checker={canvasBg === "checker"} style={stageBg ? { background: stageBg } : undefined}>
            {editedMarkup ? (
              <Artboard
                $frame={frameOn}
                style={{ width: width * zoom, height: height * zoom, color: masterColor }}
                dangerouslySetInnerHTML={{ __html: editedMarkup }}
              />
            ) : (
              <StageEmpty>Pick an icon from the menu or grid to start playing.</StageEmpty>
            )}
          </Stage>

          <Controls>
            <Section>
              <SectionTitle>Color</SectionTitle>
              <ControlRow>
                <Label>currentColor</Label>
                <ColorInput type="color" value={masterColor} onChange={(e) => setMasterColor(e.target.value)} />
                <HexInput value={masterColor} onChange={(e) => setMasterColor(e.target.value)} spellCheck={false} />
              </ControlRow>
              <SwatchRow>
                {SWATCHES.map((c) => (
                  <Swatch key={c} type="button" style={{ background: c }} $active={c === masterColor}
                    onClick={() => setMasterColor(c)} title={c} />
                ))}
              </SwatchRow>
            </Section>

            <Section>
              <SectionTitle>Size (px)</SectionTitle>
              <ControlRow>
                <Label>W</Label>
                <NumberInput type="number" min={1} value={width} onChange={(e) => setW(parseFloat(e.target.value))} />
                <Label>H</Label>
                <NumberInput type="number" min={1} value={height} onChange={(e) => setH(parseFloat(e.target.value))} />
                <MiniBtn type="button" $on={lockRatio} onClick={() => setLockRatio((p) => !p)} title="Lock aspect ratio">
                  {lockRatio ? "🔒" : "🔓"}
                </MiniBtn>
                <MiniBtn type="button" onClick={resetAll} title="Reset size, bounding box and layers">↺</MiniBtn>
              </ControlRow>
              <ControlRow>
                {[16, 24, 32, 48, 64, 128].map((s) => (
                  <PresetBtn key={s} type="button" $on={width === s && height === s}
                    onClick={() => { setLockRatio(false); setWidth(s); setHeight(s); }}>
                    {s}
                  </PresetBtn>
                ))}
              </ControlRow>
              <ControlRow>
                <Label>Zoom</Label>
                <Slider type="range" min={1} max={16} step={1} value={zoom}
                  onChange={(e) => setZoom(parseInt(e.target.value, 10))} />
                <SliderVal>{zoom}×</SliderVal>
              </ControlRow>
            </Section>

            <Section>
              <SectionTitle>Bounding box (viewBox)</SectionTitle>
              {viewBox && (
                <>
                  <ControlRow>
                    {(["x", "y", "w", "h"] as const).map((k) => (
                      <VbField key={k}>
                        <Label>{k.toUpperCase()}</Label>
                        <NumberInput type="number" step={1} value={Math.round(viewBox[k] * 100) / 100}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v)) setViewBox({ ...viewBox, [k]: v });
                          }} />
                      </VbField>
                    ))}
                  </ControlRow>
                  <ControlRow>
                    <PresetBtn type="button" onClick={() => padViewBox(2)}>Grow +2</PresetBtn>
                    <PresetBtn type="button" onClick={() => padViewBox(-2)}>Shrink −2</PresetBtn>
                    <MiniBtn type="button" title="Reset viewBox"
                      onClick={() => parsed?.viewBox && setViewBox({ ...parsed.viewBox })}>↺</MiniBtn>
                    <VbEcho>{fmtViewBox(viewBox)}</VbEcho>
                  </ControlRow>
                </>
              )}
            </Section>

            <Section>
              <SectionTitle>Layers {parsed ? `(${parsed.layers.length})` : ""}</SectionTitle>
              <LayerList>
                {parsed?.layers.map((l, i) => (
                  <LayerRow key={l.idx} $active={selLayer === i}>
                    <EyeBtn type="button" $off={edits[i]?.hidden}
                      onClick={() => patchLayer(i, { hidden: !edits[i]?.hidden })}
                      title={edits[i]?.hidden ? "Show layer" : "Hide layer"}>
                      {edits[i]?.hidden ? <EyeOffSvg /> : <EyeSvg />}
                    </EyeBtn>
                    <LayerName type="button" onClick={() => setSelLayer(selLayer === i ? null : i)}>
                      {l.label}
                    </LayerName>
                    <Chip title={`fill: ${edits[i]?.fill ?? l.authoredFill ?? "inherit"}`}
                      style={{ background: chipColor(edits[i]?.fill ?? l.authoredFill, masterColor) }} />
                    <Chip title={`stroke: ${edits[i]?.stroke ?? l.authoredStroke ?? "inherit"}`}
                      style={{ background: chipColor(edits[i]?.stroke ?? l.authoredStroke, masterColor) }} />
                  </LayerRow>
                ))}
              </LayerList>

              {layer && layerEdit && (
                <LayerDetail>
                  <DetailTitle>{layer.label}</DetailTitle>
                  <ControlRow>
                    <Label>Fill</Label>
                    <ColorInput type="color" value={hexOr(layerEdit.fill ?? layer.authoredFill, "#ffffff")}
                      onChange={(e) => patchLayer(selLayer!, { fill: e.target.value })} />
                    <MiniBtn type="button" $on={layerEdit.fill === "currentColor"}
                      onClick={() => patchLayer(selLayer!, { fill: "currentColor" })} title="Use currentColor">CC</MiniBtn>
                    <MiniBtn type="button" $on={layerEdit.fill === "none"}
                      onClick={() => patchLayer(selLayer!, { fill: "none" })} title="No fill">∅</MiniBtn>
                    <MiniBtn type="button" onClick={() => patchLayer(selLayer!, { fill: null })} title="Back to authored fill">↺</MiniBtn>
                  </ControlRow>
                  <ControlRow>
                    <Label>Stroke</Label>
                    <ColorInput type="color" value={hexOr(layerEdit.stroke ?? layer.authoredStroke, "#ffffff")}
                      onChange={(e) => patchLayer(selLayer!, { stroke: e.target.value })} />
                    <MiniBtn type="button" $on={layerEdit.stroke === "currentColor"}
                      onClick={() => patchLayer(selLayer!, { stroke: "currentColor" })} title="Use currentColor">CC</MiniBtn>
                    <MiniBtn type="button" $on={layerEdit.stroke === "none"}
                      onClick={() => patchLayer(selLayer!, { stroke: "none" })} title="No stroke">∅</MiniBtn>
                    <MiniBtn type="button" onClick={() => patchLayer(selLayer!, { stroke: null })} title="Back to authored stroke">↺</MiniBtn>
                    <Label>Width</Label>
                    <NumberInput type="number" min={0} step={0.25} style={{ width: 60 }}
                      value={layerEdit.strokeWidth ?? (parseFloat(layer.authoredStrokeWidth ?? "") || 2)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) patchLayer(selLayer!, { strokeWidth: v });
                      }} />
                  </ControlRow>
                  <ControlRow>
                    <Label>Move X</Label>
                    <NumberInput type="number" step={0.5} style={{ width: 60 }} value={layerEdit.dx}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) patchLayer(selLayer!, { dx: v });
                      }} />
                    <Label>Y</Label>
                    <NumberInput type="number" step={0.5} style={{ width: 60 }} value={layerEdit.dy}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) patchLayer(selLayer!, { dy: v });
                      }} />
                    <Label>Opacity</Label>
                    <Slider type="range" min={0} max={1} step={0.05} style={{ minWidth: 70 }}
                      value={layerEdit.opacity ?? 1}
                      onChange={(e) => patchLayer(selLayer!, { opacity: parseFloat(e.target.value) })} />
                  </ControlRow>
                </LayerDetail>
              )}
            </Section>

            <Section>
              <SectionTitle>Canvas</SectionTitle>
              <ControlRow>
                {(["checker", "dark", "light", "custom"] as const).map((b) => (
                  <PresetBtn key={b} type="button" $on={canvasBg === b} onClick={() => setCanvasBg(b)}>
                    {b}
                  </PresetBtn>
                ))}
                {canvasBg === "custom" && (
                  <ColorInput type="color" value={customBg} onChange={(e) => setCustomBg(e.target.value)} />
                )}
                <MiniBtn type="button" $on={frameOn} onClick={() => setFrameOn((p) => !p)} title="Toggle artboard frame">
                  ⿴
                </MiniBtn>
              </ControlRow>
            </Section>
          </Controls>
        </Body>

        <Footer>
          {note && <Note>{note}</Note>}
          <ControlRow>
            <TextInput placeholder="Variant name (also the export filename)…" value={saveName}
              onChange={(e) => setSaveName(e.target.value)} />
            <BakeLabel title="Replace currentColor with the picked color in exports">
              <input type="checkbox" checked={bakeColor} onChange={(e) => setBakeColor(e.target.checked)} />
              bake color
            </BakeLabel>
          </ControlRow>
          <BtnRow>
            <ActionBtn type="button" disabled={!editedMarkup} onClick={copySvg}>Copy SVG</ActionBtn>
            <ActionBtn type="button" disabled={!editedMarkup} onClick={downloadSvg}>Download .svg</ActionBtn>
            <ActionBtn type="button" disabled={!editedMarkup} onClick={downloadPng}>Download .png</ActionBtn>
            <ActionBtn type="button" disabled={!editedMarkup || !saveName.trim()} onClick={saveVariant}>
              Save variant
            </ActionBtn>
            {/* Host-supplied (Sandbox): saves the variant AND puts it on an atom. */}
            {atomTargets && atomTargets.length > 0 && (
              <ApplyWrap>
                <SBDM
                  items={atomTargets.map((t) => ({ key: t.key, label: t.label, group: t.group }))}
                  onSelect={applyToAtom}
                  triggerLabel={applying ? "Applying…" : "Apply to atom"}
                  placeholder="Apply to atom"
                  ariaLabel="Apply this SVG to an atom"
                  minTriggerWidth={0}
                />
              </ApplyWrap>
            )}
          </BtnRow>
        </Footer>

        {pendingEntry && (
          <HiddenCapture ref={captureRef} aria-hidden>
            <pendingEntry.Comp />
          </HiddenCapture>
        )}
      </Frame>
    </Shell>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function chipColor(v: string | null | undefined, master: string): string {
  if (!v || v === "none") return "transparent";
  if (v === "currentColor") return master;
  return v;
}

function hexOr(v: string | null | undefined, fallback: string): string {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function EyeSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={{ display: "block" }}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={{ display: "block" }}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ── chrome ────────────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
`;

/* Lab-themed scrollbar (Scrollbar vocab): pink accent thumb on a transparent
   track, both WebKit and Firefox, light mode included. Every scrolling surface
   in the lab uses it so nothing falls back to the OS white bar. */
const labScrollbar = css`
  scrollbar-width: thin;
  scrollbar-color: rgba(${ACCENT_RGB}, 0.45) transparent;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(${ACCENT_RGB}, 0.35);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(${ACCENT_RGB}, 0.6);
  }
  &::-webkit-scrollbar-corner {
    background: transparent;
  }

  [data-theme="light"] & {
    scrollbar-color: rgba(${ACCENT_RGB}, 0.55) transparent;
  }
`;

/* Embedded (inside the Sandbox modal): no fixed overlay, no card chrome —
   just fill the host's body row. The lab's own sections keep their styling. */
const Passthrough = styled.div`
  display: contents;
`;

const EmbeddedFrame = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background: transparent;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  /* Above the SandboxModal overlay (9999) but below DDM menus (12000) and SBDM
     panels (2000000), so pickers opened inside the lab float over it. */
  z-index: 11000;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  background: #0d0f1a;
  border: 1px solid rgba(${ACCENT_RGB}, 0.22);
  border-radius: 1rem;
  box-shadow: 0 0 40px rgba(${ACCENT_RGB}, 0.12), 0 20px 60px rgba(0, 0, 0, 0.7);
  width: 100%;
  max-width: 1060px;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.18s ease;
  overflow: hidden;
  position: relative;

  [data-theme="light"] & {
    background: #f4f4f8;
    border-color: rgba(${ACCENT_RGB}, 0.18);
  }

  @media (max-width: 768px) {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(${ACCENT_RGB}, 0.12);
  gap: 0.75rem;
  flex-shrink: 0;
`;

const ModalTitle = styled.h2`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${ACCENT};
  text-shadow: 0 0 8px rgba(${ACCENT_RGB}, 0.8), 0 0 20px rgba(${ACCENT_RGB}, 0.4);
  margin: 0;
`;

const HeaderSub = styled.span`
  flex: 1;
  font-size: 0.6875rem;
  color: rgba(${ACCENT_RGB}, 0.65);
`;

const PickerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  flex-wrap: wrap;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(${ACCENT_RGB}, 0.08);
`;

const GridToggle = styled.button<{ $on?: boolean }>`
  margin-left: auto;
  padding: 0.35rem 0.7rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  background: ${(p) => (p.$on ? `rgba(${ACCENT_RGB}, 0.22)` : `rgba(${ACCENT_RGB}, 0.1)`)};
  border: 1px solid rgba(${ACCENT_RGB}, 0.4);
  color: ${ACCENT};
  &:hover { background: rgba(${ACCENT_RGB}, 0.22); }
`;

/* Icon browse grid — a drag-resizable drawer. The rail below it drags the
   height; drag past the minimum (or click the rail) and it collapses. */
const GridStrip = styled.div<{ $h: number }>`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0.5rem 1rem;
  height: ${(p) => p.$h}px;
  overflow-y: auto;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.015);
  ${labScrollbar}
`;

const GridResizer = styled.div<{ $dragging: boolean }>`
  flex-shrink: 0;
  height: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
  touch-action: none;
  border-bottom: 1px solid rgba(${ACCENT_RGB}, 0.08);
  background: ${(p) => (p.$dragging ? `rgba(${ACCENT_RGB}, 0.14)` : "transparent")};
  &:hover {
    background: rgba(${ACCENT_RGB}, 0.1);
  }
`;

const GridGrip = styled.span`
  width: 44px;
  height: 3px;
  border-radius: 2px;
  background: rgba(${ACCENT_RGB}, 0.5);
  box-shadow: 0 0 6px rgba(${ACCENT_RGB}, 0.4);
`;

const GridCell = styled.button<{ $active?: boolean }>`
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${ACCENT_RGB}, 0.25)` : "transparent")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${ACCENT_RGB}, 0.7)` : "transparent")};
  color: ${(p) => (p.$active ? ACCENT : "var(--t-textMuted, rgba(255,255,255,0.7))")};
  &:hover { background: rgba(${ACCENT_RGB}, 0.14); color: ${ACCENT}; }
  svg { width: 17px; height: 17px; }
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  overflow: hidden;

  @media (max-width: 768px) {
    flex-direction: column;
    overflow-y: auto;
  }
`;

const Stage = styled.div<{ $checker: boolean }>`
  flex: 1;
  min-width: 0;
  min-height: 260px;
  border: 1px solid rgba(${ACCENT_RGB}, 0.14);
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  ${labScrollbar}
  ${(p) =>
    p.$checker
      ? `background: repeating-conic-gradient(rgba(255,255,255,0.07) 0% 25%, rgba(0,0,0,0.12) 0% 50%) 0 0 / 18px 18px;`
      : ""}
`;

const Artboard = styled.div<{ $frame: boolean }>`
  flex-shrink: 0;
  ${(p) => (p.$frame ? `box-shadow: 0 0 0 1px rgba(${ACCENT_RGB}, 0.55), 0 0 18px rgba(${ACCENT_RGB}, 0.18);` : "")}
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
`;

const StageEmpty = styled.p`
  font-size: 0.75rem;
  color: var(--t-textMuted, rgba(255, 255, 255, 0.5));
  padding: 1rem;
  text-align: center;
`;

const Controls = styled.div`
  width: 320px;
  flex-shrink: 0;
  overflow-y: auto;
  ${labScrollbar}
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding-right: 2px;

  @media (max-width: 768px) {
    width: 100%;
    overflow-y: visible;
  }
`;

const Section = styled.div`
  border: 1px solid rgba(${ACCENT_RGB}, 0.14);
  border-radius: 0.75rem;
  background: rgba(${ACCENT_RGB}, 0.03);
  padding: 0.625rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 0.625rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(${ACCENT_RGB}, 0.75);
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
`;

const Label = styled.label`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  white-space: nowrap;
`;

const ColorInput = styled.input`
  width: 30px;
  height: 26px;
  padding: 0;
  border: 1px solid rgba(${ACCENT_RGB}, 0.3);
  border-radius: 0.4rem;
  background: transparent;
  cursor: pointer;
  &::-webkit-color-swatch-wrapper { padding: 2px; }
  &::-webkit-color-swatch { border: none; border-radius: 0.25rem; }
`;

const HexInput = styled.input`
  width: 84px;
  background: var(--t-inputBg, rgba(255, 255, 255, 0.05));
  border: 1px solid rgba(${ACCENT_RGB}, 0.25);
  border-radius: 0.5rem;
  padding: 0.3rem 0.5rem;
  color: var(--t-text);
  font-size: 0.72rem;
  font-family: monospace;
  &:focus { outline: none; border-color: rgba(${ACCENT_RGB}, 0.5); }
`;

const SwatchRow = styled.div`
  display: flex;
  gap: 0.35rem;
`;

const Swatch = styled.button<{ $active?: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid ${(p) => (p.$active ? ACCENT : "rgba(255,255,255,0.15)")};
  &:hover { border-color: rgba(${ACCENT_RGB}, 0.7); }
`;

const NumberInput = styled.input`
  width: 68px;
  background: var(--t-inputBg, rgba(255, 255, 255, 0.05));
  border: 1px solid rgba(${ACCENT_RGB}, 0.25);
  border-radius: 0.5rem;
  padding: 0.3rem 0.5rem;
  color: var(--t-text);
  font-size: 0.72rem;
  &:focus { outline: none; border-color: rgba(${ACCENT_RGB}, 0.5); }
`;

const TextInput = styled.input`
  flex: 1;
  min-width: 140px;
  background: var(--t-inputBg, rgba(255, 255, 255, 0.05));
  border: 1px solid rgba(${ACCENT_RGB}, 0.25);
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  color: var(--t-text);
  font-size: 0.75rem;
  &:focus { outline: none; border-color: rgba(${ACCENT_RGB}, 0.5); }
`;

const Slider = styled.input`
  flex: 1;
  min-width: 90px;
  accent-color: ${ACCENT};
`;

const SliderVal = styled.span`
  font-size: 0.6875rem;
  color: ${ACCENT};
  width: 2rem;
  text-align: right;
`;

const MiniBtn = styled.button<{ $on?: boolean }>`
  min-width: 26px;
  height: 26px;
  padding: 0 0.35rem;
  border-radius: 0.4rem;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  background: ${(p) => (p.$on ? `rgba(${ACCENT_RGB}, 0.25)` : "rgba(255,255,255,0.04)")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${ACCENT_RGB}, 0.6)` : "rgba(255,255,255,0.12)")};
  color: ${(p) => (p.$on ? ACCENT : "var(--t-textMuted)")};
  &:hover { border-color: rgba(${ACCENT_RGB}, 0.5); color: ${ACCENT}; }
`;

const PresetBtn = styled.button<{ $on?: boolean }>`
  padding: 0.25rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  background: ${(p) => (p.$on ? `rgba(${ACCENT_RGB}, 0.22)` : "rgba(255,255,255,0.04)")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${ACCENT_RGB}, 0.55)` : "rgba(255,255,255,0.12)")};
  color: ${(p) => (p.$on ? ACCENT : "var(--t-textMuted)")};
  &:hover { border-color: rgba(${ACCENT_RGB}, 0.5); color: ${ACCENT}; }
`;

const VbField = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const VbEcho = styled.code`
  font-size: 0.62rem;
  color: rgba(${ACCENT_RGB}, 0.65);
  margin-left: auto;
`;

const LayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 10rem;
  overflow-y: auto;
  ${labScrollbar}
`;

const LayerRow = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.3rem;
  border-radius: 0.4rem;
  background: ${(p) => (p.$active ? `rgba(${ACCENT_RGB}, 0.12)` : "transparent")};
`;

const EyeBtn = styled.button<{ $off?: boolean }>`
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  cursor: pointer;
  background: transparent;
  border: 1px solid rgba(${ACCENT_RGB}, 0.25);
  color: ${(p) => (p.$off ? "rgba(255,255,255,0.3)" : ACCENT)};
  &:hover { border-color: rgba(${ACCENT_RGB}, 0.55); }
`;

const LayerName = styled.button`
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  padding: 0.15rem 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--t-text);
  cursor: pointer;
  &:hover { color: ${ACCENT}; }
`;

const Chip = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
`;

const LayerDetail = styled.div`
  border-top: 1px dashed rgba(${ACCENT_RGB}, 0.2);
  padding-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const DetailTitle = styled.div`
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${ACCENT};
`;

const Footer = styled.div`
  border-top: 1px solid rgba(${ACCENT_RGB}, 0.12);
  padding: 0.625rem 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: ${colors.green};
`;

const BakeLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  white-space: nowrap;
  cursor: pointer;
  input { accent-color: ${ACCENT}; }
`;

const BtnRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionBtn = styled.button`
  flex: 1;
  padding: 0.55rem 0.875rem;
  border-radius: 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: rgba(${ACCENT_RGB}, 0.14);
  border: 1px solid rgba(${ACCENT_RGB}, 0.4);
  color: ${ACCENT};
  &:hover:not(:disabled) { box-shadow: 0 0 14px rgba(${ACCENT_RGB}, 0.35); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ApplyWrap = styled.div`
  margin-left: auto;
  & button[aria-haspopup],
  & button[aria-expanded] {
    background: rgba(${ACCENT_RGB}, 0.18);
    border-color: rgba(${ACCENT_RGB}, 0.5);
    color: ${ACCENT};
  }
`;

const HiddenCapture = styled.div`
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
`;
