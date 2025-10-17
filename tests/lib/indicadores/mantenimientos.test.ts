import {
  getAvgTimePerJob,
  getCoverage,
  getCsat,
  getOnSchedule,
  getOnTimeClose,
  getReworkRate,
  getRescheduleRate,
  getStockCritical,
  getTechnicianUtilization
} from '@/lib/indicadores/mantenimientos'

jest.mock('@/lib/prisma', () => {
  const vehiculoCount = jest.fn()
  const mantenimientoFindMany = jest.fn()
  const mantenimientoHistorialFindMany = jest.fn()
  const tareaFindMany = jest.fn()
  const transaccionFindMany = jest.fn()
  const inventarioProductoFindMany = jest.fn()
  const feedbackFindMany = jest.fn()
  const queryRaw = jest.fn()
  const indicadorCacheFindUnique = jest.fn()
  const indicadorCacheUpsert = jest.fn()

  return {
    prisma: {
      vehiculo: {
        count: vehiculoCount
      },
      mantenimiento: {
        findMany: mantenimientoFindMany
      },
      mantenimientoHistorial: {
        findMany: mantenimientoHistorialFindMany
      },
      tarea: {
        findMany: tareaFindMany
      },
      transaccion: {
        findMany: transaccionFindMany
      },
        inventarioProducto: {
          findMany: inventarioProductoFindMany
        },
        feedback: {
          findMany: feedbackFindMany
        },
      indicadorCache: {
        findUnique: indicadorCacheFindUnique,
        upsert: indicadorCacheUpsert
      },
      $queryRaw: queryRaw
    }
  }
})

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    vehiculo: { count: jest.Mock }
    mantenimiento: { findMany: jest.Mock }
    mantenimientoHistorial: { findMany: jest.Mock }
    tarea: { findMany: jest.Mock }
    transaccion: { findMany: jest.Mock }
    inventarioProducto: { findMany: jest.Mock }
    feedback: { findMany: jest.Mock }
    indicadorCache: { findUnique: jest.Mock; upsert: jest.Mock }
    $queryRaw: jest.Mock
  }
}

