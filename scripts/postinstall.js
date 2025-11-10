#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('child_process')

console.log('Running prisma generate (postinstall)...')
try {
  const res = spawnSync('npx', ['prisma', 'generate'], { stdio: 'inherit', shell: true })
  if (res.error) {
    console.error('prisma generate error:', res.error)
    console.warn('Continuing without failing postinstall. Please run `npx prisma generate` manually.')
  } else if (res.status !== 0) {
    console.warn('prisma generate exited with non-zero status. Please run `npx prisma generate` manually.')
  } else {
    console.log('prisma generate completed successfully.')
  }
} catch (err) {
  console.error('Unexpected error running prisma generate:', err)
  console.warn('Continuing without failing postinstall. Please run `npx prisma generate` manually.')
}
