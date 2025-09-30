import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { numero_documento, cliente_id } = await request.json()

    if (!numero_documento) {
      return NextResponse.json({ error: 'Número de documento requerido' }, { status: 400 })
    }

    // Buscar si existe el documento
    const persona = await prisma.persona.findUnique({
      where: { numero_documento },
      include: {
        cliente: true,
        proveedor: true,
        usuario: true
      }
    })

    if (!persona) {
      return NextResponse.json({ disponible: true })
    }

    // Si estamos editando y es el mismo cliente, está disponible
    if (cliente_id && persona.cliente?.id_cliente === parseInt(cliente_id)) {
      return NextResponse.json({ disponible: true })
    }

    // Determinar el tipo de persona que ya tiene este documento
  let tipo = 'persona'
  const nombre = `${persona.nombre} ${persona.apellido_paterno}`
    
    if (persona.cliente) tipo = 'cliente'
    else if (persona.proveedor) tipo = 'proveedor'  
    else if (persona.usuario) tipo = 'usuario del sistema'

    return NextResponse.json({ 
      disponible: false,
      mensaje: `Este documento ya está registrado por ${tipo}: ${nombre}`
    })

  } catch (error) {
    console.error('Error validando documento:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}