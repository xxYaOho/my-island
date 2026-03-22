import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { bonfireMatchesLegacyTemplate, readInstallState } from '../src/lib/install-state.js'
import {
  resolveAdapterSourcePath,
  resolveBonfireDir,
  resolveOpenCodePluginPath,
  resolveTemplateRoot,
} from '../src/lib/paths.js'
import { installOpencode } from '../src/platforms/opencode.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-island-install-'))
  const homeDir = path.join(rootDir, 'home')
  const bonfireDir = path.join(rootDir, 'bonfire')
  const pluginPath = path.join(homeDir, '.config', 'opencode', 'plugins', 'my-island.ts')
  fs.mkdirSync(homeDir, { recursive: true })

  return {
    rootDir,
    homeDir,
    bonfireDir,
    pluginPath,
    adapterSourcePath: resolveAdapterSourcePath(repoRoot),
    templateRoot: resolveTemplateRoot(repoRoot),
  }
}

test('resolveBonfireDir prefers BONFIRE_DIR', () => {
  const actual = resolveBonfireDir({
    env: { BONFIRE_DIR: '/tmp/custom-bonfire' },
    homeDir: '/Users/tester',
  })

  assert.equal(actual, path.resolve('/tmp/custom-bonfire'))
})

test('resolveBonfireDir falls back to ~/.local/share/bonfire', () => {
  const actual = resolveBonfireDir({ env: {}, homeDir: '/Users/tester' })
  assert.equal(actual, '/Users/tester/.local/share/bonfire')
})

test('resolveOpenCodePluginPath targets the plugins directory', () => {
  const actual = resolveOpenCodePluginPath({ env: {}, homeDir: '/Users/tester' })
  assert.equal(actual, '/Users/tester/.config/opencode/plugins/my-island.ts')
})

test('install aborts when bonfire target already exists', async () => {
  const fixture = createFixture()

  try {
    fs.mkdirSync(fixture.bonfireDir, { recursive: true })

    const result = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, false)
    assert.match(result.message, /already exists/i)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('install copies templates/bonfire into a fresh BONFIRE_DIR', async () => {
  const fixture = createFixture()

  try {
    const result = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)
    assert.equal(fs.existsSync(path.join(fixture.bonfireDir, 'memory', '.gitkeep')), true)
    assert.equal(fs.existsSync(path.join(fixture.bonfireDir, 'missions', '.gitkeep')), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('install never overwrites an existing bonfire instance', async () => {
  const fixture = createFixture()

  try {
    fs.mkdirSync(path.join(fixture.bonfireDir, 'memory'), { recursive: true })
    fs.writeFileSync(path.join(fixture.bonfireDir, 'memory', 'keep.txt'), 'do not touch')

    const result = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, false)
    assert.match(result.message, /bonfire already exists/i)
    assert.equal(fs.readFileSync(path.join(fixture.bonfireDir, 'memory', 'keep.txt'), 'utf8'), 'do not touch')
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('install copies adapters/opencode/my-island.ts into the OpenCode plugin directory', async () => {
  const fixture = createFixture()

  try {
    const result = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)
    assert.equal(fs.existsSync(fixture.pluginPath), true)

    const source = fs.readFileSync(fixture.adapterSourcePath, 'utf8')
    const deployed = fs.readFileSync(fixture.pluginPath, 'utf8')
    assert.equal(deployed, source)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('install creates the OpenCode plugins parent directory when missing', async () => {
  const fixture = createFixture()

  try {
    const result = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)
    assert.equal(fs.existsSync(path.dirname(fixture.pluginPath)), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('install writes runtime/my-island-install.json for a fresh bonfire', async () => {
  const fixture = createFixture()

  try {
    const result = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)

    const statePath = path.join(fixture.bonfireDir, 'runtime', 'my-island-install.json')
    assert.equal(fs.existsSync(statePath), true)

    const state = readInstallState(fixture.bonfireDir)
    assert.equal(state?.schemaVersion, 1)
    assert.equal(state?.platform, 'opencode')
    assert.equal(state?.bonfireDir, fixture.bonfireDir)
    assert.equal(state?.pluginPath, fixture.pluginPath)
    assert.deepEqual(state?.templateFiles, [
      'README.md',
      'docs/.gitkeep',
      'members/.gitkeep',
      'memory/.gitkeep',
      'missions/.gitkeep',
      'refs/.gitkeep',
      'runtime/.gitkeep',
      'scripts/.gitkeep',
    ])
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('install state helper treats extra legacy files as unsafe for auto-removal', () => {
  const fixture = createFixture()

  try {
    fs.cpSync(fixture.templateRoot, fixture.bonfireDir, { recursive: true })
    assert.equal(
      bonfireMatchesLegacyTemplate({
        bonfireDir: fixture.bonfireDir,
        templateRoot: fixture.templateRoot,
      }),
      true,
    )

    const userNotePath = path.join(fixture.bonfireDir, 'memory', 'user-note.md')
    fs.writeFileSync(userNotePath, 'user-authored note')

    assert.equal(
      bonfireMatchesLegacyTemplate({
        bonfireDir: fixture.bonfireDir,
        templateRoot: fixture.templateRoot,
      }),
      false,
    )
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})
