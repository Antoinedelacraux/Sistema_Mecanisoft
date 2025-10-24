#!/usr/bin/env tsx
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

async function main() {
  const username = process.argv[2]
  const password = process.argv[3]
  if (!username || !password) {
    console.error('Usage: npx tsx scripts/verify-user-password.ts <username> <password>')
    process.exit(1)
  }

  const usuario = await prisma.usuario.findUnique({ where: { nombre_usuario: username } })
  if (!usuario) {
    console.error('Usuario no encontrado:', username)
    process.exit(2)
  }

  const match = await bcrypt.compare(password, usuario.password)
  console.log('Usuario:', username)
  console.log('Password matches:', match)
  if (!match) {
    // also check temporary password
    const matchTemp = usuario.password_temporal ? await bcrypt.compare(password, usuario.password_temporal) : false
    console.log('Matches temporary password:', matchTemp)
  }
}

main().catch((e) => {
  console.error('Error verifying password:', e)
  process.exit(3)
})
