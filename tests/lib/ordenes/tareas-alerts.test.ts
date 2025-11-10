/// <reference types="jest" />

const mockFindMany = jest.fn()
const mockSendMail = jest.fn()
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

const originalFetch = global.fetch
const mockFetch = jest.fn()

global.fetch = mockFetch as unknown as typeof fetch

jest.mock('@/lib/prisma', () => ({
  prisma: {
    tarea: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

jest.mock('@/lib/mailer', () => ({
  sendMail: (...args: unknown[]) => mockSendMail(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
  default: mockLogger,
}))

import { obtenerTareasPausadasCriticas, procesarAlertasTareasPausadas } from '@/lib/ordenes/tareas-alerts'

describe('procesarAlertasTareasPausadas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({ ok: true } as Response)
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('omite la alerta cuando no hay tareas críticas', async () => {
    mockFindMany.mockResolvedValue([])

    const resultado = await procesarAlertasTareasPausadas()

    expect(resultado).toEqual({ total: 0, notified: false, reason: 'NO_TASKS' })
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('omite la alerta cuando no hay destinatarios', async () => {
    mockFindMany.mockResolvedValue([
      {
        id_tarea: 1,
        updated_at: new Date('2025-01-01T00:00:00.000Z'),
        detalle_transaccion: {
          servicio: { nombre: 'Cambio de aceite' },
          transaccion: {
            codigo_transaccion: 'ORD-1',
            prioridad: 'alta',
            persona: {
              nombre: 'Ana',
              apellido_paterno: 'Pérez',
              apellido_materno: 'Ramos',
            },
          },
        },
        trabajador: {
          persona: {
            nombre: 'Carlos',
            apellido_paterno: 'Vega',
            apellido_materno: 'Lopez',
          },
        },
      },
    ])

    const resultado = await procesarAlertasTareasPausadas({ recipients: '', thresholdHours: 1 })

    expect(resultado.reason).toBe('NO_RECIPIENTS')
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it('envía correo y slack cuando hay tareas críticas', async () => {
    mockFindMany.mockResolvedValue([
      {
        id_tarea: 10,
        updated_at: new Date(Date.now() - 15 * 60 * 60 * 1000),
        detalle_transaccion: {
          servicio: { nombre: 'Alineación' },
          transaccion: {
            codigo_transaccion: 'ORD-99',
            prioridad: 'media',
            persona: {
              nombre: 'Luis',
              apellido_paterno: 'Soto',
              apellido_materno: 'Perez',
            },
          },
        },
        trabajador: {
          persona: {
            nombre: 'Mario',
            apellido_paterno: 'Rivas',
            apellido_materno: 'Torres',
          },
        },
      },
    ])

    const resultado = await procesarAlertasTareasPausadas({ recipients: 'ops@example.com', slackWebhook: 'https://hooks.slack.test/123' })

    expect(resultado.notified).toBe(true)
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ops@example.com' }))
    expect(mockFetch).toHaveBeenCalled()
  })
})

describe('obtenerTareasPausadasCriticas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('respeta el límite y ordena por fecha', async () => {
    const oldDate = new Date('2025-01-01T00:00:00.000Z')
    const recentDate = new Date('2025-01-05T00:00:00.000Z')

    mockFindMany.mockResolvedValue([
      {
        id_tarea: 1,
        updated_at: recentDate,
        detalle_transaccion: null,
        trabajador: null,
      },
      {
        id_tarea: 2,
        updated_at: oldDate,
        detalle_transaccion: null,
        trabajador: null,
      },
    ])

    const resultado = await obtenerTareasPausadasCriticas({ thresholdHours: 1, limit: 2 })

    expect(resultado.total).toBe(2)
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ updated_at: 'asc' }],
      take: 2,
    }))
  })
})
