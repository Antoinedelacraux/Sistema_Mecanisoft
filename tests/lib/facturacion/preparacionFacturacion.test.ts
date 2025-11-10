/// <reference types="jest" />

import { TipoItemComprobante } from '@prisma/client'

import { clearFacturacionConfigCache } from '@/lib/facturacion/config'
import { prepararCotizacionParaFacturacion } from '@/lib/facturacion/cotizaciones'
import { prepararOrdenParaFacturacion } from '@/lib/facturacion/ordenes'
import { FacturacionError } from '@/lib/facturacion/errors'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => {
  const cotizacion = {
    findUnique: jest.fn()
  }

  const transaccion = {
    findUnique: jest.fn()
  }

  const facturacionConfig = {
    findUnique: jest.fn()
  }

  const facturacionSerie = {
    findMany: jest.fn()
  }

  return {
    prisma: {
      cotizacion,
      transaccion,
      facturacionConfig,
      facturacionSerie
    }
  }
})

type AsyncMock<TValue = unknown, TArgs extends unknown[] = any[]> = jest.Mock<Promise<TValue>, TArgs>

const prismaMock = prisma as unknown as {
  cotizacion: {
    findUnique: AsyncMock
  }
  transaccion: {
    findUnique: AsyncMock
  }
  facturacionConfig: {
    findUnique: AsyncMock
  }
  facturacionSerie: {
    findMany: AsyncMock
  }
}

const defaultConfig = {
  afecta_igv: true,
  precios_incluyen_igv_default: true,
  igv_porcentaje: 0.18
}

