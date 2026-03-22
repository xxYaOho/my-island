#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const binDir = path.dirname(fileURLToPath(import.meta.url))
const cliPath = path.join(binDir, '..', 'src', 'cli.ts')
const result = spawnSync('bun', [cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})

if (result.error) {
  throw result.error
}

process.exitCode = result.status ?? 1
