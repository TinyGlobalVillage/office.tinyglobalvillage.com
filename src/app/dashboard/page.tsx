import TopNav from "../components/TopNav";
import DashCard from "../components/DashCard";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <>
      <TopNav />
      <main className="flex flex-col min-h-screen pt-28 pb-16 px-4 max-w-7xl mx-auto w-full gap-6">
        <div>
          <h1 className="text-3xl font-bold neon-pink mb-1">Dashboard</h1>
          <p className="text-sm text-white/40">Overview of all TGV systems</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashCard title="Processes" glow="cyan">
            <p className="text-sm text-white/60 mb-4">Manage running PM2 processes across all projects.</p>
            <Link href="/dashboard/processes" className="btn-glow text-xs px-4 py-2">View Processes</Link>
          </DashCard>

          <DashCard title="Deploy" glow="pink">
            <p className="text-sm text-white/60 mb-4">Push deploys and monitor GitHub webhooks.</p>
            <Link href="/dashboard/deploy" className="btn-glow btn-glow-pink text-xs px-4 py-2">Open Deploy</Link>
          </DashCard>

          <DashCard title="Database" glow="gold">
            <p className="text-sm text-white/60 mb-4">Run Drizzle migrations and inspect schemas.</p>
            <Link href="/dashboard/database" className="btn-glow text-xs px-4 py-2" style={{ background: "linear-gradient(to right, #f7b700, #fe9e17)", color: "#0a0a0a" }}>Open DB</Link>
          </DashCard>
        </div>
      </main>
    </>
  );
}
