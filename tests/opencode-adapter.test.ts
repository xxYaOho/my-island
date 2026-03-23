import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import myIslandPlugin, { myIslandPlugin as namedMyIslandPlugin } from '../adapters/opencode/my-island.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('shell.env injects BONFIRE_DIR and resolved MY_ISLAND_ROOT', async () => {
  const plugin = await myIslandPlugin({ directory: repoRoot })
  const output = { env: {} as Record<string, string> }

  await plugin['shell.env']({}, output)

  assert.equal(output.env.BONFIRE_DIR, path.join(os.homedir(), '.local/share/bonfire'))
  assert.equal(output.env.MY_ISLAND_ROOT, repoRoot)
})

test('first chat message injects bootstrap context without hardcoded machine path', async () => {
  const plugin = await myIslandPlugin({ directory: repoRoot })

  await plugin.event({ event: { type: 'session.created', properties: { info: { id: 's1' } } } })

  const output = {
    message: { content: 'hello' },
    parts: [] as Array<{ type: string; text: string }>,
  }

  await plugin['chat.message']({ sessionID: 's1' }, output)

  assert.equal(output.parts.length > 0, true)
  assert.match(output.parts[0].text, /my-island context/)
  assert.match(output.parts[0].text, new RegExp(repoRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(output.parts[0].text, /SPEC\.md/)
})

test('adapter source contains no machine-specific my-island hardcode', () => {
  const adapterSource = fs.readFileSync(path.join(repoRoot, 'adapters/opencode/my-island.ts'), 'utf8')

  assert.equal(adapterSource.includes("'/Users/teatin/my-island'"), false)
  assert.equal(adapterSource.includes('"/Users/teatin/my-island"'), false)
})

test('chat.message adds mission hint only for valid mission path', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-island-mission-hint-test-'))
  try {
    const missionDir = path.join(rootDir, 'missions', 'test-mission')
    fs.mkdirSync(missionDir, { recursive: true })
    const validMissionPath = path.join(missionDir, 'mission.md')
    fs.writeFileSync(validMissionPath, '# Test Mission\n')

    const plugin = await myIslandPlugin({ directory: repoRoot })

    const output = {
      message: { content: `please inspect ${validMissionPath}` },
      parts: [] as Array<{ type: string; text: string }>,
    }

    await plugin['chat.message']({ sessionID: 's2' }, output)

    assert.equal(output.parts.length >= 2, true)
    assert.match(output.parts[0].text, /my-island context/)
    const missionPart = output.parts.find(p => p.text.includes('mission context') || p.text.includes('Active mission'))
    assert.ok(missionPart, 'should have mission part')
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true })
  }
})

test('chat.message ignores invalid mission path', async () => {
  const plugin = await myIslandPlugin({ directory: repoRoot })

  const output = {
    message: { content: 'check /tmp/does-not-exist/mission.md' },
    parts: [] as Array<{ type: string; text: string }>,
  }

  await plugin['chat.message']({ sessionID: 's3' }, output)

  assert.equal(output.parts.length, 1)
  assert.match(output.parts[0].text, /my-island context/)
})

test('plugin exports both default and named factories', () => {
  assert.equal(myIslandPlugin, namedMyIslandPlugin)
})

test('first chat message bootstraps context even without session.created event', async () => {
  const plugin = await myIslandPlugin({ directory: repoRoot })

  const output = {
    message: { content: 'hello' },
    parts: [] as Array<{ type: string; text: string }>,
  }

  await plugin['chat.message']({ sessionID: 's4' }, output)

  assert.equal(output.parts.length > 0, true)
  assert.match(output.parts[0].text, /my-island context/)
})

