"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PresenceDots from "./PresenceDots";

const navLinks = [
  { label: "Dashboard", href: "/" },
  { label: "Deploy", href: "/dashboard/deploy" },
  { label: "Processes", href: "/dashboard/processes" },
  { label: "Database", href: "/dashboard/database" },
  { label: "Utils", href: "/dashboard/utils" },
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

        {/* Right side: presence dots */}
        <PresenceDots />
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

