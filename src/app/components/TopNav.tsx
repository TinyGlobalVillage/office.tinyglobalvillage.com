"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePreview } from "./PreviewDrawer";
import PresenceDots from "./PresenceDots";

const navLinks = [
  { label: "Dashboard", href: "/" },
  { label: "Processes", href: "/dashboard/processes" },
  { label: "Utils", href: "/dashboard/utils" },
];

export default function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const { togglePreview, isOpen: previewOpen } = usePreview();

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
      <nav className="nav-tgv flex items-center justify-between px-5 py-2.5 max-w-7xl mx-auto">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <span
            className="text-base font-bold tracking-widest uppercase animate-glow-pulse"
            style={{ color: "#ff4ecb" }}
          >
            TGV
          </span>
          <span className="text-xs font-semibold text-white/60 group-hover:text-white transition-colors">
            Office
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-5">
          {navLinks.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} />
          ))}
        </div>

        {/* Right side: preview toggle + presence */}
        <div className="flex items-center gap-3">
          {/* Preview button */}
          <button
            onClick={togglePreview}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
            style={{
              borderColor: previewOpen
                ? "rgba(255,78,203,0.5)"
                : "rgba(255,255,255,0.1)",
              color: previewOpen ? "#ff4ecb" : "rgba(255,255,255,0.4)",
              background: previewOpen ? "rgba(255,78,203,0.08)" : "transparent",
            }}
            title="Toggle site preview"
          >
            <span>🌐</span>
            Preview
          </button>

          {/* Presence dots — live, polled every 30s */}
          <PresenceDots />
        </div>
      </nav>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-xs font-bold uppercase tracking-wider transition-colors duration-150"
      style={{ color: "#ff4ecb" }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.color = "#00bfff")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.color = "#ff4ecb")
      }
    >
      {label}
    </Link>
  );
}