describe('Preparación de datos para facturación', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearFacturacionConfigCache()
    process.env.FACTURACION_HABILITADA = 'true'
    process.env.FACTURACION_API_URL = 'https://facturacion.local/api'
    process.env.FACTURACION_API_TOKEN = 'fake-token'
    process.env.FACTURACION_EMISOR_RUC = '20123456789'
    prismaMock.facturacionConfig.findUnique.mockResolvedValue(defaultConfig)
    prismaMock.facturacionSerie.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    delete process.env.FACTURACION_HABILITADA
    delete process.env.FACTURACION_API_URL
    delete process.env.FACTURACION_API_TOKEN
    delete process.env.FACTURACION_EMISOR_RUC
    clearFacturacionConfigCache()
  })

  describe('prepararCotizacionParaFacturacion', () => {
    it('retorna un payload válido cuando la cotización tiene solo productos aprobados', async () => {
      prismaMock.cotizacion.findUnique.mockResolvedValue({
        id_cotizacion: 101,
        codigo_cotizacion: 'COT-0101',
        estado: 'aprobada',
        comentarios_cliente: 'Cliente solicita entrega express.',
        cliente: {
          persona: {
            id_persona: 55,
            nombre: 'Ana',
            apellido_paterno: 'García',
            apellido_materno: null,
            numero_documento: '12345678',
            correo: 'ana@example.com',
            telefono: '999999999',
            empresa_persona: null
          }
        },
        vehiculo: null,
        detalle_cotizacion: [
          {
            id_detalle_cotizacion: 1,
            id_producto: 11,
            id_servicio: null,
            cantidad: 2,
            precio_unitario: 150,
            descuento: 0,
            producto: {
              nombre: 'Filtro de aceite',
              codigo_producto: 'FIL-001',
              unidad_medida: { abreviatura: 'UND' }
            },
            servicio: null
          }
        ]
      })

      const payload = await prepararCotizacionParaFacturacion(101)

      expect(prismaMock.cotizacion.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_cotizacion: 101 } })
      )
      expect(payload.origen_tipo).toBe('COTIZACION')
      expect(payload.items).toHaveLength(1)
      expect(payload.items[0].tipo).toBe(TipoItemComprobante.PRODUCTO)
      expect(payload.items[0].id_servicio).toBeNull()
      expect(payload.receptor.nombre).toContain('Ana')
      expect(payload.tipo_comprobante_sugerido).toBeDefined()
    })

    it('rechaza cotizaciones que incluyan servicios', async () => {
      prismaMock.cotizacion.findUnique.mockResolvedValue({
        id_cotizacion: 102,
        codigo_cotizacion: 'COT-0102',
        estado: 'aprobada',
        comentarios_cliente: null,
        cliente: {
          persona: {
            id_persona: 60,
            nombre: 'Miguel',
            apellido_paterno: 'Soto',
            apellido_materno: 'Diaz',
            numero_documento: '87654321',
            correo: 'miguel@example.com',
            telefono: null,
            empresa_persona: null
          }
        },
        vehiculo: null,
        detalle_cotizacion: [
          {
            id_detalle_cotizacion: 1,
            id_producto: null,
            id_servicio: 20,
            cantidad: 1,
            precio_unitario: 250,
            descuento: 0,
            producto: null,
            servicio: { nombre: 'Alineación', unidad_tiempo: 'HORA', tiempo_minimo: 1, tiempo_maximo: 2 }
          }
        ]
      })

      await expect(prepararCotizacionParaFacturacion(102)).rejects.toThrow(FacturacionError)
      await expect(prepararCotizacionParaFacturacion(102)).rejects.toThrow(
        'Esta cotización contiene servicios. Debe convertirse en orden antes de facturar.'
      )
    })
  })

  describe('prepararOrdenParaFacturacion', () => {
    it('arma el payload cuando la orden está completada y sin comprobante', async () => {
      prismaMock.transaccion.findUnique.mockResolvedValue({
        id_transaccion: 5001,
        codigo_transaccion: 'ORD-5001',
        tipo_transaccion: 'orden',
        estatus: 'activo',
        estado_orden: 'completado',
        estado_pago: 'pendiente',
        observaciones: 'Entregar vehículo el viernes',
        persona: {
          id_persona: 70,
          nombre: 'Laura',
          apellido_paterno: 'Reyes',
          apellido_materno: 'Quispe',
          numero_documento: '12345678901',
          correo: 'laura@example.com',
          telefono: '987654321',
          empresa_persona: {
            id_empresa_persona: 9,
            razon_social: 'Transportes Andinos SAC',
            ruc: '12345678901',
            direccion_fiscal: 'Av. Los Andes 123',
            nombre_comercial: 'TransAndes'
          },
          cliente: {
            id_cliente: 40
          }
        },
        transaccion_vehiculos: [
          {
            vehiculo: {
              placa: 'ABC-123',
              modelo: {
                nombre_modelo: 'Hilux',
                marca: {
                  nombre_marca: 'Toyota'
                }
              }
            }
          }
        ],
        detalles_transaccion: [
          {
            id_detalle_transaccion: 1,
            id_producto: 33,
            id_servicio: null,
            cantidad: 1,
            precio: 200,
            descuento: 0,
            producto: {
              nombre: 'Filtro de aire',
              codigo_producto: 'FIL-002',
              unidad_medida: { abreviatura: 'UND' }
            },
            servicio: null
          },
          {
            id_detalle_transaccion: 2,
            id_producto: null,
            id_servicio: 77,
            cantidad: 2,
            precio: 150,
            descuento: 10,
            producto: null,
            servicio: {
              nombre: 'Mantenimiento preventivo',
              unidad_tiempo: 'HORA',
              tiempo_minimo: 1,
              tiempo_maximo: 3
            }
          }
        ],
        comprobantes: []
      })

      const payload = await prepararOrdenParaFacturacion(5001, 'FACTURA')

      expect(prismaMock.transaccion.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_transaccion: 5001 } })
      )
      expect(payload.origen_tipo).toBe('ORDEN')
      expect(payload.items).toHaveLength(2)
      expect(payload.items.map((item) => item.tipo)).toEqual(
        expect.arrayContaining([TipoItemComprobante.PRODUCTO, TipoItemComprobante.SERVICIO])
      )
      expect(payload.tipo_comprobante_sugerido).toBe('FACTURA')
      expect(payload.vehiculo?.placa).toBe('ABC-123')
    })

    it('lanza error si la orden no está completada', async () => {
      prismaMock.transaccion.findUnique.mockResolvedValue({
        id_transaccion: 6001,
        codigo_transaccion: 'ORD-6001',
        tipo_transaccion: 'orden',
        estatus: 'activo',
        estado_orden: 'en_proceso',
        estado_pago: 'pendiente',
        persona: {
          id_persona: 80,
          nombre: 'Carlos',
          apellido_paterno: 'Núñez',
          apellido_materno: null,
          numero_documento: '76543210',
          correo: 'carlos@example.com',
          telefono: null,
          empresa_persona: null,
          cliente: { id_cliente: 50 }
        },
        transaccion_vehiculos: [],
        detalles_transaccion: [],
        comprobantes: []
      })

      await expect(prepararOrdenParaFacturacion(6001)).rejects.toThrow(FacturacionError)
      await expect(prepararOrdenParaFacturacion(6001)).rejects.toThrow(
        'Solo las órdenes completadas pueden enviarse a facturación.'
      )
    })
  })
})