test('worktree matching active mission injects mission context', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-island-worktree-test-'))
  try {
    const bonfireDir = path.join(rootDir, 'bonfire')
    const missionsDir = path.join(bonfireDir, 'missions', 'test-mission')
    const worktreePath = path.join(rootDir, 'worktrees', 'lucase')

    fs.mkdirSync(missionsDir, { recursive: true })
    fs.mkdirSync(path.dirname(worktreePath), { recursive: true })
    fs.mkdirSync(worktreePath, { recursive: true })

    const missionMd = path.join(missionsDir, 'mission.md')
    fs.writeFileSync(missionMd, '---\nid: test-123\nstatus: active\n---\n# Test Mission')

    const runtimeJson = path.join(missionsDir, 'runtime.json')
    fs.writeFileSync(runtimeJson, JSON.stringify({
      missionId: 'test-123',
      status: 'active',
      worktrees: { Lucase: worktreePath }
    }, null, 2))

    fs.mkdirSync(path.join(missionsDir, 'team', 'Lucase'), { recursive: true })
    fs.writeFileSync(path.join(missionsDir, 'team', 'Lucase', 'plan.md'), '# Plan')
    fs.writeFileSync(path.join(missionsDir, 'team', 'Lucase', 'report.md'), '# Report')
    fs.writeFileSync(path.join(missionsDir, 'team', 'Lucase', 'notes.md'), '# Notes')

    fs.mkdirSync(path.join(bonfireDir, 'memory'), { recursive: true })
    fs.writeFileSync(path.join(bonfireDir, 'memory', 'inheritance.md'), '# Inheritance Memory\n')
    fs.mkdirSync(path.join(bonfireDir, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(bonfireDir, 'docs', 'mission-rules.md'), '# Mission Rules\n')

    const plugin = await myIslandPlugin({ directory: repoRoot, worktree: worktreePath, bonfireDir })

    const output = {
      message: { content: 'hello' },
      parts: [] as Array<{ type: string; text: string }>,
    }

    await plugin['chat.message']({ sessionID: 's5' }, output)

    assert.equal(output.parts.length >= 2, true)
    assert.match(output.parts[0].text, /my-island context/)
    const missionPart = output.parts.find(p => p.text.startsWith('[mission context]'))
    assert.ok(missionPart, 'should have mission context part')
    assert.match(missionPart!.text, /Active mission/)
    assert.match(missionPart!.text, /Lucase/)
    assert.match(missionPart!.text, /plan\.md/)
    assert.match(missionPart!.text, /report\.md/)
    assert.match(missionPart!.text, /inheritance\.md/)
    assert.match(missionPart!.text, /mission-rules\.md/)
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true })
  }
})

test('no mission context injected when worktree does not match any active mission', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-island-worktree-test-'))
  try {
    const bonfireDir = path.join(rootDir, 'bonfire')
    const missionsDir = path.join(bonfireDir, 'missions', 'other-mission')
    const unmatchedWorktree = path.join(rootDir, 'worktrees', 'unknown')

    fs.mkdirSync(missionsDir, { recursive: true })
    fs.mkdirSync(path.dirname(unmatchedWorktree), { recursive: true })
    fs.mkdirSync(unmatchedWorktree, { recursive: true })

    const missionMd = path.join(missionsDir, 'mission.md')
    fs.writeFileSync(missionMd, '---\nid: other-123\nstatus: active\n---\n# Other Mission')

    const runtimeJson = path.join(missionsDir, 'runtime.json')
    fs.writeFileSync(runtimeJson, JSON.stringify({
      missionId: 'other-123',
      status: 'active',
      worktrees: { Alex: path.join(rootDir, 'worktrees', 'alex') }
    }, null, 2))

    const plugin = await myIslandPlugin({ directory: repoRoot, worktree: unmatchedWorktree })

    const output = {
      message: { content: 'hello' },
      parts: [] as Array<{ type: string; text: string }>,
    }

    await plugin['chat.message']({ sessionID: 's6' }, output)

    assert.equal(output.parts.length, 1)
    assert.match(output.parts[0].text, /my-island context/)
    const hasMissionContext = output.parts.some(p => p.text.includes('Active mission'))
    assert.equal(hasMissionContext, false, 'should not inject mission context when worktree does not match')
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true })
  }
})

test('ambiguous runtime data does not cause crash', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-island-ambiguous-test-'))
  try {
    const bonfireDir = path.join(rootDir, 'bonfire')
    const missionsDir = path.join(bonfireDir, 'missions', 'ambiguous-mission')
    const worktreePath = path.join(rootDir, 'worktrees', 'lucase')

    fs.mkdirSync(missionsDir, { recursive: true })
    fs.mkdirSync(path.dirname(worktreePath), { recursive: true })
    fs.mkdirSync(worktreePath, { recursive: true })

    const missionMd = path.join(missionsDir, 'mission.md')
    fs.writeFileSync(missionMd, '---\nid: ambiguous-123\nstatus: active\n---\n# Ambiguous Mission')

    const runtimeJson = path.join(missionsDir, 'runtime.json')
    fs.writeFileSync(runtimeJson, JSON.stringify({
      missionId: 'ambiguous-123',
      status: 'active',
      worktrees: { Lucase: worktreePath, Alex: worktreePath }
    }, null, 2))

    const plugin = await myIslandPlugin({ directory: repoRoot, worktree: worktreePath })

    const output = {
      message: { content: 'hello' },
      parts: [] as Array<{ type: string; text: string }>,
    }

    await plugin['chat.message']({ sessionID: 's7' }, output)

    assert.equal(output.parts.length >= 1, true)
    assert.match(output.parts[0].text, /my-island context/)
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true })
  }
})
