import net from 'node:net'

import { logger } from '@/lib/logger'

const DEFAULT_PORT = Number.parseInt(process.env.CLAMAV_PORT ?? '3310', 10)
const SCAN_TIMEOUT_MS = Number.parseInt(process.env.CLAMAV_TIMEOUT_MS ?? '10000', 10)

export type ScanResult = {
  clean: true
  skipped?: false
} | {
  clean: true
  skipped: true
  reason: string
} | {
  clean: false
  reason: string
}

export async function scanBufferWithClamAV(buffer: Buffer): Promise<ScanResult> {
  const host = process.env.CLAMAV_HOST
  if (!host) {
    return {
      clean: true,
      skipped: true,
      reason: 'CLAMAV_HOST not configured'
    }
  }

  return new Promise<ScanResult>((resolve, reject) => {
    const socket = net.connect({ host, port: DEFAULT_PORT })
    let resolved = false
    let response = ''

    const finalize = (result: ScanResult) => {
      if (resolved) return
      resolved = true
      socket.removeAllListeners()
      if (!socket.destroyed) {
        socket.end()
      }
      resolve(result)
    }

      socket.on('error', (error) => {
        logger.error({ error }, '[antivirus] Error comunicando con ClamAV')
        if (!resolved) {
          resolved = true
          reject(error)
        }
      })

    socket.setTimeout(SCAN_TIMEOUT_MS, () => {
      logger.error('[antivirus] ClamAV scan timed out')
        if (!resolved) {
          resolved = true
          socket.destroy()
          reject(new Error('Antivirus scan timeout'))
        }
    })

    socket.on('data', (chunk) => {
      response += chunk.toString('utf8')
    })

    socket.on('close', () => {
      if (resolved) return
      if (!response) {
        finalize({ clean: false, reason: 'Empty response from ClamAV' })
        return
      }
      const trimmed = response.trim()
      if (trimmed.endsWith('OK')) {
        finalize({ clean: true })
      } else {
        finalize({ clean: false, reason: trimmed })
      }
    })

    socket.on('connect', () => {
      socket.write('nINSTREAM\n')

      const chunkSize = 64 * 1024
      let offset = 0
      while (offset < buffer.length) {
        const size = Math.min(chunkSize, buffer.length - offset)
        const header = Buffer.alloc(4)
        header.writeUInt32BE(size, 0)
        socket.write(header)
        socket.write(buffer.subarray(offset, offset + size))
        offset += size
      }

      const terminator = Buffer.alloc(4)
      socket.write(terminator)
    })
  })
}

export async function ensureCleanBuffer(buffer: Buffer): Promise<void> {
  const result = await scanBufferWithClamAV(buffer)
  if (!result.clean) {
    throw new Error(result.reason || 'Archivo malicioso detectado')
  }
}
