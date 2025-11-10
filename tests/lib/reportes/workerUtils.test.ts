import fs from 'fs'
import os from 'os'
import path from 'path'

import { renderPdf, sendEmailWithAttachment } from '@/lib/reportes/workerUtils'

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockRejectedValue(new Error('mocked puppeteer unavailable')),
}))

jest.setTimeout(10000)

describe('workerUtils', () => {
  const tmpDir = path.join(os.tmpdir(), `rm-test-${Date.now()}`)
  const originalNodeEnv = process.env.NODE_ENV
  const originalSmtpHost = process.env.SMTP_HOST
  const originalSmtpUser = process.env.SMTP_USER

  beforeAll(() => {
    ;(global as any).setImmediate = (global as any).setImmediate || ((fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args))
    process.env.EXPORT_PATH = tmpDir
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true }) } catch (e) {}
    Object.assign(process.env, { NODE_ENV: originalNodeEnv })
    if (originalSmtpHost == null) {
      delete process.env.SMTP_HOST
    } else {
      process.env.SMTP_HOST = originalSmtpHost
    }
    if (originalSmtpUser == null) {
      delete process.env.SMTP_USER
    } else {
      process.env.SMTP_USER = originalSmtpUser
    }
  })

  test('renderPdf creates a file', async () => {
    const rows = [{ a: 1, b: 'X' }, { a: 2, b: 'Y' }]
    const out = await renderPdf(rows, 'test.pdf')
    expect(fs.existsSync(out)).toBe(true)
    const stat = fs.statSync(out)
    expect(stat.size).toBeGreaterThan(0)
  })

  test('sendEmailWithAttachment uses ethereal when no SMTP configured', async () => {
  delete process.env.SMTP_HOST
  delete process.env.SMTP_USER
  Object.assign(process.env, { NODE_ENV: 'test' })
    const rows = [{ a: 1 }]
    const out = await renderPdf(rows, 'email-test.pdf')
    const info = await sendEmailWithAttachment({ to: 'test@example.com', subject: 'Prueba', text: 'Hola', attachments: [{ filename: 'email-test.pdf', path: out }] })
    expect(info).toBeDefined()
  })

  test('sendEmailWithAttachment falla en producción sin SMTP configurado', async () => {
  delete process.env.SMTP_HOST
  delete process.env.SMTP_USER
  Object.assign(process.env, { NODE_ENV: 'production' })
    const rows = [{ a: 1 }]
    const out = await renderPdf(rows, 'email-prod-test.pdf')
    await expect(
      sendEmailWithAttachment({ to: 'ops@example.com', subject: 'Prod', text: 'Hola', attachments: [{ filename: 'email-prod-test.pdf', path: out }] })
    ).rejects.toThrow('SMTP_HOST no configurado')
  })
})
