import { NextRequest } from 'next/server'
import { GET } from '@/app/api/clientes/route'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'

describe('GET /api/clientes', () => {
  it('returns clients', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: '1' } })
  })
})
