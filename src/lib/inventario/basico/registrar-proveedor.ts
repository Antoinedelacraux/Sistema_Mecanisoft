import { Prisma, TipoDocumento } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { InventarioBasicoError } from './errors'
import type { RegistrarProveedorPayload, ProveedorBasico } from './types'

const RUC_REGEX = /^\d{11}$/
const TELEFONO_REGEX = /^[0-9+()\-\s]{6,20}$/
const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&+{}=-]+(?:\.[a-zA-Z0-9_'^&+{}=-]+)*|"(?:[^"\\]|\\.)+")@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const normalizeOptionalString = (value: unknown) => {
  const normalized = normalizeString(value)
  return normalized.length > 0 ? normalized : null
}

const truncate = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value)

const splitRazonSocial = (razonSocial: string) => {
  const partes = razonSocial.split(/\s+/).filter(Boolean)

  if (partes.length === 0) {
    return {
      nombre: 'Proveedor',
      apellido_paterno: 'Inventario',
      apellido_materno: null as string | null,
    }
  }

  if (partes.length === 1) {
    return {
      nombre: truncate(partes[0], 100),
      apellido_paterno: 'Inventario',
      apellido_materno: null,
    }
  }

  const nombre = truncate(partes.shift() ?? 'Proveedor', 100)
  const apellido_paterno = truncate(partes.shift() ?? 'Inventario', 100)
  const apellido_materno = partes.length > 0 ? truncate(partes.join(' '), 100) : null

  return { nombre, apellido_paterno, apellido_materno }
}

const sanitizarYRellenarPayload = (payload: RegistrarProveedorPayload) => {
  const nombre = truncate(normalizeString(payload.nombre), 200)
  if (!nombre) {
    throw new InventarioBasicoError('El nombre o razon social del proveedor es obligatorio', 400, 'PROVEEDOR_SIN_NOMBRE')
  }

  const ruc = normalizeString(payload.ruc)
  if (!RUC_REGEX.test(ruc)) {
    throw new InventarioBasicoError('El RUC debe tener 11 digitos', 400, 'RUC_INVALIDO')
  }

  const contacto = normalizeOptionalString(payload.contacto)
  const numeroContacto = normalizeOptionalString(payload.numero_contacto ?? payload.telefono)
  if (numeroContacto && !TELEFONO_REGEX.test(numeroContacto)) {
    throw new InventarioBasicoError('El telefono de contacto debe tener entre 6 y 20 caracteres validos', 400, 'TELEFONO_INVALIDO')
  }

  const telefono = normalizeOptionalString(payload.telefono)
  if (telefono && !TELEFONO_REGEX.test(telefono)) {
    throw new InventarioBasicoError('El telefono debe tener entre 6 y 20 caracteres validos', 400, 'TELEFONO_INVALIDO')
  }

  const correo = normalizeOptionalString(payload.correo)
  if (correo && !EMAIL_REGEX.test(correo)) {
    throw new InventarioBasicoError('El correo electronico no es valido', 400, 'CORREO_INVALIDO')
  }

  const nombreComercial = normalizeOptionalString(payload.nombre_comercial)

  return {
    nombre,
    ruc,
    contacto,
    numeroContacto,
    telefono,
    correo,
    nombreComercial,
    creado_por: payload.creado_por,
  }
}

const mapearRespuesta = (
  proveedor: Prisma.ProveedorGetPayload<{
    include: {
      persona: {
        select: {
          telefono: true,
          correo: true,
          nombre_comercial: true,
          numero_documento: true,
        },
      },
    },
  }>,
): ProveedorBasico => ({
  id_proveedor: proveedor.id_proveedor,
  razon_social: proveedor.razon_social,
  contacto: proveedor.contacto ?? null,
  numero_contacto: proveedor.numero_contacto ?? null,
  telefono: proveedor.persona?.telefono ?? null,
  correo: proveedor.persona?.correo ?? null,
  nombre_comercial: proveedor.persona?.nombre_comercial ?? null,
  ruc: proveedor.persona?.numero_documento && RUC_REGEX.test(proveedor.persona.numero_documento)
    ? proveedor.persona.numero_documento
    : null,
})

export const registrarProveedor = async (payload: RegistrarProveedorPayload): Promise<ProveedorBasico> => {
  const datos = sanitizarYRellenarPayload(payload)

  return prisma.$transaction(async (tx) => {
    let persona = await tx.persona.findUnique({ where: { numero_documento: datos.ruc }, include: { proveedor: true } })

    if (persona?.proveedor) {
      throw new InventarioBasicoError('Ya existe un proveedor registrado con este RUC', 409, 'PROVEEDOR_DUPLICADO')
    }

    const { nombre, apellido_paterno, apellido_materno } = splitRazonSocial(datos.nombre)

    if (!persona) {
      persona = await tx.persona.create({
        data: {
          nombre,
          apellido_paterno,
          apellido_materno,
          tipo_documento: TipoDocumento.RUC,
          numero_documento: datos.ruc,
          telefono: datos.telefono ?? datos.numeroContacto,
          correo: datos.correo,
          nombre_comercial: datos.nombreComercial,
          registrar_empresa: false,
        },
        include: { proveedor: true },
      })
    } else {
      persona = await tx.persona.update({
        where: { id_persona: persona.id_persona },
        data: {
          nombre,
          apellido_paterno,
          apellido_materno,
          telefono: datos.telefono ?? datos.numeroContacto ?? persona.telefono,
          correo: datos.correo ?? persona.correo,
          nombre_comercial: datos.nombreComercial ?? persona.nombre_comercial,
        },
        include: { proveedor: true },
      })
    }

    const proveedor = await tx.proveedor.create({
      data: {
        id_persona: persona.id_persona,
        razon_social: datos.nombre,
        contacto: datos.contacto,
        numero_contacto: datos.numeroContacto,
      },
      include: {
        persona: {
          select: {
            telefono: true,
            correo: true,
            nombre_comercial: true,
            numero_documento: true,
          },
        },
      },
    })

    await tx.bitacora.create({
      data: {
        id_usuario: datos.creado_por,
        accion: 'INVENTARIO_PROVEEDOR',
        descripcion: `Registro de proveedor ${datos.nombre}`,
        tabla: 'inventario',
      },
    })

    return mapearRespuesta(proveedor)
  })
}

