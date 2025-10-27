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

  beforeAll(() => {
    ;(global as any).setImmediate = (global as any).setImmediate || ((fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args))
    process.env.EXPORT_PATH = tmpDir
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterAll(() => {
    try { fs.rmSync(tmpDir, { recursive: true }) } catch (e) {}
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
    const rows = [{ a: 1 }]
    const out = await renderPdf(rows, 'email-test.pdf')
    const info = await sendEmailWithAttachment({ to: 'test@example.com', subject: 'Prueba', text: 'Hola', attachments: [{ filename: 'email-test.pdf', path: out }] })
    expect(info).toBeDefined()
  })
})
