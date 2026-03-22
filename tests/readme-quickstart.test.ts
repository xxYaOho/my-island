import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

test('README includes an OpenCode Quick Start path', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')

  assert.match(readme, /bunx github:teatin\/my-island install --platform opencode/)
  assert.match(readme, /bunx github:teatin\/my-island upgrade --platform opencode/)
  assert.match(readme, /bunx github:teatin\/my-island uninstall --platform opencode/)
  assert.match(readme, /BONFIRE_DIR/)
  assert.match(readme, /~\/\.local\/share\/bonfire/)
})

test('README keeps bonfire as an internal lifecycle facility, not a public top-level command', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8')
  assert.doesNotMatch(readme, /my-island bonfire /)
})
