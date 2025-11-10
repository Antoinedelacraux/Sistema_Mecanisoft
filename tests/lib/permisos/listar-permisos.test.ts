import { listarPermisosPorModulo, clearPermisosPorModuloCache } from '@/lib/permisos/service'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => {
  const modulo = {
    findMany: jest.fn()
  }

  return {
    __esModule: true,
    prisma: {
      modulo
    }
  }
})

describe('listarPermisosPorModulo cache', () => {
  const getModuloFindManyMock = () => prisma.modulo.findMany as jest.Mock

  beforeEach(() => {
    clearPermisosPorModuloCache()
    getModuloFindManyMock().mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const buildPermiso = (overrides: Partial<any> = {}) => ({
    id_permiso: 1,
    codigo: 'usuarios.ver',
    nombre: 'Ver usuarios',
    descripcion: null,
    modulo: 'usuarios',
    agrupador: null,
    activo: true,
    creado_en: new Date('2025-11-08T00:00:00Z'),
    actualizado_en: new Date('2025-11-08T00:00:00Z'),
    ...overrides
  })

  it('utiliza cache en llamadas consecutivas dentro del TTL', async () => {
    jest.useFakeTimers({ now: new Date('2025-11-08T00:00:00Z') })

    getModuloFindManyMock().mockResolvedValue([
      {
        clave: 'usuarios',
        nombre: 'Usuarios',
        descripcion: 'Gestión de usuarios',
        permisos: [buildPermiso()]
      }
    ])

    const first = await listarPermisosPorModulo()
    const second = await listarPermisosPorModulo()

    expect(getModuloFindManyMock()).toHaveBeenCalledTimes(1)
    expect(second).toEqual(first)
  })

  it('rehidrata la cache cuando expira el TTL', async () => {
    jest.useFakeTimers({ now: new Date('2025-11-08T00:00:00Z') })

    const firstResult = [
      {
        clave: 'usuarios',
        nombre: 'Usuarios',
        descripcion: 'Gestión de usuarios',
        permisos: [buildPermiso({ codigo: 'usuarios.ver' })]
      }
    ]

    const secondResult = [
      {
        clave: 'inventario',
        nombre: 'Inventario',
        descripcion: 'Gestión de stock',
        permisos: [buildPermiso({ id_permiso: 2, codigo: 'inventario.ver', modulo: 'inventario' })]
      }
    ]

    getModuloFindManyMock()
      .mockResolvedValueOnce(firstResult)
      .mockResolvedValueOnce(secondResult)

    const first = await listarPermisosPorModulo()
    expect(first[0].clave).toBe('usuarios')
    expect(first[0].permisos[0].codigo).toBe('usuarios.ver')
    expect(getModuloFindManyMock()).toHaveBeenCalledTimes(1)

    jest.setSystemTime(Date.now() + 5 * 60 * 1000 + 1)

    const second = await listarPermisosPorModulo()

    expect(getModuloFindManyMock()).toHaveBeenCalledTimes(2)
    expect(second[0].clave).toBe('inventario')
    expect(second[0].permisos[0].codigo).toBe('inventario.ver')
  })
})
