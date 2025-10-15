import { prisma } from '../src/lib/prisma'
import { RegistrarProveedorPayload } from '../src/lib/inventario/basico/types'

// If registrarProveedor is preferred, we can import it, but to keep script simple
// we'll insert directly via Prisma to avoid triggering extra domain logic.

async function main() {
  const proveedores: RegistrarProveedorPayload[] = [
    {
      nombre: 'Proveedor Aceites SAC',
      ruc: '20512345678',
      nombre_comercial: 'Aceites Pro',
      contacto: 'Marcos Ruiz',
      telefono: '+51987654321',
      correo: 'ventas@aceitespro.com',
      creado_por: 1,
    },
    {
      nombre: 'Repuestos Norte S.A.C.',
      ruc: '20623456789',
      nombre_comercial: 'Repuestos Norte',
      contacto: 'Ana Torres',
      telefono: '+51991234567',
      correo: 'contacto@repuestosnorte.pe',
      creado_por: 1,
    },
    {
      nombre: 'Lubricantes del Sur EIRL',
      ruc: '20123456780',
      nombre_comercial: 'LubriSur',
      contacto: 'Carlos Vega',
      telefono: '+51999887766',
      correo: 'info@lubrisur.com',
      creado_por: 1,
    },
    {
      nombre: 'Distribuciones Lima SAC',
      ruc: '20498765432',
      nombre_comercial: 'DistLima',
      contacto: 'Lucía Flores',
      telefono: '+51995544332',
      correo: 'ventas@distlima.com',
      creado_por: 1,
    },
    {
      nombre: 'Componentes Automotrices SAC',
      ruc: '20609876543',
      nombre_comercial: 'CompAuto',
      contacto: 'Jorge Ramírez',
      telefono: '+51994433221',
      correo: 'ventas@compauto.pe',
      creado_por: 1,
    },
  ]

  for (const p of proveedores) {
    try {
      // First create or update persona
      const persona = await prisma.persona.upsert({
        where: { numero_documento: p.ruc as string },
        update: {
          nombre: p.nombre!.split(' ')[0],
          apellido_paterno: p.nombre!.split(' ')[1] ?? 'Proveedor',
          telefono: p.telefono,
          correo: p.correo,
          nombre_comercial: p.nombre_comercial,
        },
        create: {
          nombre: p.nombre!.split(' ')[0],
          apellido_paterno: p.nombre!.split(' ')[1] ?? 'Proveedor',
          tipo_documento: 'RUC',
          numero_documento: p.ruc,
          telefono: p.telefono,
          correo: p.correo,
          nombre_comercial: p.nombre_comercial,
          registrar_empresa: false,
        },
      })

      // Then create proveedor if not exists
      const proveedor = await prisma.proveedor.upsert({
        where: { id_persona: persona.id_persona },
        update: {
          razon_social: p.nombre,
          contacto: p.contacto,
          numero_contacto: p.telefono,
        },
        create: {
          id_persona: persona.id_persona,
          razon_social: p.nombre,
          contacto: p.contacto,
          numero_contacto: p.telefono,
        },
      })

      // bitacora
      await prisma.bitacora.create({
        data: {
          id_usuario: p.creado_por ?? 1,
          accion: 'INVENTARIO_PROVEEDOR',
          descripcion: `Registro batch proveedor ${p.nombre}`,
          tabla: 'inventario',
        },
      })

      console.log('Proveedor asegurado:', proveedor.razon_social)
    } catch (error: any) {
      console.error('Error al crear proveedor', p.nombre, error?.message ?? error)
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
