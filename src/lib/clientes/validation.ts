import { PrismaClient } from '@prisma/client'

export class ClienteValidationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ClienteValidationError'
    this.status = status
  }
}

export interface EmpresaPayloadInput {
  ruc?: string
  razon_social?: string
  nombre_comercial?: string
  direccion_fiscal?: string
}

export interface ClientePayloadInput {
  nombre?: string
  apellido_paterno?: string
  apellido_materno?: string | null
  tipo_documento?: string
  numero_documento?: string
  sexo?: string | null
  telefono?: string | null
  correo?: string | null
  fecha_nacimiento?: string | Date
  registrar_empresa?: boolean | string | null
  nombre_comercial?: string | null
  empresa?: EmpresaPayloadInput | null
}

export interface ClienteValidationOptions {
  prisma: PrismaClient
  personaId?: number
}

const TIPO_DOCUMENTO_VALUES = ['DNI', 'RUC', 'CE', 'PASAPORTE'] as const
type TipoDocumento = (typeof TIPO_DOCUMENTO_VALUES)[number]
const TipoDocumentoValues: Record<TipoDocumento, TipoDocumento> = {
  DNI: 'DNI',
  RUC: 'RUC',
  CE: 'CE',
  PASAPORTE: 'PASAPORTE'
}

export interface ClienteValidatedData {
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  tipo_documento: TipoDocumento
  numero_documento: string
  sexo: string | null
  telefono: string | null
  correo: string | null
  fecha_nacimiento: Date
  registrar_empresa: boolean
  nombre_comercial_persona: string | null
  empresa: {
    ruc: string
    razon_social: string
    nombre_comercial: string | null
    direccion_fiscal: string | null
  } | null
}

const DOC_TYPES = new Set<string>(Object.values(TipoDocumentoValues))
const RUC_REGEX = /^\d{11}$/
const DNI_REGEX = /^\d{8}$/
const TELEFONO_REGEX = /^\d{6,15}$/
const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&amp;+{}=-]+(?:\.[a-zA-Z0-9_'^&amp;+{}=-]+)*|"(?:[^"]|\\")+")@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeString(value)
  return normalized.length > 0 ? normalized : null
}

function normalizeTipoDocumento(value: unknown): TipoDocumento {
  const raw = normalizeString(value).toUpperCase()
  if (!DOC_TYPES.has(raw)) {
    throw new ClienteValidationError('Tipo de documento inválido')
  }
  return raw as TipoDocumento
}

function parseFechaNacimiento(value: unknown): Date {
  if (!value) {
    throw new ClienteValidationError('La fecha de nacimiento es requerida')
  }
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    throw new ClienteValidationError('La fecha de nacimiento no es válida')
  }
  const hoy = new Date()
  if (date > hoy) {
    throw new ClienteValidationError('La fecha de nacimiento no puede ser futura')
  }
  return date
}

function calcularEdad(fechaNacimiento: Date, referencia: Date = new Date()): number {
  let edad = referencia.getFullYear() - fechaNacimiento.getFullYear()
  const mes = referencia.getMonth() - fechaNacimiento.getMonth()
  if (mes < 0 || (mes === 0 && referencia.getDate() < fechaNacimiento.getDate())) {
    edad -= 1
  }
  return edad
}

function hasEmpresaPayload(empresa?: EmpresaPayloadInput | null): boolean {
  if (!empresa) return false
  return Boolean(
    normalizeString(empresa.ruc) ||
      normalizeString(empresa.razon_social) ||
      normalizeString(empresa.nombre_comercial) ||
      normalizeString(empresa.direccion_fiscal)
  )
}

