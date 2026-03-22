import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliPath = path.join(repoRoot, 'src', 'cli.ts')

function runCli(args: string[], options: { env?: NodeJS.ProcessEnv } = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', cliPath, ...args], {
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
  })
}

function createFixture() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-island-cli-'))
  const homeDir = path.join(rootDir, 'home')
  const bonfireDir = path.join(rootDir, 'bonfire')
  const pluginPath = path.join(homeDir, '.config', 'opencode', 'plugins', 'my-island.ts')
  fs.mkdirSync(homeDir, { recursive: true })

  return { rootDir, homeDir, bonfireDir, pluginPath }
}

test('install command requires --platform', () => {
  const result = runCli(['install'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /--platform/)
})

test('unsupported platform is rejected', () => {
  const result = runCli(['install', '--platform', 'claude'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Unsupported platform/)
})

test('uninstall --platform opencode completes full cleanup through the CLI', () => {
  const fixture = createFixture()

  try {
    const env = {
      ...process.env,
      HOME: fixture.homeDir,
      BONFIRE_DIR: fixture.bonfireDir,
    }

    const install = runCli(['install', '--platform', 'opencode'], { env })
    assert.equal(install.status, 0)

    const uninstall = runCli(['uninstall', '--platform', 'opencode'], { env })

    assert.equal(uninstall.status, 0)
    assert.match(uninstall.stdout, /Uninstalled my-island for opencode\./i)
    assert.equal(fs.existsSync(fixture.bonfireDir), false)
    assert.equal(fs.existsSync(fixture.pluginPath), false)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('uninstall exits non-zero when the bonfire contains user-authored files', () => {
  const fixture = createFixture()

  try {
    const env = {
      ...process.env,
      HOME: fixture.homeDir,
      BONFIRE_DIR: fixture.bonfireDir,
    }

    const templateRoot = path.join(repoRoot, 'templates', 'bonfire')
    const adapterSourcePath = path.join(repoRoot, 'adapters', 'opencode', 'my-island.ts')

    fs.cpSync(templateRoot, fixture.bonfireDir, { recursive: true })
    fs.writeFileSync(path.join(fixture.bonfireDir, 'memory', 'user-note.md'), 'keep me')
    fs.mkdirSync(path.dirname(fixture.pluginPath), { recursive: true })
    fs.copyFileSync(adapterSourcePath, fixture.pluginPath)

    const uninstall = runCli(['uninstall', '--platform', 'opencode'], { env })

    assert.equal(uninstall.status, 1)
    assert.match(uninstall.stderr, /Refusing to uninstall/i)
    assert.equal(fs.existsSync(fixture.bonfireDir), true)
    assert.equal(fs.existsSync(fixture.pluginPath), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('upgrade --platform opencode restores a missing plugin through the CLI', () => {
  const fixture = createFixture()

  try {
    const env = {
      ...process.env,
      HOME: fixture.homeDir,
      BONFIRE_DIR: fixture.bonfireDir,
    }

    const install = runCli(['install', '--platform', 'opencode'], { env })
    assert.equal(install.status, 0)

    fs.rmSync(fixture.pluginPath, { force: true })
    assert.equal(fs.existsSync(fixture.pluginPath), false)

    const upgrade = runCli(['upgrade', '--platform', 'opencode'], { env })

    assert.equal(upgrade.status, 0)
    assert.match(upgrade.stdout, /Upgraded my-island for opencode\./i)
    assert.equal(fs.existsSync(fixture.pluginPath), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('install --platform opencode completes the full filesystem flow', () => {
  const fixture = createFixture()

  try {
    const result = runCli(['install', '--platform', 'opencode'], {
      env: {
        ...process.env,
        HOME: fixture.homeDir,
        BONFIRE_DIR: fixture.bonfireDir,
      },
    })

    assert.equal(result.status, 0)
    assert.match(result.stdout, /Installed my-island for opencode/i)
    assert.equal(fs.existsSync(path.join(fixture.bonfireDir, 'docs', '.gitkeep')), true)
    assert.equal(fs.existsSync(fixture.pluginPath), true)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})

test('install exits non-zero when bonfire already exists', () => {
  const fixture = createFixture()

  try {
    fs.mkdirSync(fixture.bonfireDir, { recursive: true })

    const result = runCli(['install', '--platform', 'opencode'], {
      env: {
        ...process.env,
        HOME: fixture.homeDir,
        BONFIRE_DIR: fixture.bonfireDir,
      },
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /already exists/i)
  } finally {
    fs.rmSync(fixture.rootDir, { recursive: true, force: true })
  }
})
