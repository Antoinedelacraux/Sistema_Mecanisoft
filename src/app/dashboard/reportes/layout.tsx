import { ReportesLayoutShell } from "./_components/layout-shell"

export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ReportesLayoutShell>{children}</ReportesLayoutShell>
}
