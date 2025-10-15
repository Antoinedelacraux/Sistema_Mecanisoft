import type { NextRequest } from 'next/server'

import { listRolesController } from '@/lib/roles/controllers/list-roles'
import { createRoleController } from '@/lib/roles/controllers/create-role'

export async function GET(request: NextRequest) {
  return listRolesController(request)
}

export async function POST(request: NextRequest) {
  return createRoleController(request)
}
