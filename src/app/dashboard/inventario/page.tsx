import { Prisma } from '@prisma/client'
import { ShieldAlert } from 'lucide-react'
import { getServerSession } from 'next-auth'

import CompraRapidaForm from '@/components/inventario/basico/compra-rapida-form'
import MovimientoQuickForm from '@/components/inventario/movimiento-quick-form'
import ProductoStockDrawer from '@/components/inventario/basico/producto-stock-drawer'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export const revalidate = 0

const decimalToNumber = (value: Prisma.Decimal) => Number(value.toString())

const moneyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const decimalFormatter = new Intl.NumberFormat('es-PE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const integerFormatter = new Intl.NumberFormat('es-PE')

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)

const getDashboardData = async () => {
  const [inventarioReciente, movimientosRecientes, comprasRecientes, statsBase, proveedoresActivos] = await Promise.all([
    prisma.inventario.findMany({
      include: {
        producto: {
          select: {
            id_producto: true,
            nombre: true,
            codigo_producto: true,
          },
        },
      },
      orderBy: { actualizado_en: 'desc' },
      take: 8,
    }),
    prisma.movimiento.findMany({
      include: {
        producto: {
          select: {
            id_producto: true,
            nombre: true,
          },
        },
        usuario: {
          select: {
            id_usuario: true,
            nombre_usuario: true,
          },
        },
      },
      orderBy: { creado_en: 'desc' },
      take: 10,
    }),
    prisma.compra.findMany({
      include: {
        proveedor: {
          select: {
            razon_social: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
      take: 5,
    }),
    prisma.inventario.findMany({
      select: {
        stock_disponible: true,
        stock_comprometido: true,
        costo_promedio: true,
      },
    }),
    prisma.proveedor.count({ where: { estatus: true } }),
  ])

  const totalProductos = statsBase.length
  const totalDisponible = statsBase.reduce((acc, item) => acc + item.stock_disponible.toNumber(), 0)
  const totalComprometido = statsBase.reduce((acc, item) => acc + item.stock_comprometido.toNumber(), 0)
  const valorizacionTotal = statsBase.reduce(
    (acc, item) => acc + item.stock_disponible.mul(item.costo_promedio).toNumber(),
    0,
  )
  const sinStock = statsBase.filter((item) => item.stock_disponible.lte(new Prisma.Decimal(0))).length

  return {
    resumen: {
      totalProductos,
      totalDisponible,
      totalComprometido,
      valorizacionTotal,
      sinStock,
      proveedoresActivos,
    },
    inventarioReciente,
    movimientosRecientes,
    comprasRecientes,
  }
}

const InventarioDashboardPage = async () => {
  const session = await getServerSession(authOptions)

  try {
    await asegurarPermiso(session, 'inventario.ver', { prismaClient: prisma })
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return (
        <Alert className="mt-6">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <AlertTitle>Sesión requerida</AlertTitle>
          <AlertDescription>
            Debes iniciar sesión nuevamente para acceder al panel de inventario.
          </AlertDescription>
        </Alert>
      )
    }

    if (error instanceof PermisoDenegadoError) {
      return (
        <Alert className="mt-6">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>No cuentas con permisos para visualizar el módulo de inventario.</AlertDescription>
        </Alert>
      )
    }

    throw error
  }

  const { resumen, inventarioReciente, movimientosRecientes, comprasRecientes } = await getDashboardData()

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario (versión básica)</h1>
          <p className="text-sm text-muted-foreground">
            Conecta compras y movimientos rápidos mientras iteramos la experiencia completa.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Productos con inventario</p>
          <p className="mt-2 text-2xl font-semibold">{integerFormatter.format(resumen.totalProductos)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Stock disponible</p>
          <p className="mt-2 text-2xl font-semibold">{decimalFormatter.format(resumen.totalDisponible)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Stock comprometido</p>
          <p className="mt-2 text-2xl font-semibold">{decimalFormatter.format(resumen.totalComprometido)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Valorización total</p>
          <p className="mt-2 text-2xl font-semibold">{moneyFormatter.format(resumen.valorizacionTotal)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Proveedores activos</p>
          <p className="mt-2 text-2xl font-semibold">{integerFormatter.format(resumen.proveedoresActivos)}</p>
          <p className="text-xs text-muted-foreground">{resumen.sinStock} producto(s) sin stock.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <MovimientoQuickForm />
        <CompraRapidaForm />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Inventario actualizado</h2>
          <p className="text-sm text-muted-foreground">Últimos registros recalculados con el flujo simplificado.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Producto</th>
                  <th className="py-2 pr-4 text-right">Disponible</th>
                  <th className="py-2 pr-4 text-right">Comprometido</th>
                  <th className="py-2 pr-4 text-right">Costo promedio</th>
                  <th className="py-2 pr-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inventarioReciente.length === 0 ? (
                  <tr>
                    <td className="py-4 text-muted-foreground" colSpan={5}>
                      Registra una compra o un ajuste para generar el primer inventario.
                    </td>
                  </tr>
                ) : (
                  inventarioReciente.map((item) => (
                    <tr key={item.id_inventario}>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{item.producto?.nombre ?? `Producto #${item.id_producto}`}</div>
                        <div className="text-xs text-muted-foreground">#{item.producto?.codigo_producto ?? item.id_producto}</div>
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold">
                        {decimalFormatter.format(item.stock_disponible.toNumber())}
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {decimalFormatter.format(item.stock_comprometido.toNumber())}
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">
                        {moneyFormatter.format(item.costo_promedio.toNumber())}
                      </td>
                      <td className="py-2 text-center">
                        <ProductoStockDrawer productoId={item.id_producto} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Compras recientes</h2>
          <p className="text-sm text-muted-foreground">Últimos registros creados con el endpoint simplificado.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Proveedor</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comprasRecientes.length === 0 ? (
                  <tr>
                    <td className="py-4 text-muted-foreground" colSpan={3}>
                      Aún no se registran compras en el módulo simplificado.
                    </td>
                  </tr>
                ) : (
                  comprasRecientes.map((compra) => (
                    <tr key={compra.id_compra}>
                      <td className="py-2 pr-4 text-muted-foreground">{formatDateTime(compra.fecha)}</td>
                      <td className="py-2 pr-4">
                        <span className="font-medium">{compra.proveedor?.razon_social ?? 'Proveedor sin nombre'}</span>
                        <span className="ml-1 text-xs text-muted-foreground">#{compra.id_compra}</span>
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold">
                        {moneyFormatter.format(compra.total.toNumber())}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Movimientos recientes</h2>
        <p className="text-sm text-muted-foreground">Vista rápida de salidas y ajustes registrados desde este panel.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Producto</th>
                <th className="py-2 pr-4 text-right">Cantidad</th>
                <th className="py-2 pr-4">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movimientosRecientes.length === 0 ? (
                <tr>
                  <td className="py-4 text-muted-foreground" colSpan={5}>
                    Registra una salida o ajuste para comenzar a poblar el historial.
                  </td>
                </tr>
              ) : (
                movimientosRecientes.map((movimiento) => (
                  <tr key={movimiento.id_movimiento}>
                    <td className="py-2 pr-4 text-muted-foreground">{formatDateTime(movimiento.creado_en)}</td>
                    <td className="py-2 pr-4 font-medium">{movimiento.tipo}</td>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{movimiento.producto?.nombre ?? `Producto #${movimiento.id_producto}`}</span>
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold">
                      {decimalFormatter.format(decimalToNumber(movimiento.cantidad))}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {movimiento.usuario?.nombre_usuario ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default InventarioDashboardPage
