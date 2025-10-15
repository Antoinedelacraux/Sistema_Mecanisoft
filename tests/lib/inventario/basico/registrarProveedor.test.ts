/// <reference types="jest" />

import { TipoDocumento } from '@prisma/client'

import { registrarProveedor, InventarioBasicoError } from '@/lib/inventario/basico'

type PersonaRecord = {
  id_persona: number
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  tipo_documento: TipoDocumento
  numero_documento: string
  telefono: string | null
  correo: string | null
  nombre_comercial: string | null
  proveedor: { id_proveedor: number } | null
}

type ProveedorRecord = {
  id_proveedor: number
  razon_social: string
  contacto: string | null
  numero_contacto: string | null
  persona: {
    telefono: string | null
    correo: string | null
    nombre_comercial: string | null
    numero_documento: string | null
  } | null
}

type TransactionClientMock = {
  persona: {
    findUnique: jest.Mock<Promise<PersonaRecord | null>, [unknown?]>
    create: jest.Mock<Promise<PersonaRecord>, [unknown]>
    update: jest.Mock<Promise<PersonaRecord>, [unknown]>
  }
  proveedor: {
    create: jest.Mock<Promise<ProveedorRecord>, [unknown]>
  }
  bitacora: {
    create: jest.Mock<Promise<unknown>, [unknown]>
  }
}

type PrismaMock = {
  $transaction: jest.Mock<Promise<unknown>, [(tx: TransactionClientMock) => unknown | Promise<unknown>]>
  __tx: TransactionClientMock
}

jest.mock('@/lib/prisma', () => {
  const transactionClient: TransactionClientMock = {
    persona: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    proveedor: {
      create: jest.fn(),
    },
    bitacora: {
      create: jest.fn(),
    },
  }

  const prismaMock: PrismaMock = {
    $transaction: jest.fn(async (callback) => callback(transactionClient)),
    __tx: transactionClient,
  }

  return { prisma: prismaMock }
})

const getMocks = () => {
  const { prisma } = jest.requireMock('@/lib/prisma') as { prisma: PrismaMock }
  return { prisma, tx: prisma.__tx }
}

describe('registrarProveedor (inventario basico)', () => {
  beforeEach(() => {
    const { prisma, tx } = getMocks()
    jest.clearAllMocks()
    prisma.$transaction.mockImplementation(async (callback) => callback(tx))
    tx.persona.findUnique.mockReset()
    tx.persona.create.mockReset()
    tx.persona.update.mockReset()
    tx.proveedor.create.mockReset()
    tx.bitacora.create.mockReset()
  })

  it('crea un proveedor nuevo utilizando el RUC proporcionado', async () => {
    const { tx } = getMocks()

    tx.persona.findUnique.mockResolvedValue(null)
    tx.persona.create.mockResolvedValue({
      id_persona: 15,
      nombre: 'Proveedor',
      apellido_paterno: 'Demo',
      apellido_materno: null,
      tipo_documento: TipoDocumento.RUC,
      numero_documento: '20601234567',
      telefono: '+51911111111',
      correo: 'ventas@demo.com',
      nombre_comercial: 'Demo',
      proveedor: null,
    })

    tx.proveedor.create.mockResolvedValue({
      id_proveedor: 27,
      razon_social: 'Proveedor Demo SAC',
      contacto: 'Soporte',
      numero_contacto: '+51933333333',
      persona: {
        telefono: '+51911111111',
        correo: 'ventas@demo.com',
        nombre_comercial: 'Demo',
        numero_documento: '20601234567',
      },
    })

    tx.bitacora.create.mockResolvedValue({})

    const result = await registrarProveedor({
      nombre: 'Proveedor Demo SAC',
      ruc: '20601234567',
      contacto: 'Soporte',
      numero_contacto: '+51933333333',
      telefono: '+51911111111',
      correo: 'ventas@demo.com',
      nombre_comercial: 'Demo',
      creado_por: 1,
    })

    expect(tx.persona.findUnique).toHaveBeenCalledWith({
      where: { numero_documento: '20601234567' },
      include: { proveedor: true },
    })
    expect(tx.persona.create).toHaveBeenCalled()
    expect(tx.proveedor.create).toHaveBeenCalled()
    expect(tx.bitacora.create).toHaveBeenCalled()
    expect(result).toEqual({
      id_proveedor: 27,
      razon_social: 'Proveedor Demo SAC',
      contacto: 'Soporte',
      numero_contacto: '+51933333333',
      telefono: '+51911111111',
      correo: 'ventas@demo.com',
      nombre_comercial: 'Demo',
      ruc: '20601234567',
    })
  })

  it('rechaza la creacion cuando el RUC ya existe para un proveedor', async () => {
    const { tx } = getMocks()

    tx.persona.findUnique.mockResolvedValue({
      id_persona: 10,
      nombre: 'Proveedor',
      apellido_paterno: 'Duplicado',
      apellido_materno: null,
      tipo_documento: TipoDocumento.RUC,
      numero_documento: '20601234567',
      telefono: null,
      correo: null,
      nombre_comercial: null,
      proveedor: { id_proveedor: 5 },
    })

    await expect(
      registrarProveedor({
        nombre: 'Proveedor Demo',
        ruc: '20601234567',
        contacto: null,
        numero_contacto: null,
        telefono: null,
        correo: null,
        nombre_comercial: null,
        creado_por: 1,
      }),
    ).rejects.toMatchObject({ code: 'PROVEEDOR_DUPLICADO' })

    expect(tx.proveedor.create).not.toHaveBeenCalled()
  })

  it('valida que el nombre sea obligatorio', async () => {
    await expect(
      registrarProveedor({
        nombre: '   ',
        ruc: '',
        contacto: null,
        numero_contacto: null,
        telefono: null,
        correo: null,
        nombre_comercial: null,
        creado_por: 1,
      }),
    ).rejects.toBeInstanceOf(InventarioBasicoError)
  })
})
