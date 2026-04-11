"use client";

import { useState, useEffect } from "react";
import TopNav from "./components/TopNav";
import DashCard from "./components/DashCard";
import PresenceCard from "./components/PresenceCard";
import Link from "next/link";

const panels = [
  {
    title: "Processes",
    subtitle: "PM2 process manager",
    glow: "cyan" as const,
    href: "/dashboard/processes",
    description: "Monitor running apps, restart or stop services, view logs in real time.",
    icon: "⚡",
  },
  {
    title: "Deploy",
    subtitle: "Project grid → live preview",
    glow: "pink" as const,
    href: "/dashboard/deploy",
    description: "Browse all deployed projects, view last commit, open live preview.",
    icon: "🚀",
  },
  {
    title: "Database",
    subtitle: "Drizzle + PostgreSQL",
    glow: "gold" as const,
    href: "/dashboard/database",
    description: "Browse databases, inspect tables, run raw SQL queries.",
    icon: "🗄️",
  },
  {
    title: "Utils",
    subtitle: "Server tooling",
    glow: "cyan" as const,
    href: "/dashboard/utils",
    description: "Run scripts, manage SSL certs, configure NGINX, and more.",
    icon: "🔧",
  },
];

type ActivityEvent = {
  timeLabel: string;
  actor: string;
  event: string;
  type: "pm2" | "git" | "system";
};

const TYPE_COLOR: Record<string, string> = {
  pm2:    "#f7b700",
  git:    "#ff4ecb",
  system: "#4ade80",
};

export default function Home() {
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then(setActivity)
      .catch(() => {});
  }, []);

  return (
    <>
      <TopNav />
      <main className="flex flex-col min-h-screen pt-28 pb-16 px-4 max-w-7xl mx-auto w-full">

        {/* Hero */}
        <section className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">
            Tiny Global Village LLC
          </p>
          <h1
            className="text-4xl md:text-5xl font-bold leading-tight mb-3"
            style={{ color: "#ff4ecb", textShadow: "0 0 8px #ff66cc, 0 0 20px #ff4ecb" }}
          >
            TGV Office
          </h1>
          <p className="text-white/50 text-base max-w-lg">
            Internal operations hub. Manage processes, deploys, and infrastructure
            for all TGV &amp; Refusionist projects.
          </p>
        </section>

        {/* Main panels */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {panels.map((panel) => (
            <Link key={panel.href} href={panel.href} className="no-underline">
              <DashCard title={panel.title} subtitle={panel.subtitle} glow={panel.glow} className="h-full">
                <div className="flex flex-col gap-3">
                  <span className="text-3xl">{panel.icon}</span>
                  <p className="text-sm text-white/60 leading-relaxed">{panel.description}</p>
                  <span
                    className="text-xs font-bold uppercase tracking-wider mt-auto"
                    style={{
                      color: panel.glow === "pink" ? "#ff4ecb" : panel.glow === "gold" ? "#f7b700" : "#00bfff",
                    }}
                  >
                    Open →
                  </span>
                </div>
              </DashCard>
            </Link>
          ))}
        </section>

        {/* Bottom: presence + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PresenceCard className="lg:col-span-1" />

          <DashCard title="Recent Activity" subtitle="Live from PM2 + git" glow="cyan" className="lg:col-span-2">
            <div className="flex flex-col divide-y divide-white/8 mt-2">
              {activity.length === 0 ? (
                <div className="py-4 text-xs text-white/25">Loading activity…</div>
              ) : (
                activity.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <span className="text-[10px] font-mono text-white/25 w-12 shrink-0 text-right">
                      {item.timeLabel}
                    </span>
                    <span
                      className="text-[10px] font-bold shrink-0 uppercase tracking-wide w-8"
                      style={{ color: TYPE_COLOR[item.type] ?? "#fff" }}
                    >
                      {item.type}
                    </span>
                    <span className="text-xs text-white/55 truncate">{item.event}</span>
                  </div>
                ))
              )}
            </div>
          </DashCard>
        </div>
      </main>
    </>
  );
}
