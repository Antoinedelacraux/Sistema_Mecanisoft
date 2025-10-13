/// <reference types="jest" />

import { PUT } from '../../src/app/api/clientes/[id]/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Mocks for next-auth and prisma
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

jest.mock('@/lib/prisma', () => {
  const cliente = {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  }

  const persona = {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  }

  const empresaPersona = {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  }

  const bitacora = {
    create: jest.fn(),
  }

  const prismaMock: any = {
    cliente,
    persona,
    empresaPersona,
    bitacora,
    $transaction: jest.fn(async (cb: (tx: any) => any) => cb(prismaMock)),
  }

  return { prisma: prismaMock }
})

const ensureResponse = <T extends Response>(response: T | undefined): T => {
  if (!response) {
    throw new Error('La ruta devolvió una respuesta indefinida')
  }
  return response
}

describe('PUT /api/clientes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if no session', async () => {
    const mockedGetServerSession = getServerSession as any;
    mockedGetServerSession.mockResolvedValue(null);
    
    const req = new NextRequest('http://localhost/api/clientes/2', { method: 'PUT' });
  const response = ensureResponse(await PUT(req, { params: { id: '2' } }));
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('No autorizado');
  });

  it('should return 400 if ID is invalid', async () => {
    const mockedGetServerSession = getServerSession as any;
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } });
    
    const req = new NextRequest('http://localhost/api/clientes/NaN', { method: 'PUT' });
  const response = ensureResponse(await PUT(req, { params: { id: 'NaN' } }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('ID inválido');
  });

  it('should update the cliente when valid data is provided', async () => {
    const mockedGetServerSession = getServerSession as any;
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } });

    const mockedClienteFindUnique = prisma.cliente.findUnique as any;
    mockedClienteFindUnique
      .mockResolvedValueOnce({
        id_cliente: 2,
        id_persona: 1,
        persona: {
          id_persona: 1,
          numero_documento: '11112222',
          nombre: 'AntiguoNombre',
          apellido_paterno: 'AntiguoApellido',
          apellido_materno: 'AntiguaMadre',
          nombre_comercial: null,
          registrar_empresa: false,
          fecha_nacimiento: new Date('1990-01-01'),
          empresa_persona: null,
        },
      })
      .mockResolvedValueOnce({
        id_cliente: 2,
        id_persona: 1,
        persona: {
          id_persona: 1,
          numero_documento: '22223333',
          nombre: 'NuevoNombre',
          apellido_paterno: 'ApellidoActualizado',
          apellido_materno: 'ApellidoMaterno',
          nombre_comercial: null,
          registrar_empresa: false,
          fecha_nacimiento: new Date('1990-01-01'),
          empresa_persona: null,
        },
        _count: { vehiculos: 0 },
      });

    const mockedPersonaFindUnique = prisma.persona.findUnique as any;
    mockedPersonaFindUnique.mockResolvedValueOnce(null);

    const mockedPersonaUpdate = prisma.persona.update as any;
    mockedPersonaUpdate.mockResolvedValue({
      nombre: 'NuevoNombre',
      apellido_paterno: 'ApellidoActualizado'
    });

    const mockedBitacoraCreate = prisma.bitacora.create as any;
    mockedBitacoraCreate.mockResolvedValue({});

    const body = {
      nombre: 'NuevoNombre',
      apellido_paterno: 'ApellidoActualizado',
      apellido_materno: 'ApellidoMaterno',
      tipo_documento: 'DNI',
      numero_documento: '22223333',
      sexo: 'M',
      telefono: '123456789',
      correo: 'test@example.com',
      fecha_nacimiento: '1990-01-01',
      registrar_empresa: false,
      nombre_comercial: ''
    };

    const req = new NextRequest('http://localhost/api/clientes/2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const response = ensureResponse(await PUT(req, { params: { id: '2' } }));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.persona.nombre).toBe('NuevoNombre');
    expect(mockedPersonaUpdate).toHaveBeenCalledWith({
      where: { id_persona: 1 },
      data: expect.objectContaining({
        nombre: 'NuevoNombre',
        registrar_empresa: false,
        nombre_comercial: null,
      })
    });
  });
});
