import { isUserTemporarilyBlocked, extractClientIp, LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS } from '@/lib/auth/login-security'

describe('auth/login-security helpers', () => {
  it('detects when user is not blocked without attempts', () => {
    expect(
      isUserTemporarilyBlocked({ intentos_fallidos_login: 0, ultimo_intento_fallido: null })
    ).toBe(false)
  })

  it('detects temporary block when attempts exceed threshold', () => {
    const locked = isUserTemporarilyBlocked({
      intentos_fallidos_login: MAX_FAILED_ATTEMPTS,
      ultimo_intento_fallido: new Date()
    })
    expect(locked).toBe(true)
  })

  it('allows login after lockout window', () => {
    const past = new Date(Date.now() - (LOCKOUT_MINUTES + 10) * 60 * 1000)
    expect(
      isUserTemporarilyBlocked({ intentos_fallidos_login: MAX_FAILED_ATTEMPTS + 2, ultimo_intento_fallido: past })
    ).toBe(false)
  })

  ;(typeof Headers === 'undefined' ? it.skip : it)('extracts IP from Headers instance', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' })
    const ip = extractClientIp({ headers })
    expect(ip).toBe('203.0.113.1')
  })

  it('handles plain object headers case-insensitively', () => {
    const ip = extractClientIp({ headers: { 'X-Real-IP': '198.51.100.5' } })
    expect(ip).toBe('198.51.100.5')
  })
})
