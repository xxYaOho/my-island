import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { readInstallState } from '../src/lib/install-state.js'
import {
  resolveAdapterSourcePath,
  resolveOpenCodePluginPath,
  resolveTemplateRoot,
} from '../src/lib/paths.js'
import { installOpencode, upgradeOpencode } from '../src/platforms/opencode.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-island-upgrade-'))
  const homeDir = path.join(rootDir, 'home')
  const bonfireDir = path.join(rootDir, 'bonfire')
  const pluginPath = resolveOpenCodePluginPath({ env: {}, homeDir })
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

test('upgrade backfills runtime/my-island-install.json for a legacy bonfire', async () => {
  const fixture = createFixture()

  try {
    fs.cpSync(fixture.templateRoot, fixture.bonfireDir, { recursive: true })
    fs.mkdirSync(path.dirname(fixture.pluginPath), { recursive: true })
    fs.copyFileSync(fixture.adapterSourcePath, fixture.pluginPath)

    const result = await upgradeOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)
    const state = readInstallState(fixture.bonfireDir)
    assert.equal(state?.schemaVersion, 1)
    assert.equal(state?.platform, 'opencode')
    assert.equal(state?.bonfireDir, fixture.bonfireDir)
    assert.equal(state?.pluginPath, fixture.pluginPath)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('upgrade recreates the OpenCode plugin when bonfire exists but the plugin is missing', async () => {
  const fixture = createFixture()

  try {
    const installResult = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })
    assert.equal(installResult.ok, true)

    fs.rmSync(fixture.pluginPath, { force: true })
    assert.equal(fs.existsSync(fixture.pluginPath), false)

    const result = await upgradeOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)
    assert.equal(fs.existsSync(fixture.pluginPath), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('upgrade restores missing template scaffolding without overwriting user-authored files', async () => {
  const fixture = createFixture()

  try {
    const installResult = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })
    assert.equal(installResult.ok, true)

    const runtimeGitkeep = path.join(fixture.bonfireDir, 'runtime', '.gitkeep')
    fs.rmSync(runtimeGitkeep, { force: true })

    const userFilePath = path.join(fixture.bonfireDir, 'memory', 'user-note.md')
    fs.writeFileSync(userFilePath, 'user-owned')

    const result = await upgradeOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, true)
    assert.equal(fs.existsSync(runtimeGitkeep), true)
    assert.equal(fs.readFileSync(userFilePath, 'utf8'), 'user-owned')
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('upgrade fails when no bonfire install exists', async () => {
  const fixture = createFixture()

  try {
    const result = await upgradeOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, false)
    assert.match(result.message, /install/i)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('upgrade refuses to overwrite a plugin that does not look like a managed my-island adapter', async () => {
  const fixture = createFixture()

  try {
    fs.cpSync(fixture.templateRoot, fixture.bonfireDir, { recursive: true })
    fs.mkdirSync(path.dirname(fixture.pluginPath), { recursive: true })

    const customPlugin = 'export const customPlugin = async () => ({})\n'
    fs.writeFileSync(fixture.pluginPath, customPlugin)

    const result = await upgradeOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(result.ok, false)
    assert.match(result.message, /plugin/i)
    assert.equal(fs.readFileSync(fixture.pluginPath, 'utf8'), customPlugin)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})
