/// <reference types="jest" />

import { calcularEstimaciones } from '@/lib/ordenes/crear/estimaciones'
import type { ContextoValidacion } from '@/lib/ordenes/crear/types'

const buildContexto = (overrides: Partial<ContextoValidacion> = {}): ContextoValidacion => ({
  idCliente: 1,
  idVehiculo: 2,
  trabajadorPrincipalId: null,
  trabajadoresSecundarios: [],
  cliente: {
    id_cliente: 1,
    id_persona: 1,
    estatus: true,
    fecha_registro: new Date(),
    persona: { nombre: 'Juan', apellido_paterno: 'Pérez' },
    motivo_override: null,
    override_tipo_comprobante: null,
  } as ContextoValidacion['cliente'],
  vehiculo: {
    id_vehiculo: 2,
    id_cliente: 1,
    tipo: 'auto',
    id_modelo: 1,
    placa: 'AAA-123',
    año: 2024,
    tipo_combustible: 'gasolina',
    transmision: 'manual',
    numero_chasis: null,
    numero_motor: null,
    observaciones: null,
    imagen: null,
    estado: true,
    modelo: { nombre_modelo: 'Sedán', marca: { nombre_marca: 'Marca' } },
  } as ContextoValidacion['vehiculo'],
  almacenReservaId: 1,
  modoSoloServicios: false,
  itemsValidados: [],
  subtotal: 200,
  totalMinutosMin: 30,
  totalMinutosMax: 90,
  ...overrides,
})

describe('calcularEstimaciones', () => {
  it('calcula impuesto, total y fecha estimada por duración', () => {
    const contexto = buildContexto()

    const resultado = calcularEstimaciones(contexto, { id_cliente: '1', id_vehiculo: '2', items: [] })

    expect(resultado.impuesto).toBeCloseTo(36)
    expect(resultado.total).toBeCloseTo(236)
    expect(resultado.fechaFinCalculada).toBeInstanceOf(Date)
    expect(resultado.trabajadorAsignadoInicial).toBeNull()
    expect(resultado.estadoInicialOrden).toBe('pendiente')
  })

  it('respeta fecha_fin_estimada provista', () => {
    const contexto = buildContexto({ trabajadorPrincipalId: 9 })
    const fecha = new Date('2025-05-01T10:00:00Z')

    const resultado = calcularEstimaciones(contexto, {
      id_cliente: '1',
      id_vehiculo: '2',
      fecha_fin_estimada: fecha.toISOString(),
      items: [],
    })

    expect(resultado.fechaFinCalculada?.toISOString()).toBe(fecha.toISOString())
    expect(resultado.trabajadorAsignadoInicial).toBe(9)
    expect(resultado.estadoInicialOrden).toBe('asignado')
    expect(resultado.estadoInicialTarea).toBe('por_hacer')
  })
})
