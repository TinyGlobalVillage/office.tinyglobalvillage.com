"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "./ThemeProvider";

const DISMISS_KEY = "tgv-ldm-dismiss-light-alert";

type LDMProps = {
  size?: number;
  accentColor?: string;
};

export default function LDM({ size = 28, accentColor = "#ff4ecb" }: LDMProps) {
  const { theme, setTheme } = useTheme();
  const [showAlert, setShowAlert] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [dontShow, setDontShow] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!showAlert) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowAlert(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAlert(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [showAlert]);

  const handleToggle = useCallback(() => {
    if (theme === "dark") {
      if (!dismissed) {
        setShowAlert(true);
      } else {
        setTheme("light");
      }
    } else {
      setTheme("dark");
    }
  }, [theme, dismissed, setTheme]);

  const handleContinueToLight = () => {
    if (dontShow) {
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
    setShowAlert(false);
    setTheme("light");
  };

  const handleStayDark = () => {
    if (dontShow) {
      localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
    setShowAlert(false);
  };

  const isDark = theme === "dark";
  const r = size / 2;
  const orbR = size * 0.32;
  const rayLen = size * 0.18;
  const rayDist = size * 0.42;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={handleToggle}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex items-center justify-center transition-all"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
        }}
      >
        <svg width={size * 0.7} height={size * 0.7} viewBox={`0 0 ${size} ${size}`}>
          {isDark ? (
            <>
              <circle cx={r} cy={r} r={orbR} fill={accentColor} opacity={0.9} />
              <circle cx={r + orbR * 0.35} cy={r - orbR * 0.3} r={orbR * 0.75} fill="#0a0a0a" />
            </>
          ) : (
            <>
              <circle cx={r} cy={r} r={orbR} fill="#f7b700" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const x1 = r + Math.cos(rad) * rayDist;
                const y1 = r + Math.sin(rad) * rayDist;
                const x2 = r + Math.cos(rad) * (rayDist + rayLen);
                const y2 = r + Math.sin(rad) * (rayDist + rayLen);
                return (
                  <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#f7b700" strokeWidth={1.5} strokeLinecap="round" />
                );
              })}
            </>
          )}
        </svg>
      </button>

      {showAlert && (
        <div
          className="absolute right-0 top-full mt-2 z-[200] rounded-xl overflow-hidden"
          style={{
            width: 240,
            background: "rgba(10,8,18,0.98)",
            border: `1px solid ${accentColor}44`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 20px ${accentColor}22`,
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌙</span>
              <span className="text-[11px] font-bold" style={{ color: accentColor }}>
                Dark mode is greener
              </span>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Dark pixels use less power on OLED screens. Staying dark reduces your energy footprint.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleStayDark}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, #a855f7)`,
                  color: "#fff",
                }}
              >
                Stay dark
              </button>
              <button
                onClick={handleContinueToLight}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Switch anyway
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer mt-0.5">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
                className="accent-pink-500 w-3.5 h-3.5 rounded"
              />
              <span className="text-[10px] text-white/35">Do not show again</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
