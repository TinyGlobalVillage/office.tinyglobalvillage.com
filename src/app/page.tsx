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
    subtitle: "GitHub → server",
    glow: "pink" as const,
    href: "/dashboard/deploy",
    description: "Trigger deploys, view recent commits, manage environments.",
    icon: "🚀",
  },
  {
    title: "Database",
    subtitle: "Drizzle + PostgreSQL",
    glow: "gold" as const,
    href: "/dashboard/database",
    description: "Run migrations, inspect tables, manage schemas across all projects.",
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

const recentActivity = [
  { time: "09:42", actor: "System", event: "PM2 auto-restart: refusionist.com", color: "#f7b700" },
  { time: "09:15", actor: "You", event: "Deploy pushed: office.tinyglobalvillage.com", color: "#ff4ecb" },
  { time: "08:53", actor: "Marthe", event: "Updated content on tinyglobalvillage.com", color: "#00bfff" },
  { time: "08:30", actor: "System", event: "SSL renewed: refusionist.com", color: "#4ade80" },
];

export default function Home() {
  return (
    <>
      <TopNav />

      <main className="flex flex-col min-h-screen pt-28 pb-16 px-4 max-w-7xl mx-auto w-full">

        {/* ── Hero heading ──────────────────────────────────────────── */}
        <section className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">
            Tiny Global Village LLC
          </p>
          <h1
            className="text-4xl md:text-5xl font-bold leading-tight mb-3"
            style={{
              color: "#ff4ecb",
              textShadow: "0 0 8px #ff66cc, 0 0 20px #ff4ecb",
            }}
          >
            TGV Office
          </h1>
          <p className="text-white/50 text-base max-w-lg">
            Internal operations hub. Manage processes, deploys, and infrastructure
            for all TGV &amp; Refusionist projects.
          </p>
        </section>

        {/* ── Main panels grid ──────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {panels.map((panel) => (
            <Link key={panel.href} href={panel.href} className="no-underline">
              <DashCard
                title={panel.title}
                subtitle={panel.subtitle}
                glow={panel.glow}
                className="h-full"
              >
                <div className="flex flex-col gap-3">
                  <span className="text-3xl">{panel.icon}</span>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {panel.description}
                  </p>
                  <span
                    className="text-xs font-bold uppercase tracking-wider mt-auto"
                    style={{
                      color:
                        panel.glow === "pink"
                          ? "#ff4ecb"
                          : panel.glow === "gold"
                          ? "#f7b700"
                          : "#00bfff",
                    }}
                  >
                    Open →
                  </span>
                </div>
              </DashCard>
            </Link>
          ))}
        </section>

        {/* ── Bottom row: presence + activity ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Presence — live */}
          <PresenceCard className="lg:col-span-1" />

          {/* Activity feed */}
          <DashCard title="Recent Activity" subtitle="Latest server events" glow="cyan" className="lg:col-span-2">
            <div className="flex flex-col divide-y divide-white/10 mt-2">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <span className="text-xs font-mono text-white/30 w-10 shrink-0">
                    {item.time}
                  </span>
                  <span
                    className="text-xs font-bold shrink-0 w-14"
                    style={{ color: item.color }}
                  >
                    {item.actor}
                  </span>
                  <span className="text-xs text-white/60 truncate">
                    {item.event}
                  </span>
                </div>
              ))}
            </div>
          </DashCard>

        </div>
      </main>
    </>
  );
}

