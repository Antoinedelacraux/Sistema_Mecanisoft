import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { numero_documento, cliente_id } = await request.json()

    const parsedClienteId = cliente_id === null || cliente_id === undefined ? null : Number(cliente_id)
    const clienteId = Number.isFinite(parsedClienteId) ? parsedClienteId : null

    if (!numero_documento) {
      return NextResponse.json({ error: 'Número de documento requerido' }, { status: 400 })
    }

    // Buscar si existe el documento en personas
    const persona = await prisma.persona.findUnique({
      where: { numero_documento },
      include: {
        cliente: true,
        proveedor: true,
        usuario: true
      }
    })

    if (persona) {
      // Si estamos editando y es el mismo cliente, está disponible
      if (clienteId !== null && persona.cliente?.id_cliente === clienteId) {
        return NextResponse.json({ disponible: true, mensaje: 'Documento disponible' })
      }

      let tipo = 'persona'
      const nombre = `${persona.nombre} ${persona.apellido_paterno}`

      if (persona.cliente) tipo = 'cliente'
      else if (persona.proveedor) tipo = 'proveedor'
      else if (persona.usuario) tipo = 'usuario del sistema'

      return NextResponse.json({
        disponible: false,
        mensaje: `Este documento ya está registrado por ${tipo}: ${nombre}`
      })
    }

    const empresa = await prisma.empresaPersona.findUnique({
      where: { ruc: numero_documento }
    })

    if (empresa) {
      if (clienteId !== null) {
        const clienteAsociado = await prisma.cliente.findUnique({
          where: { id_persona: empresa.persona_id }
        })

        if (clienteAsociado?.id_cliente === clienteId) {
          return NextResponse.json({ disponible: true, mensaje: 'Documento disponible' })
        }
      }

      return NextResponse.json({
        disponible: false,
        mensaje: 'Este RUC ya está registrado por una empresa asociada.'
      })
    }

    return NextResponse.json({ disponible: true, mensaje: 'Documento disponible' })

  } catch (error) {
    console.error('Error validando documento:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}