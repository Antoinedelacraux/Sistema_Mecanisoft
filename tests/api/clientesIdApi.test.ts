/// <reference types="jest" />

import { PUT } from '../../src/app/api/clientes/[id]/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';

// Mocks for next-auth and prisma
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: {
      findUnique: jest.fn(),
    },
    persona: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    bitacora: {
      create: jest.fn(),
    },
  },
}));

describe('PUT /api/clientes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if no session', async () => {
    const mockedGetServerSession = getServerSession as any;
    mockedGetServerSession.mockResolvedValue(null);
    
    const req = new NextRequest('http://localhost/api/clientes/2', { method: 'PUT' });
    const response = await PUT(req, { params: { id: '2' } });
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('No autorizado');
  });

  it('should return 400 if ID is invalid', async () => {
    const mockedGetServerSession = getServerSession as any;
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } });
    
    const req = new NextRequest('http://localhost/api/clientes/NaN', { method: 'PUT' });
    const response = await PUT(req, { params: { id: 'NaN' } });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('ID inválido');
  });

  it('should update the cliente when valid data is provided', async () => {
    const mockedGetServerSession = getServerSession as any;
    mockedGetServerSession.mockResolvedValue({ user: { id: '1' } });

    const mockedClienteFindUnique = prisma.cliente.findUnique as any;
    mockedClienteFindUnique.mockResolvedValue({
      id_cliente: 2,
      id_persona: 1,
      persona: { id_persona: 1, numero_documento: '1111', nombre: 'AntiguoNombre', apellido_paterno: 'AntiguoApellido' }
    });

    const mockedPersonaFindUnique = prisma.persona.findUnique as any;
    mockedPersonaFindUnique.mockResolvedValue(null);

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
      numero_documento: '2222',
      sexo: 'M',
      telefono: '123456789',
      correo: 'test@example.com',
      empresa: ''
    };

    const req = new NextRequest('http://localhost/api/clientes/2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const response = await PUT(req, { params: { id: '2' } });
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toHaveProperty('nombre', 'NuevoNombre');
  });
});
