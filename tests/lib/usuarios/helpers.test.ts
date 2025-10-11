import bcrypt from 'bcryptjs'

import {
  generateTemporalPassword,
  normalizeUsername,
  hashPassword
} from '@/app/api/usuarios/controllers/helpers'

describe('usuarios helpers', () => {
  describe('normalizeUsername', () => {
    it('trims and lowercases usernames', () => {
      expect(normalizeUsername('  AdminUser ')).toBe('adminuser')
      expect(normalizeUsername('MiUsuario')).toBe('miusuario')
    })
  })

  describe('generateTemporalPassword', () => {
    it('generates alphanumeric passwords of requested length', () => {
      const password = generateTemporalPassword(16)
      expect(password).toHaveLength(16)
      expect(password).toMatch(/^[a-zA-Z0-9]+$/)
    })

    it('defaults to 12 characters when no length provided', () => {
      const password = generateTemporalPassword()
      expect(password).toHaveLength(12)
    })
  })

  describe('hashPassword', () => {
    it('hashes values using bcrypt', async () => {
      const rawPassword = 'Temporal123'
      const hashed = await hashPassword(rawPassword)

      expect(hashed).not.toEqual(rawPassword)
      const matches = await bcrypt.compare(rawPassword, hashed)
      expect(matches).toBe(true)
    })
  })
})
