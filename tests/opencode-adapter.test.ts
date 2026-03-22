import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { myIslandPlugin } from '../adapters/opencode/my-island.js'

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
  const plugin = await myIslandPlugin({ directory: repoRoot })

  const validMissionPath = path.join(os.homedir(), '.local/share/bonfire/missions/2026-03-20-bootstrap-my-island/mission.md')
  const output = {
    message: { content: `please inspect ${validMissionPath}` },
    parts: [] as Array<{ type: string; text: string }>,
  }

  await plugin['chat.message']({ sessionID: 's2' }, output)

  assert.equal(output.parts.length, 1)
  assert.match(output.parts[0].text, /mission context/)
  assert.match(output.parts[0].text, /Read mission before proceeding/)
})

test('chat.message ignores invalid mission path', async () => {
  const plugin = await myIslandPlugin({ directory: repoRoot })

  const output = {
    message: { content: 'check /tmp/does-not-exist/mission.md' },
    parts: [] as Array<{ type: string; text: string }>,
  }

  await plugin['chat.message']({ sessionID: 's3' }, output)

  assert.deepEqual(output.parts, [])
})
