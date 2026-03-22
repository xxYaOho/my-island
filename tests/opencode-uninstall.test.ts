import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  resolveAdapterSourcePath,
  resolveOpenCodePluginPath,
  resolveTemplateRoot,
} from '../src/lib/paths.js'
import { installOpencode, uninstallOpencode } from '../src/platforms/opencode.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-island-uninstall-'))
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

test('uninstall removes bonfire, plugin, and install state for a managed install', async () => {
  const fixture = createFixture()

  try {
    const installResult = await installOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })
    assert.equal(installResult.ok, true)

    const statePath = path.join(fixture.bonfireDir, 'runtime', 'my-island-install.json')
    assert.equal(fs.existsSync(statePath), true)

    const uninstallResult = await uninstallOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(uninstallResult.ok, true)
    assert.equal(fs.existsSync(fixture.pluginPath), false)
    assert.equal(fs.existsSync(fixture.bonfireDir), false)
    assert.equal(fs.existsSync(statePath), false)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('uninstall refuses to remove a legacy bonfire with extra user files', async () => {
  const fixture = createFixture()

  try {
    fs.cpSync(fixture.templateRoot, fixture.bonfireDir, { recursive: true })

    const userFilePath = path.join(fixture.bonfireDir, 'memory', 'user-note.md')
    fs.writeFileSync(userFilePath, 'keep me')

    fs.mkdirSync(path.dirname(fixture.pluginPath), { recursive: true })
    fs.copyFileSync(fixture.adapterSourcePath, fixture.pluginPath)

    const uninstallResult = await uninstallOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(uninstallResult.ok, false)
    assert.equal(fs.existsSync(fixture.bonfireDir), true)
    assert.equal(fs.existsSync(fixture.pluginPath), true)
    assert.equal(fs.existsSync(userFilePath), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('uninstall removes a legacy template-only bonfire when it still matches the shipped template exactly', async () => {
  const fixture = createFixture()

  try {
    fs.cpSync(fixture.templateRoot, fixture.bonfireDir, { recursive: true })
    fs.mkdirSync(path.dirname(fixture.pluginPath), { recursive: true })
    fs.copyFileSync(fixture.adapterSourcePath, fixture.pluginPath)

    const uninstallResult = await uninstallOpencode({
      cwd: repoRoot,
      env: { BONFIRE_DIR: fixture.bonfireDir },
      homeDir: fixture.homeDir,
    })

    assert.equal(uninstallResult.ok, true)
    assert.equal(fs.existsSync(fixture.pluginPath), false)
    assert.equal(fs.existsSync(fixture.bonfireDir), false)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})
