"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Deploy", href: "/dashboard/deploy" },
  { label: "Processes", href: "/dashboard/processes" },
  { label: "Database", href: "/dashboard/database" },
];

export default function TopNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 pb-2 transition-all duration-300"
      style={{ background: scrolled ? "rgba(0,0,0,0.92)" : "transparent" }}
    >
      <nav className="nav-tgv flex items-center justify-between px-6 py-3 max-w-7xl mx-auto">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <span
            className="text-lg font-bold tracking-widest uppercase animate-glow-pulse"
            style={{ color: "#ff4ecb" }}
          >
            TGV
          </span>
          <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">
            Office
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-bold uppercase tracking-wider transition-colors duration-200"
              style={{ color: "#ff4ecb" }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.color = "#00bfff")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color = "#ff4ecb")
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Presence indicators */}
        <div className="flex items-center gap-4">
          <PresenceDot name="You" color="#ff4ecb" />
          <PresenceDot name="Marthe" color="#00bfff" />
        </div>
      </nav>
    </header>
  );
}

function PresenceDot({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: "pulse-green 2.5s ease-in-out infinite",
        }}
      />
      <span className="text-xs text-white/60">{name}</span>
    </div>
  );
}
