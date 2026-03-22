import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const templateRoot = path.join(repoRoot, 'templates', 'bonfire')
const expectedDirectories = [
  'docs',
  'members',
  'memory',
  'missions',
  'refs',
  'runtime',
  'scripts',
]

test('bonfire template documents external instance usage', () => {
  const readmePath = path.join(templateRoot, 'README.md')
  const readme = fs.readFileSync(readmePath, 'utf8')

  assert.match(readme, /~\/\.local\/share\/bonfire/)
  assert.match(readme, /source template/i)
  assert.match(readme, /external bonfire instance/i)
})

test('bonfire template matches documented top-level directories', () => {
  const directoryEntries = fs
    .readdirSync(templateRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  assert.deepEqual(directoryEntries, expectedDirectories)
})

test('tracked keep files exist for each bonfire template directory', () => {
  for (const directory of expectedDirectories) {
    const keepPath = path.join(templateRoot, directory, '.gitkeep')
    assert.equal(fs.existsSync(keepPath), true, `${directory} is missing .gitkeep`)
  }
})
