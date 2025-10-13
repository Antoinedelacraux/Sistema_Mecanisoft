import {
  setPermisosDeRol,
  obtenerPermisosResueltosDeUsuario,
  setPermisosPersonalizadosDeUsuario,
  verificarPermiso
} from '@/lib/permisos/service'

const buildPermiso = (overrides: Partial<ReturnType<typeof permisoBase>> = {}) => ({
  ...permisoBase(),
  ...overrides
})

function permisoBase() {
  return {
    id_permiso: 1,
    codigo: 'clientes.listar',
    nombre: 'Listar clientes',
    descripcion: 'Puede listar clientes',
    modulo: 'clientes',
    agrupador: 'gestion_clientes',
    activo: true,
    creado_en: new Date(),
    actualizado_en: new Date()
  }
}

type PrismaMock = ReturnType<typeof createPrismaMock>

describe('permisos/service', () => {
  let prisma: PrismaMock

  beforeEach(() => {
    prisma = createPrismaMock()
  })

  it('setPermisosDeRol sincroniza correctamente los permisos del rol', async () => {
    const permisos = [
      buildPermiso({ id_permiso: 10, codigo: 'clientes.listar' }),
      buildPermiso({ id_permiso: 11, codigo: 'clientes.editar' })
    ]

    prisma.permiso.findMany.mockResolvedValue(permisos)

    await setPermisosDeRol({
      idRol: 2,
      codigosPermisos: ['clientes.listar', 'clientes.editar'],
      usuarioActorId: 99,
      prismaClient: prisma as any
    })

    expect(prisma.permiso.findMany).toHaveBeenCalledWith({
      where: { codigo: { in: ['clientes.listar', 'clientes.editar'] } }
    })
    expect(prisma.rolPermiso.deleteMany).toHaveBeenCalledWith({
      where: {
        id_rol: 2,
        id_permiso: { notIn: [10, 11] }
      }
    })
    expect(prisma.rolPermiso.createMany).toHaveBeenCalledWith({
      data: [
        { id_rol: 2, id_permiso: 10 },
        { id_rol: 2, id_permiso: 11 }
      ],
      skipDuplicates: true
    })
    expect(prisma.bitacora.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id_usuario: 99,
          accion: 'ROL_PERMISOS_ACTUALIZADO'
        })
      })
    )
  })

  it('obtenerPermisosResueltosDeUsuario combina base y personalizaciones', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      id_rol: 5,
      permisos: [
        {
          concedido: false,
          origen: 'REVOCADO_MANUAL',
          comentario: 'No debe acceder',
          permiso: buildPermiso({ id_permiso: 11, codigo: 'clientes.editar' })
        },
        {
          concedido: true,
          origen: 'EXTRA',
          comentario: null,
          permiso: buildPermiso({ id_permiso: 50, codigo: 'inventario.ver' })
        }
      ]
    })

    prisma.rolPermiso.findMany.mockResolvedValue([
      {
        id_rol: 5,
        id_permiso: 11,
        creado_en: new Date(),
        permiso: buildPermiso({ id_permiso: 11, codigo: 'clientes.editar' })
      },
      {
        id_rol: 5,
        id_permiso: 12,
        creado_en: new Date(),
        permiso: buildPermiso({ id_permiso: 12, codigo: 'clientes.listar' })
      }
    ])

    const resultado = await obtenerPermisosResueltosDeUsuario(1, prisma as any)

    expect(resultado).toEqual([
      expect.objectContaining({
        codigo: 'clientes.editar',
        concedido: false,
        fuente: 'REVOCADO'
      }),
      expect.objectContaining({
        codigo: 'clientes.listar',
        concedido: true,
        fuente: 'ROL'
      }),
      expect.objectContaining({
        codigo: 'inventario.ver',
        concedido: true,
        fuente: 'EXTRA'
      })
    ])
  })

  it('setPermisosPersonalizadosDeUsuario aplica upserts y limpia sobrantes', async () => {
    prisma.permiso.findMany.mockResolvedValue([
      buildPermiso({ id_permiso: 11, codigo: 'clientes.editar' }),
      buildPermiso({ id_permiso: 50, codigo: 'inventario.ver' })
    ])

    await setPermisosPersonalizadosDeUsuario({
      idUsuario: 7,
      usuarioActorId: 3,
      personalizaciones: [
        { codigo: 'clientes.editar', concedido: false, origen: 'REVOCADO_MANUAL' },
        { codigo: 'inventario.ver', concedido: true, origen: 'EXTRA_MANUAL', comentario: 'Puede revisar stock' }
      ],
      prismaClient: prisma as any
    })

    expect(prisma.usuarioPermiso.deleteMany).toHaveBeenCalledWith({
      where: {
        id_usuario: 7,
        id_permiso: { notIn: [11, 50] }
      }
    })

    expect(prisma.usuarioPermiso.upsert).toHaveBeenNthCalledWith(1, {
      where: {
        id_usuario_id_permiso: {
          id_usuario: 7,
          id_permiso: 11
        }
      },
      update: {
        concedido: false,
        origen: 'REVOCADO_MANUAL',
        comentario: null
      },
      create: {
        id_usuario: 7,
        id_permiso: 11,
        concedido: false,
        origen: 'REVOCADO_MANUAL',
        comentario: null
      }
    })

    expect(prisma.usuarioPermiso.upsert).toHaveBeenNthCalledWith(2, {
      where: {
        id_usuario_id_permiso: {
          id_usuario: 7,
          id_permiso: 50
        }
      },
      update: {
        concedido: true,
        origen: 'EXTRA_MANUAL',
        comentario: 'Puede revisar stock'
      },
      create: {
        id_usuario: 7,
        id_permiso: 50,
        concedido: true,
        origen: 'EXTRA_MANUAL',
        comentario: 'Puede revisar stock'
      }
    })
  })

  it('verificarPermiso respeta overrides y permisos base', async () => {
    prisma.permiso.findUnique.mockResolvedValue({ id_permiso: 77 })

    prisma.usuarioPermiso.findUnique.mockResolvedValueOnce({ concedido: false })

    const deny = await verificarPermiso({
      idUsuario: 15,
      codigoPermiso: 'ordenes.crear',
      prismaClient: prisma as any
    })

    expect(deny).toBe(false)

    prisma.usuarioPermiso.findUnique.mockResolvedValueOnce(null)
    prisma.usuario.findUnique.mockResolvedValueOnce({ id_rol: 4 })
    prisma.rolPermiso.findUnique.mockResolvedValueOnce({ id_permiso: 77 })

    const allow = await verificarPermiso({
      idUsuario: 15,
      codigoPermiso: 'ordenes.crear',
      prismaClient: prisma as any
    })

    expect(allow).toBe(true)
  })
})

function createPrismaMock() {
  const permiso = {
    findMany: jest.fn(),
    findUnique: jest.fn()
  }

  const rolPermiso = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn()
  }

  const usuario = {
    findUnique: jest.fn()
  }

  const usuarioPermiso = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    upsert: jest.fn()
  }

  const bitacora = {
    create: jest.fn()
  }

  const tx = {
    rolPermiso,
    usuarioPermiso,
    bitacora,
    usuario
  }

  return {
    permiso,
    rolPermiso,
    usuario,
    usuarioPermiso,
    bitacora,
    $transaction: jest.fn(async (fn: (tx: any) => Promise<void> | void) => {
      await fn(tx)
    })
  }
}