describe('Indicadores de mantenimientos', () => {
  const from = new Date('2025-01-01T00:00:00Z')
  const to = new Date('2025-01-31T23:59:59Z')

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.indicadorCache.findUnique.mockResolvedValue(null)
    prisma.indicadorCache.upsert.mockResolvedValue(null)
    prisma.mantenimiento.findMany.mockResolvedValue([])
    prisma.mantenimientoHistorial.findMany.mockResolvedValue([])
    prisma.tarea.findMany.mockResolvedValue([])
    prisma.transaccion.findMany.mockResolvedValue([])
    prisma.inventarioProducto.findMany.mockResolvedValue([])
    prisma.feedback.findMany.mockResolvedValue([])
  })

  it('calcula cobertura de programaciones', async () => {
    prisma.vehiculo.count.mockResolvedValueOnce(100)
    prisma.$queryRaw.mockResolvedValueOnce([{ total: BigInt(65) }])

    const result = await getCoverage(from, to)
    expect(result.coverageRate).toBeCloseTo(65)
    expect(result.totalVehiculos).toBe(100)
    expect(result.vehiculosProgramados).toBe(65)
  })

  it('calcula indicador on-schedule con ventana configurable', async () => {
    prisma.mantenimiento.findMany.mockResolvedValueOnce([
      {
        id_mantenimiento: 1,
        fecha_programada: new Date('2025-01-10T10:00:00Z'),
        fecha_realizada: new Date('2025-01-11T10:00:00Z')
      },
      {
        id_mantenimiento: 2,
        fecha_programada: new Date('2025-01-12T10:00:00Z'),
        fecha_realizada: new Date('2025-01-18T10:00:00Z')
      }
    ])

    prisma.mantenimientoHistorial.findMany.mockResolvedValueOnce([
      { mantenimiento_id: 1 },
      { mantenimiento_id: 1 },
      { mantenimiento_id: 2 }
    ])

    const result = await getOnSchedule(from, to, 2)
    expect(result.totalCompletados).toBe(2)
    expect(result.completadosDentroVentana).toBe(1)
    expect(result.reprogramados).toBe(2)
  })

  it('agrega utilización de técnicos', async () => {
    prisma.tarea.findMany.mockResolvedValueOnce([
      {
        id_trabajador: 10,
        fecha_inicio: new Date('2025-01-05T09:00:00Z'),
        fecha_fin: new Date('2025-01-05T13:00:00Z'),
        tiempo_estimado: 240,
        tiempo_real: null,
        trabajador: {
          persona: {
            nombre: 'Ana',
            apellido_paterno: 'Ramirez',
            apellido_materno: 'Lopez'
          }
        }
      },
      {
        id_trabajador: 10,
        fecha_inicio: null,
        fecha_fin: null,
        tiempo_estimado: 180,
        tiempo_real: null,
        trabajador: {
          persona: {
            nombre: 'Ana',
            apellido_paterno: 'Ramirez',
            apellido_materno: 'Lopez'
          }
        }
      },
      {
        id_trabajador: 11,
        fecha_inicio: new Date('2025-01-15T08:00:00Z'),
        fecha_fin: new Date('2025-01-15T12:30:00Z'),
        tiempo_estimado: 0,
        tiempo_real: 270,
        trabajador: {
          persona: {
            nombre: 'Luis',
            apellido_paterno: 'Perez',
            apellido_materno: 'Soto'
          }
        }
      }
    ])

    const result = await getTechnicianUtilization(from, to)
    expect(result.items).toHaveLength(2)
    const ana = result.items.find((item) => item.trabajadorId === 10)
    expect(ana?.tareas).toBe(2)
    expect(ana?.minutosAsignados).toBeGreaterThan(0)
    expect(result.promedioUtilizacion).toBeGreaterThan(0)
  })

  it('calcula indicador de cierre a tiempo con SLA', async () => {
    prisma.transaccion.findMany.mockResolvedValueOnce([
      {
        prioridad: 'alta',
        fecha: new Date('2025-01-02T10:00:00Z'),
        fecha_cierre: new Date('2025-01-03T09:00:00Z')
      },
      {
        prioridad: 'media',
        fecha: new Date('2025-01-05T08:00:00Z'),
        fecha_cierre: new Date('2025-01-07T10:00:00Z')
      }
    ])

    const result = await getOnTimeClose(from, to, { alta: 24, media: 60 })
    expect(result.totalCerradas).toBe(2)
    expect(result.cerradasDentroSla).toBe(2)
    expect(result.breakdown.alta?.dentroSla).toBe(1)
    expect(result.breakdown.media?.dentroSla).toBe(1)
  })

  it('calcula tasa de reprogramación', async () => {
    prisma.mantenimiento.findMany.mockResolvedValueOnce([
      { id_mantenimiento: 1 },
      { id_mantenimiento: 2 }
    ])

    prisma.mantenimientoHistorial.findMany.mockResolvedValueOnce([
      { mantenimiento_id: 1, reason: 'Cliente solicitó cambio' },
      { mantenimiento_id: 1, reason: 'Cliente solicitó cambio' },
      { mantenimiento_id: 2, reason: null }
    ])

    const result = await getRescheduleRate(from, to)
    expect(result.rescheduleRate).toBeCloseTo(100)
    expect(result.topReasons[0]).toEqual({ reason: 'Cliente solicitó cambio', count: 2 })
  })

  it('agrega duración promedio por servicio', async () => {
    prisma.tarea.findMany.mockResolvedValueOnce([
      {
        fecha_inicio: new Date('2025-01-02T08:00:00Z'),
        fecha_fin: new Date('2025-01-02T10:00:00Z'),
        tiempo_estimado: null,
        tiempo_real: null,
        detalle_transaccion: {
          id_servicio: 1,
          servicio: { id_servicio: 1, nombre: 'Alineación' }
        }
      },
      {
        fecha_inicio: null,
        fecha_fin: null,
        tiempo_estimado: 120,
        tiempo_real: null,
        detalle_transaccion: {
          id_servicio: 2,
          servicio: { id_servicio: 2, nombre: 'Balanceo' }
        }
      }
    ])

    const result = await getAvgTimePerJob(from, to, 5)
    expect(result.items).toHaveLength(2)
    expect(result.items[0].servicioNombre).toBe('Alineación')
    expect(result.promedioGlobal).toBeGreaterThan(0)
    expect(result.totalServicios).toBe(2)
  })

  it('resume estado de repuestos críticos', async () => {
    prisma.inventarioProducto.findMany.mockResolvedValueOnce([
      {
        id_inventario_producto: 1,
        stock_disponible: 2,
        stock_minimo: 5,
        almacen: { nombre: 'Central' },
        producto: { id_producto: 10, codigo_producto: 'PRD-1', nombre: 'Filtro de aceite' }
      },
      {
        id_inventario_producto: 2,
        stock_disponible: 8,
        stock_minimo: 4,
        almacen: { nombre: 'Central' },
        producto: { id_producto: 11, codigo_producto: 'PRD-2', nombre: 'Pastillas de freno' }
      }
    ])

    const result = await getStockCritical(from, to, 5)
    expect(result.totalCriticos).toBe(2)
    expect(result.bajoNivel).toBe(1)
    expect(result.items[0].nivel).toBe('bajo')
  })

  it('calcula tasa de retrabajo', async () => {
    prisma.transaccion.findMany.mockResolvedValueOnce([
      {
        id_transaccion: 1,
        codigo_transaccion: 'ORD-100',
        prioridad: 'alta',
        historial: [
          { new_status: 'completado', created_at: new Date('2025-01-05T10:00:00Z') },
          { new_status: 'en_proceso', created_at: new Date('2025-01-06T09:00:00Z') },
          { new_status: 'completado', created_at: new Date('2025-01-07T12:00:00Z') }
        ]
      },
      {
        id_transaccion: 2,
        codigo_transaccion: 'ORD-200',
        prioridad: 'media',
        historial: [{ new_status: 'completado', created_at: new Date('2025-01-04T12:00:00Z') }]
      }
    ])

    const result = await getReworkRate(from, to, 5)
    expect(result.reabiertas).toBe(1)
    expect(result.items[0].reaperturas).toBe(1)
  })

  it('resume satisfacción del cliente', async () => {
    prisma.feedback.findMany.mockResolvedValueOnce([
      { score: 5 },
      { score: 4 },
      { score: 4 }
    ])

    const result = await getCsat(from, to)
    expect(result.promedio).toBeCloseTo(4.33, 2)
    const scoreFour = result.breakdown.find((item) => item.score === 4)
    expect(scoreFour?.total).toBe(2)
  })
})