export async function validateClientePayload(
  payload: ClientePayloadInput,
  { prisma, personaId }: ClienteValidationOptions
): Promise<ClienteValidatedData> {
  const nombre = normalizeString(payload.nombre)
  const apellidoPaterno = normalizeString(payload.apellido_paterno)

  if (!nombre) {
    throw new ClienteValidationError('El nombre es requerido')
  }

  if (!apellidoPaterno) {
    throw new ClienteValidationError('El apellido paterno es requerido')
  }

  const tipoDocumento = normalizeTipoDocumento(payload.tipo_documento)
  const numeroDocumento = normalizeString(payload.numero_documento)

  if (!numeroDocumento) {
    throw new ClienteValidationError('El número de documento es requerido')
  }

  if (tipoDocumento === TipoDocumentoValues.DNI && !DNI_REGEX.test(numeroDocumento)) {
    throw new ClienteValidationError('El DNI debe tener 8 dígitos')
  }

  if (tipoDocumento === TipoDocumentoValues.RUC && !RUC_REGEX.test(numeroDocumento)) {
    throw new ClienteValidationError('El RUC debe tener 11 dígitos')
  }

  const fechaNacimiento = parseFechaNacimiento(payload.fecha_nacimiento)
  const edad = calcularEdad(fechaNacimiento)
  if (edad < 18) {
    throw new ClienteValidationError('El cliente debe ser mayor de 18 años')
  }

  const existingPersona = await prisma.persona.findUnique({ where: { numero_documento: numeroDocumento } })
  if (existingPersona && existingPersona.id_persona !== personaId) {
    throw new ClienteValidationError('Ya existe una persona con este número de documento')
  }

  if (tipoDocumento === TipoDocumentoValues.RUC) {
    const existingEmpresaForRuc = await prisma.empresaPersona.findUnique({ where: { ruc: numeroDocumento } })
    if (existingEmpresaForRuc && existingEmpresaForRuc.persona_id !== personaId) {
      throw new ClienteValidationError('Ya existe una empresa registrada con este RUC')
    }
  }

  const sexo = normalizeOptionalString(payload.sexo)?.toUpperCase() ?? null
  const telefono = normalizeOptionalString(payload.telefono)
  if (telefono && !TELEFONO_REGEX.test(telefono)) {
    throw new ClienteValidationError('El teléfono debe contener solo dígitos y tener entre 6 y 15 caracteres')
  }

  const correo = normalizeOptionalString(payload.correo)
  if (correo && !EMAIL_REGEX.test(correo)) {
    throw new ClienteValidationError('El correo electrónico no es válido')
  }

  const apellidoMaterno = normalizeOptionalString(payload.apellido_materno)
  const nombreComercialPersona = normalizeOptionalString(payload.nombre_comercial)

  const registrarEmpresaRaw =
    typeof payload.registrar_empresa === 'string'
      ? payload.registrar_empresa.toLowerCase() === 'true'
      : Boolean(payload.registrar_empresa)

  const registrarEmpresa = tipoDocumento === TipoDocumentoValues.RUC ? false : registrarEmpresaRaw

  if (tipoDocumento === TipoDocumentoValues.RUC && (registrarEmpresaRaw || hasEmpresaPayload(payload.empresa))) {
    throw new ClienteValidationError(
      'Ya estás registrando una persona con RUC, no es necesario asociar una empresa adicional.'
    )
  }

  if (tipoDocumento !== TipoDocumentoValues.RUC && nombreComercialPersona) {
    throw new ClienteValidationError('El nombre comercial solo aplica para personas con RUC')
  }

  if (nombreComercialPersona && nombreComercialPersona.length > 150) {
    throw new ClienteValidationError('El nombre comercial no puede superar 150 caracteres')
  }

  const nombreComercialPersonaResult = tipoDocumento === TipoDocumentoValues.RUC ? nombreComercialPersona : null

  let empresaResult: ClienteValidatedData['empresa'] = null

  if (registrarEmpresa) {
    if (!payload.empresa) {
      throw new ClienteValidationError('Debes proporcionar los datos de la empresa asociada')
    }

    const ruc = normalizeString(payload.empresa.ruc)
    const razonSocial = normalizeString(payload.empresa.razon_social)
    const nombreComercial = normalizeOptionalString(payload.empresa.nombre_comercial)
    const direccionFiscal = normalizeOptionalString(payload.empresa.direccion_fiscal)

    if (!RUC_REGEX.test(ruc)) {
      throw new ClienteValidationError('El RUC de la empresa debe tener 11 dígitos')
    }

    if (!razonSocial) {
      throw new ClienteValidationError('La razón social de la empresa es requerida')
    }

    if (nombreComercial && nombreComercial.length > 150) {
      throw new ClienteValidationError('El nombre comercial de la empresa no puede superar 150 caracteres')
    }

    const existingEmpresa = await prisma.empresaPersona.findUnique({ where: { ruc } })
    if (existingEmpresa && existingEmpresa.persona_id !== personaId) {
      throw new ClienteValidationError('Ya existe una empresa registrada con este RUC')
    }

    const personaConMismoRuc = await prisma.persona.findUnique({ where: { numero_documento: ruc } })
    if (personaConMismoRuc && personaConMismoRuc.id_persona !== personaId) {
      throw new ClienteValidationError('Ya existe una persona registrada con este RUC')
    }

    empresaResult = {
      ruc,
      razon_social: razonSocial,
      nombre_comercial: nombreComercial,
      direccion_fiscal: direccionFiscal
    }
  }

  return {
    nombre,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    tipo_documento: tipoDocumento,
    numero_documento: numeroDocumento,
    sexo,
    telefono,
    correo,
    fecha_nacimiento: fechaNacimiento,
    registrar_empresa: registrarEmpresa,
    nombre_comercial_persona: nombreComercialPersonaResult,
    empresa: empresaResult
  }
}
