import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const templateRoot = path.join(repoRoot, 'templates', 'bonfire')
const expectedDirectories = [
  'docs',
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

test('bonfire template includes mission-rules.md in docs/', () => {
  const missionRulesPath = path.join(templateRoot, 'docs', 'mission-rules.md')
  assert.equal(fs.existsSync(missionRulesPath), true, 'docs/mission-rules.md is missing from template')
})

test('bonfire template includes inheritance.md in memory/', () => {
  const inheritancePath = path.join(templateRoot, 'memory', 'inheritance.md')
  assert.equal(fs.existsSync(inheritancePath), true, 'memory/inheritance.md is missing from template')
})

test('bonfire template memory/ is a directory', () => {
  const memoryDir = path.join(templateRoot, 'memory')
  const stat = fs.statSync(memoryDir)
  assert.equal(stat.isDirectory(), true, 'memory/ must be a directory')
})

test('bonfire template treats memory/inheritance.md as the authoritative inherited-memory file', () => {
  const inheritancePath = path.join(templateRoot, 'memory', 'inheritance.md')
  const content = fs.readFileSync(inheritancePath, 'utf8')
  assert.match(content, /inheritance/i, 'inheritance.md must contain "inheritance" to clarify its purpose')
  assert.match(content, /append-only/i, 'inheritance.md must describe append-only behavior')
})

test('bonfire template mission-rules.md defines mission usability rules', () => {
  const missionRulesPath = path.join(templateRoot, 'docs', 'mission-rules.md')
  const content = fs.readFileSync(missionRulesPath, 'utf8')
  assert.match(content, /mission usability/i, 'mission-rules.md must cover mission usability')
  assert.match(content, /OpenCode/i, 'mission-rules.md must mention OpenCode')
})

test('bonfire template mission-rules.md defines single-file memory rules', () => {
  const missionRulesPath = path.join(templateRoot, 'docs', 'mission-rules.md')
  const content = fs.readFileSync(missionRulesPath, 'utf8')
  assert.match(content, /single-file memory/i, 'mission-rules.md must cover single-file memory')
  assert.match(content, /what to record/i, 'mission-rules.md must define what to record')
  assert.match(content, /what not to record/i, 'mission-rules.md must define what not to record')
})

test('bonfire template README describes bonfire as external instance, not public CLI surface', () => {
  const readmePath = path.join(templateRoot, 'README.md')
  const readme = fs.readFileSync(readmePath, 'utf8')
  assert.match(readme, /external/i, 'README must describe bonfire as external instance')
  assert.match(readme, /not.*CLI|CLI.*not/i, 'README must clarify bonfire is not a CLI surface')
})
