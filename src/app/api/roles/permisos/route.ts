import { NextResponse } from 'next/server'

import { listPermissionsByModuleController } from '@/lib/roles/controllers/list-permissions-by-module'

export async function GET() {
  return listPermissionsByModuleController()
}
