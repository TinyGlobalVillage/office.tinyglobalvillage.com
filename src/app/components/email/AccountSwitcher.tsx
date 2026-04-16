"use client";

import { useRef, useState, useEffect } from "react";

export type AccountMeta = {
  key: string;
  email: string;
  label: string;
  personal: boolean;
  unlocked: boolean;
};

type Props = {
  accounts: AccountMeta[];
  selected: string;
  onSelect: (key: string) => void;
  onSettings: () => void;
};

export default function AccountSwitcher({ accounts, selected, onSelect, onSettings }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const current = accounts.find((a) => a.key === selected);

  return (
    <div className="flex items-center gap-1 px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Account dropdown */}
      <div ref={ref} className="relative flex-1 min-w-0">
        <button
          onClick={() => setOpen((p) => !p)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all"
          style={{
            background: open ? "rgba(0,191,255,0.1)" : "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
            style={{ background: "rgba(0,191,255,0.2)", color: "#00bfff" }}
          >
            {current?.label?.[0] ?? "?"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
              {current?.label ?? "—"}
            </div>
            <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
              {current?.email ?? ""}
            </div>
          </div>
          {current?.personal && (
            <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                background: current.unlocked ? "rgba(0,220,100,0.15)" : "rgba(255,200,0,0.15)",
                color: current.unlocked ? "rgba(0,220,100,0.8)" : "rgba(255,200,0,0.8)",
                border: `1px solid ${current.unlocked ? "rgba(0,220,100,0.3)" : "rgba(255,200,0,0.3)"}`,
              }}
            >
              {current.unlocked ? "🔓" : "🔒"}
            </span>
          )}
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>▾</span>
        </button>

        {open && (
          <div
            className="absolute top-full left-0 mt-1 w-full z-50 rounded-xl overflow-hidden"
            style={{
              background: "rgba(14,17,23,0.98)",
              border: "1px solid rgba(0,191,255,0.15)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            {accounts.map((acc) => (
              <button
                key={acc.key}
                onClick={() => { onSelect(acc.key); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all hover:bg-white/5"
                style={{
                  background: acc.key === selected ? "rgba(0,191,255,0.08)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
                  style={{ background: "rgba(0,191,255,0.15)", color: "#00bfff" }}
                >
                  {acc.label[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: acc.key === selected ? "#00bfff" : "rgba(255,255,255,0.8)" }}>
                    {acc.label}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {acc.email}
                  </div>
                </div>
                {acc.personal && (
                  <span className="text-[9px]" style={{ color: acc.unlocked ? "rgba(0,220,100,0.6)" : "rgba(255,200,0,0.6)" }}>
                    {acc.unlocked ? "🔓" : "🔒"}
                  </span>
                )}
                {acc.key === selected && (
                  <span className="text-[10px]" style={{ color: "rgba(0,191,255,0.6)" }}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Settings gear */}
      <button
        onClick={onSettings}
        title="Email settings"
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:bg-white/10"
        style={{ color: "rgba(255,255,255,0.55)", fontSize: 22 }}
      >
        ⚙
      </button>
    </div>
  );
}
