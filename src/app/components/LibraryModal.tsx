"use client";

import { useEffect } from "react";
import LibraryIcon from "./LibraryIcon";

const ACCENT = "#a78bfa";

const SECTIONS = [
  { title: "Component Library", body: "Canonical TGV UI primitives — pulled from the Sandbox registry once they ship.", status: "in progress" },
  { title: "Skill Library", body: "Domain skills the agent can consult: opensrs, fastmail, swisseph, and more as they're added.", status: "live" },
  { title: "Playbook Library", body: "Reusable runbooks: gitrefuse, dep-check, deploy flows, incident response.", status: "live" },
  { title: "Asset Library", body: "Logos, icons, brand colors, copy snippets — single source of truth for TGV + Refusionist.", status: "planned" },
  { title: "Knowledge Library", body: "Long-form references — Human Design corpus, registrar protocols, infra docs.", status: "live" },
];

export default function LibraryModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(20,15,35,0.98), rgba(8,6,16,0.98))",
          border: `1px solid ${ACCENT}55`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 40px ${ACCENT}33`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <LibraryIcon size={28} color={ACCENT} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: ACCENT, textShadow: `0 0 12px ${ACCENT}88` }}>
                Library
              </h2>
              <p className="text-xs text-white/40">Catalog of every reusable asset across TGV + Refusionist</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Sections */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {SECTIONS.map((s) => (
            <div
              key={s.title}
              className="rounded-xl p-4 transition-all"
              style={{
                background: "rgba(167,139,250,0.04)",
                border: `1px solid ${ACCENT}22`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold" style={{ color: ACCENT }}>{s.title}</h3>
                <span
                  className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{
                    color: s.status === "live" ? "#4ade80" : s.status === "in progress" ? "#f7b700" : "rgba(255,255,255,0.35)",
                    background: s.status === "live" ? "rgba(74,222,128,0.1)" : s.status === "in progress" ? "rgba(247,183,0,0.1)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  {s.status}
                </span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
