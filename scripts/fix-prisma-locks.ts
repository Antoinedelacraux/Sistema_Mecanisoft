#!/usr/bin/env tsx
import { promises as fs } from 'fs'
import path from 'path'
import { execSync } from 'child_process'

async function main() {
  const clientDir = path.join(process.cwd(), 'node_modules', '.prisma', 'client')
  try {
    const stat = await fs.stat(clientDir)
    if (!stat.isDirectory()) {
      console.log('No existe el directorio del cliente Prisma:', clientDir)
      return
    }
  } catch (e) {
    console.log('No se encontró node_modules/.prisma/client; ejecutando prisma generate directamente')
    try {
      execSync('npx prisma generate', { stdio: 'inherit' })
    } catch (err) {
      console.error('Error al ejecutar prisma generate:', err)
      process.exit(1)
    }
    return
  }

  try {
    const files = await fs.readdir(clientDir)
    const tmpFiles = files.filter(f => f.includes('.tmp'))
    if (tmpFiles.length === 0) {
      console.log('No se encontraron archivos .tmp en', clientDir)
    } else {
      console.log('Eliminando archivos temporales:', tmpFiles)
      await Promise.all(tmpFiles.map(f => fs.unlink(path.join(clientDir, f)).catch(err => ({ err, f }))))
      console.log('Eliminación de .tmp completada')
    }

    console.log('Ejecutando npx prisma generate...')
    execSync('npx prisma generate', { stdio: 'inherit' })
    console.log('prisma generate completado con éxito')
  } catch (err: any) {
    console.error('Error durante fix-prisma-locks:', err?.message ?? err)
    console.log('Si persiste un EPERM en Windows, prueba a cerrar procesos node/VSCode o ejecutar:')
    console.log('takeown /f "' + path.join(clientDir, 'query_engine-windows.dll.node') + '"')
    console.log('icacls "' + path.join(clientDir, 'query_engine-windows.dll.node') + '" /grant "%USERNAME%:F"')
    process.exit(1)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
