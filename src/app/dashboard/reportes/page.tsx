import Link from "next/link"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import {
  ArrowUpRight,
  CalendarCheck,
  FileSpreadsheet,
  Layers,
} from "lucide-react"

import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  asegurarPermiso,
  PermisoDenegadoError,
  SesionInvalidaError,
} from "@/lib/permisos/guards"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

const dateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
})

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
})

const formatBytes = (bytes: number | null | undefined) => {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export const dynamic = "force-dynamic"

export default async function ReportesDashboardPage() {
  const session = await getServerSession(authOptions)

  try {
    await asegurarPermiso(session, "reportes.ver", { prismaClient: prisma })
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      redirect("/login")
    }
    if (error instanceof PermisoDenegadoError) {
      redirect("/dashboard")
    }
    throw error
  }

  const [templates, schedules, recentFiles, aggregateFiles] = await Promise.all([
    prisma.reportTemplate.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { schedules: { select: { id: true, active: true } } },
    }),
    prisma.reportSchedule.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { template: { select: { id: true, name: true, key: true } } },
    }),
    prisma.reportFile.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.reportFile.aggregate({
      _sum: { size: true },
      _count: { _all: true },
    }),
  ])

  const totalTemplates = await prisma.reportTemplate.count()
  const totalSchedules = await prisma.reportSchedule.count()
  const activeSchedules = await prisma.reportSchedule.count({ where: { active: true } })

  const lastExport = recentFiles.at(0)

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Reportes
        </h1>
        <p className="text-sm text-slate-600">
          Administra plantillas, programaciones y exportaciones automáticas.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Plantillas registradas
              <Layers className="h-4 w-4 text-blue-600" />
            </CardTitle>
            <CardDescription>Total disponibles para generar reportes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{totalTemplates}</p>
            <div className="mt-2 text-xs text-slate-500">
              Última creación: {templates.length > 0 ? dateFormatter.format(templates[0].createdAt) : "Sin registros"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Reportes programados
              <CalendarCheck className="h-4 w-4 text-emerald-600" />
            </CardTitle>
            <CardDescription>Automatizaciones activas para distribución.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold text-slate-900">{totalSchedules}</p>
            <Badge variant={activeSchedules > 0 ? "default" : "secondary"}>
              {activeSchedules} activos
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Última exportación
              <FileSpreadsheet className="h-4 w-4 text-purple-600" />
            </CardTitle>
            <CardDescription>Estado del generador de archivos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-medium text-slate-900">
              {lastExport ? lastExport.filename : "Sin exportaciones"}
            </p>
            <div className="text-xs text-slate-500">
              {lastExport ? dateTimeFormatter.format(lastExport.createdAt) : "Cuando se genere un reporte aparecerá aquí."}
            </div>
            {lastExport ? (
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={`/api/reportes/files/${lastExport.id}/download`}>
                  Descargar
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Espacio utilizado
              <ArrowUpRight className="h-4 w-4 text-orange-600" />
            </CardTitle>
            <CardDescription>Sumatoria de exportaciones almacenadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-semibold text-slate-900">
              {formatBytes(aggregateFiles._sum.size ?? 0)}
            </p>
            <div className="text-xs text-slate-500">
              {aggregateFiles._count._all} archivos guardados.
            </div>
            <Button asChild variant="ghost" size="sm" className="mt-2 text-blue-600">
              <Link href="/dashboard/reportes/purge">Liberar espacio</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Plantillas recientes</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reportes/templates" className="flex items-center gap-1">
                Gestionar
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-500">Aún no hay plantillas registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Llave</TableHead>
                    <TableHead className="hidden md:table-cell">Creado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.key}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-slate-500">
                        {dateTimeFormatter.format(template.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Programaciones recientes</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/reportes/schedules" className="flex items-center gap-1">
                Gestionar
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <p className="text-sm text-slate-500">No hay programaciones registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Plantilla</TableHead>
                    <TableHead className="hidden lg:table-cell">Próxima ejecución</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">{schedule.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{schedule.template?.key}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-slate-500">
                        {schedule.nextRunAt
                          ? dateTimeFormatter.format(schedule.nextRunAt)
                          : "Sin programar"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Exportaciones recientes</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/reportes/ventas-resumen" className="flex items-center gap-1">
              Generar reporte
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentFiles.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no se han generado archivos de reporte.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead className="hidden md:table-cell">Tamaño</TableHead>
                  <TableHead>Generado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">{file.filename}</span>
                        {file.templateKey ? (
                          <span className="text-xs text-slate-500">{file.templateKey}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-slate-500">
                      {formatBytes(file.size)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {dateTimeFormatter.format(file.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
