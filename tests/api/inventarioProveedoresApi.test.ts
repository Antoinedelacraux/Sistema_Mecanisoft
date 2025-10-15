/// <reference types="jest" />

import { getServerSession } from 'next-auth/next'

import { asegurarPermiso, PermisoDenegadoError } from '@/lib/permisos/guards'
import { registrarProveedor, InventarioBasicoError } from '@/lib/inventario/basico'

type ProveedoresRouteModule = typeof import('../../src/app/api/inventario/proveedores/route')

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/prisma', () => {
  const transaction = {
    proveedor: {
      findMany: jest.fn(),
    },
  }

  const prismaMock = {
    proveedor: transaction.proveedor,
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  }

  return { prisma: prismaMock }
})

jest.mock('@/lib/permisos/guards', () => ({
  asegurarPermiso: jest.fn(),
  PermisoDenegadoError: class extends Error {
    codigoPermiso: string
    constructor(message: string, codigoPermiso: string = 'inventario.ver') {
      super(message)
      this.codigoPermiso = codigoPermiso
    }
  },
  SesionInvalidaError: class extends Error {},
}))

jest.mock('@/lib/inventario/basico', () => {
  const actual = jest.requireActual('@/lib/inventario/basico')
  return {
    ...actual,
    registrarProveedor: jest.fn(),
  }
})

jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
        const headers = new Map<string, string>()
        if (init?.headers) {
          Object.entries(init.headers).forEach(([key, value]) => {
            headers.set(key.toLowerCase(), value)
          })
        }

        return {
          status: init?.status ?? 200,
          headers: {
            get: (key: string) => headers.get(key.toLowerCase()) ?? null,
            set: (key: string, value: string) => headers.set(key.toLowerCase(), value),
          },
          body,
          async json() {
            return body
          },
        }
      },
    },
  }
})

type PrismaMock = {
  proveedor: {
    findMany: jest.Mock
  }
  $transaction: jest.Mock
}

const getSessionMock = () => getServerSession as jest.Mock
const getPermisoMock = () => asegurarPermiso as jest.Mock
const getRegistrarProveedorMock = () => registrarProveedor as jest.Mock
const getPrismaMock = () => (jest.requireMock('@/lib/prisma') as { prisma: PrismaMock }).prisma

const buildSession = (id: string = '1') => ({ user: { id, role: 'Administrador' } })

const buildProveedor = () => ({
  id_proveedor: 3,
  razon_social: 'Proveedor Demo SAC',
  contacto: 'Compras',
  numero_contacto: '+51900111222',
  persona: {
    correo: 'compras@demo.com',
    telefono: '+51999111222',
    nombre_comercial: 'Proveedor Demo',
    numero_documento: '20601234567',
  },
})

const buildRequest = (url: string, init?: { method?: string; body?: Record<string, unknown> }) => {
  const body = init?.body
  return {
    method: init?.method ?? 'GET',
    nextUrl: new URL(url),
    async json() {
      if (body === undefined) {
        throw new Error('Body not provided')
      }
      return body
    },
  } as unknown
}

let GET!: ProveedoresRouteModule['GET']
let POST!: ProveedoresRouteModule['POST']

beforeAll(async () => {
  const module: ProveedoresRouteModule = await import('../../src/app/api/inventario/proveedores/route')
  GET = module.GET
  POST = module.POST
})

