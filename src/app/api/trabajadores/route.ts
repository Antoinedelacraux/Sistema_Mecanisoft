import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

type DocumentoPermitido = 'DNI' | 'RUC' | 'CE' | 'PASAPORTE'

// Función para generar código de empleado único
async function generateCodigoEmpleado() {
  const lastWorker = await prisma.trabajador.findFirst({
    orderBy: { id_trabajador: 'desc' }
  })
  
  const nextNumber = lastWorker 
    ? parseInt(lastWorker.codigo_empleado.split('-')[1]) + 1 
    : 1
    
  return `MEC-${nextNumber.toString().padStart(3, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('include_inactive') === 'true'
    const soloActivos = searchParams.get('solo_activos') === 'true'
    const usuarioIdParam = searchParams.get('usuario_id') // ✅ nuevo filtro

    const whereCondition: Prisma.TrabajadorWhereInput = {}

    if (usuarioIdParam) {
      const usuarioId = Number(usuarioIdParam)
      if (!Number.isNaN(usuarioId)) {
        whereCondition.id_usuario = usuarioId
      }
    } else {
      if (soloActivos) {
        whereCondition.activo = true
        whereCondition.usuario = { estado: true }
      } else if (!includeInactive) {
        whereCondition.activo = true
      }
    }

    const trabajadores = await prisma.trabajador.findMany({
      where: whereCondition,
      include: {
        usuario: {
          include: {
            persona: true,
            rol: true
          }
        },
        _count: {
          select: {
            tareas_asignadas: true,
            ordenes_principales: true
          }
        }
      },
      orderBy: [
        { activo: 'desc' },
        { usuario: { persona: { nombre: 'asc' } } }
      ]
    })

    return NextResponse.json({ trabajadores })
  } catch (error) {
    console.error('Error obteniendo trabajadores:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const data = await request.json()
    const {
      // Datos de persona
      nombre,
      apellido_paterno,
      apellido_materno,
      tipo_documento,
      numero_documento,
      telefono,
      correo,
      // Datos de usuario
      nombre_usuario,
      password,
      // Datos de trabajador
      especialidad,
      nivel_experiencia,
      tarifa_hora
    } = data

    // Validar campos requeridos
    if (!nombre || !apellido_paterno || !numero_documento || !tipo_documento || !nombre_usuario || !password || !especialidad) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' }, 
        { status: 400 }
      )
    }

    const tipoDocumentoNormalizado = String(tipo_documento).toUpperCase() as DocumentoPermitido
    if (!['DNI', 'RUC', 'CE', 'PASAPORTE'].includes(tipoDocumentoNormalizado)) {
      return NextResponse.json(
        { error: 'Tipo de documento inválido' },
        { status: 400 }
      )
    }

    // Verificar que no exista el documento
    const existeDocumento = await prisma.persona.findUnique({
      where: { numero_documento }
    })

    if (existeDocumento) {
      return NextResponse.json(
        { error: 'Ya existe una persona con este documento' }, 
        { status: 400 }
      )
    }

    // Verificar que no exista el usuario
    const existeUsuario = await prisma.usuario.findUnique({
      where: { nombre_usuario }
    })

    if (existeUsuario) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con este nombre' }, 
        { status: 400 }
      )
    }

    // Obtener rol de mecánico
    const rolMecanico = await prisma.rol.findFirst({
      where: { nombre_rol: 'Mecánico' }
    })

    if (!rolMecanico) {
      return NextResponse.json(
        { error: 'Rol de mecánico no encontrado' }, 
        { status: 500 }
      )
    }

    // Generar código de empleado
    const codigoEmpleado = await generateCodigoEmpleado()

    // Crear en transacción
    const trabajador = await prisma.$transaction(async (tx) => {
      // Crear persona
      const persona = await tx.persona.create({
        data: {
          nombre,
          apellido_paterno,
          apellido_materno,
          tipo_documento: tipoDocumentoNormalizado,
          numero_documento,
          telefono,
          correo,
          registrar_empresa: false,
          fecha_nacimiento: null
        }
      })

      // Crear usuario
  const hashedPassword = await (await import('bcryptjs')).hash(password, 10)
      
      const usuario = await tx.usuario.create({
        data: {
          id_persona: persona.id_persona,
          id_rol: rolMecanico.id_rol,
          nombre_usuario,
          password: hashedPassword
        }
      })

      // Crear trabajador
      const trabajador = await tx.trabajador.create({
        data: {
          id_usuario: usuario.id_usuario,
          codigo_empleado: codigoEmpleado,
          especialidad,
          nivel_experiencia: nivel_experiencia || 'Junior',
          tarifa_hora: parseFloat(tarifa_hora) || 0
        },
        include: {
          usuario: {
            include: {
              persona: {
                include: {
                  empresa_persona: true
                }
              },
              rol: true
            }
          }
        }
      })

      return trabajador
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_TRABAJADOR',
        descripcion: `Trabajador creado: ${codigoEmpleado} - ${nombre} ${apellido_paterno}`,
        tabla: 'trabajador'
      }
    })

    return NextResponse.json(trabajador, { status: 201 })

  } catch (error) {
    console.error('Error creando trabajador:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}