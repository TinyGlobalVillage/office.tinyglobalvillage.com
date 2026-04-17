"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { dark, light, type ThemeTokens } from "../theme";

type Theme = "dark" | "light";

type ThemeCtx = {
  theme: Theme;
  isDark: boolean;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark",
  isDark: true,
  toggle: () => {},
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "tgv-theme";

function applyTokens(tokens: ThemeTokens) {
  const root = document.documentElement;
  for (const [key, val] of Object.entries(tokens)) {
    root.style.setProperty(`--t-${key}`, val);
  }
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored === "light" ? "light" : "dark";
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
    applyTokens(initial === "dark" ? dark : light);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    document.documentElement.setAttribute("data-theme", t);
    applyTokens(t === "dark" ? dark : light);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext value={{ theme, isDark: theme === "dark", toggle, setTheme }}>
      {children}
    </ThemeContext>
  );
}