describe('API /api/inventario/proveedores', () => {
  beforeEach(() => {
    const prisma = getPrismaMock()
    prisma.proveedor.findMany.mockReset()
    prisma.$transaction.mockClear()
    getSessionMock().mockReset()
    getPermisoMock().mockReset()
    getRegistrarProveedorMock().mockReset()
  })

  it('GET responde 401 cuando no hay sesión', async () => {
  const request = buildRequest('http://localhost/api/inventario/proveedores')
    getSessionMock().mockResolvedValue(null)

  const response = await GET(request as never)
    expect(response.status).toBe(401)
  })

  it('GET responde 403 cuando el permiso es denegado', async () => {
  const request = buildRequest('http://localhost/api/inventario/proveedores')
    getSessionMock().mockResolvedValue(buildSession())
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('Sin permiso', 'inventario.ver'))

  const response = await GET(request as never)
    expect(response.status).toBe(403)
  })

  it('GET retorna la lista de proveedores', async () => {
    const prisma = getPrismaMock()
    const registro = buildProveedor()

    getSessionMock().mockResolvedValue(buildSession())
    getPermisoMock().mockResolvedValue(undefined)
    prisma.proveedor.findMany.mockResolvedValue([registro])

  const request = buildRequest('http://localhost/api/inventario/proveedores?q=demo&limit=5')
  const response = await GET(request as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.proveedores).toHaveLength(1)
    expect(json.proveedores[0].razon_social).toBe('Proveedor Demo SAC')
    expect(prisma.proveedor.findMany).toHaveBeenCalled()
  })

  it('POST responde 401 sin sesión', async () => {
    const request = buildRequest('http://localhost/api/inventario/proveedores', {
      method: 'POST',
      body: { nombre: 'Proveedor Demo' },
    })
    getSessionMock().mockResolvedValue(null)

  const response = await POST(request as never)
    expect(response.status).toBe(401)
  })

  it('POST responde 403 cuando el permiso es denegado', async () => {
    const request = buildRequest('http://localhost/api/inventario/proveedores', {
      method: 'POST',
      body: { nombre: 'Proveedor Demo' },
    })
    getSessionMock().mockResolvedValue(buildSession())
    getPermisoMock().mockRejectedValue(new PermisoDenegadoError('Sin permiso', 'inventario.compras'))

  const response = await POST(request as never)
    expect(response.status).toBe(403)
  })

  it('POST valida el payload y retorna 400 cuando faltan datos', async () => {
    const request = buildRequest('http://localhost/api/inventario/proveedores', {
      method: 'POST',
      body: { nombre: '' },
    })
    getSessionMock().mockResolvedValue(buildSession())
    getPermisoMock().mockResolvedValue(undefined)

  const response = await POST(request as never)
    expect(response.status).toBe(400)
    expect(getRegistrarProveedorMock()).not.toHaveBeenCalled()
  })

  it('POST registra un proveedor y retorna 201', async () => {
    const proveedor = {
      id_proveedor: 12,
      razon_social: 'Proveedor Demo SAC',
      contacto: 'Soporte',
      numero_contacto: '+51900111222',
      telefono: '+51911111111',
      correo: 'ventas@demo.com',
      nombre_comercial: 'Proveedor Demo',
      ruc: '20601234567',
    }

    const request = buildRequest('http://localhost/api/inventario/proveedores', {
      method: 'POST',
      body: {
        nombre: 'Proveedor Demo SAC',
        ruc: '20601234567',
        contacto: 'Soporte',
        numero_contacto: '+51900111222',
        telefono: '+51911111111',
        correo: 'ventas@demo.com',
        nombre_comercial: 'Proveedor Demo',
      },
    })

    getSessionMock().mockResolvedValue(buildSession('42'))
    getPermisoMock().mockResolvedValue(undefined)
    getRegistrarProveedorMock().mockResolvedValue(proveedor)

  const response = await POST(request as never)
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(json.proveedor).toEqual(proveedor)
    expect(getRegistrarProveedorMock()).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Proveedor Demo SAC',
      creado_por: 42,
    }))
  })

  it('POST propaga errores de dominio', async () => {
    const request = buildRequest('http://localhost/api/inventario/proveedores', {
      method: 'POST',
      body: { nombre: 'Proveedor Demo', ruc: '20601234567' },
    })

    getSessionMock().mockResolvedValue(buildSession())
    getPermisoMock().mockResolvedValue(undefined)
    getRegistrarProveedorMock().mockRejectedValue(new InventarioBasicoError('Duplicado', 409, 'PROVEEDOR_DUPLICADO'))

  const response = await POST(request as never)
    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json.code).toBe('PROVEEDOR_DUPLICADO')
  })

  it('POST retorna 401 cuando la sesión carece de id válido', async () => {
    const request = buildRequest('http://localhost/api/inventario/proveedores', {
      method: 'POST',
      body: { nombre: 'Proveedor Demo', ruc: '20601234567' },
    })

    getSessionMock().mockResolvedValue({ user: { id: 'NaN', role: 'Administrador' } })
    getPermisoMock().mockResolvedValue(undefined)

  const response = await POST(request as never)
    expect(response.status).toBe(401)
  })
})
