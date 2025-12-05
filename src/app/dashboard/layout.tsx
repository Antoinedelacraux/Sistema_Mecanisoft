import { Headbar } from "@/components/layout/headbar"
import { Sidebar } from "@/components/layout/sidebar"
import { DashboardPrefetcher } from "@/components/layout/prefetch-routes"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0b1224] via-[#101b33] to-[#1d3358]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(213,182,131,0.18),_transparent_58%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-screen">
        <Sidebar />
        <main className="relative flex-1 lg:ml-0 ml-0">
          <div className="relative h-full w-full px-4 pb-10 pt-20 lg:px-10 lg:pt-12">
            <div
              className="absolute inset-0 rounded-[3rem] border border-white/12 bg-[rgba(250,251,255,0.78)] shadow-[0_30px_80px_-40px_rgba(10,18,34,0.75)] backdrop-blur-3xl dark:border-white/10 dark:bg-[rgba(16,26,47,0.72)]"
              aria-hidden
            />
            <div className="relative z-10 space-y-8">
              <Headbar />
              <DashboardPrefetcher />
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}