"use client";

import { useState, useEffect, useCallback } from "react";
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

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

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
    setShowAlert(false);
    setTheme("light");
  };

  const handleDismissForever = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setShowAlert(false);
    setTheme("light");
  };

  const handleStayDark = () => {
    setShowAlert(false);
  };

  const isDark = theme === "dark";
  const r = size / 2;
  const orbR = size * 0.32;
  const rayLen = size * 0.18;
  const rayDist = size * 0.42;

  return (
    <>
      <button
        onClick={handleToggle}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="relative flex items-center justify-center transition-all"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          background: isDark ? `rgba(255,255,255,0.04)` : `rgba(0,0,0,0.06)`,
          border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
        }}
      >
        <svg width={size * 0.7} height={size * 0.7} viewBox={`0 0 ${size} ${size}`}>
          {isDark ? (
            /* Moon */
            <>
              <circle cx={r} cy={r} r={orbR} fill={accentColor} opacity={0.9} />
              <circle cx={r + orbR * 0.35} cy={r - orbR * 0.3} r={orbR * 0.75} fill={isDark ? "#0a0a0a" : "#ffffff"} />
            </>
          ) : (
            /* Sun */
            <>
              <circle cx={r} cy={r} r={orbR} fill="#f7b700" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                const rad = (deg * Math.PI) / 180;
                const x1 = r + Math.cos(rad) * rayDist;
                const y1 = r + Math.sin(rad) * rayDist;
                const x2 = r + Math.cos(rad) * (rayDist + rayLen);
                const y2 = r + Math.sin(rad) * (rayDist + rayLen);
                return (
                  <line
                    key={deg}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#f7b700"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                );
              })}
            </>
          )}
        </svg>
      </button>

      {/* Light mode alert popup */}
      {showAlert && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={handleStayDark}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(20,15,35,0.98), rgba(8,6,16,0.98))",
              border: "1px solid rgba(255,78,203,0.25)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(255,78,203,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <span className="text-4xl">🌙</span>
              <h3 className="text-lg font-bold" style={{ color: accentColor }}>
                Dark mode is better for the planet
              </h3>
              <p className="text-sm text-white/60 leading-relaxed max-w-xs">
                Dark pixels use significantly less power on OLED and AMOLED screens.
                Staying in dark mode reduces your energy footprint — and it looks cooler.
              </p>

              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  onClick={handleStayDark}
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, #a855f7)`,
                    color: "#fff",
                    boxShadow: `0 4px 20px ${accentColor}44`,
                  }}
                >
                  Stay in dark mode
                </button>
                <button
                  onClick={handleContinueToLight}
                  className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Switch to light mode anyway
                </button>
                <button
                  onClick={handleDismissForever}
                  className="text-[10px] text-white/30 hover:text-white/50 transition-colors mt-1"
                >
                  Do not show again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
