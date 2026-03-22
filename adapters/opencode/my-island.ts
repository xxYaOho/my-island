import fs from 'fs'
import os from 'os'
import path from 'path'

const DEFAULT_BONFIRE_DIR = '.local/share/bonfire'
const CORE_MARKER_FILES = ['SPEC.md', path.join('docs', 'adapter-model.md')]

function pathExists(targetPath: string) {
  try {
    return fs.existsSync(targetPath)
  } catch {
    return false
  }
}

function hasCoreMarkers(rootPath: string) {
  return CORE_MARKER_FILES.every((marker) => pathExists(path.join(rootPath, marker)))
}

function findMyIslandRoot(startPath?: string) {
  if (!startPath) return null

  let currentPath = path.resolve(startPath)

  while (true) {
    if (hasCoreMarkers(currentPath)) {
      return currentPath
    }

    const parentPath = path.dirname(currentPath)
    if (parentPath === currentPath) {
      return null
    }

    currentPath = parentPath
  }
}

function resolveMyIslandRoot(input: { directory?: string; worktree?: string }) {
  if (process.env.MY_ISLAND_ROOT) {
    return path.resolve(process.env.MY_ISLAND_ROOT)
  }

  return findMyIslandRoot(input.directory) ?? findMyIslandRoot(input.worktree)
}

function resolveBonfireDir(homeDir: string) {
  if (process.env.BONFIRE_DIR) {
    return path.resolve(process.env.BONFIRE_DIR)
  }

  return path.join(homeDir, DEFAULT_BONFIRE_DIR)
}

function extractMissionPath(text: string, homeDir: string) {
  if (!text) return null

  const match = text.match(/(?:^|\s)(\S*mission\.md)(?:\s|$)/i)
  if (!match) return null

  let missionPath = match[1].trim()

  if (missionPath.startsWith('~/')) {
    missionPath = path.join(homeDir, missionPath.slice(2))
  }

  if (!pathExists(missionPath)) {
    return null
  }

  return path.resolve(missionPath)
}

function generateBaseContext(input: {
  bonfireDir: string
  myIslandRoot: string | null
}) {
  const specPath = input.myIslandRoot ? path.join(input.myIslandRoot, 'SPEC.md') : null
  const adapterModelPath = input.myIslandRoot ? path.join(input.myIslandRoot, 'docs/adapter-model.md') : null

  const specExists = specPath ? pathExists(specPath) : false
  const adapterModelExists = adapterModelPath ? pathExists(adapterModelPath) : false
  const bonfireExists = pathExists(input.bonfireDir)

  let content = '[my-island context]'

  content += '\n\n## Rule Entry'
  if (input.myIslandRoot) {
    content += `\n- my-island root: ${input.myIslandRoot}`
  } else {
    content += '\n- my-island root: unresolved (set MY_ISLAND_ROOT if needed)'
  }
  if (specExists && specPath) content += `\n- SPEC: ${specPath}`
  if (adapterModelExists && adapterModelPath) content += `\n- Adapter Model: ${adapterModelPath}`

  content += '\n\n## Core Summary'
  content += '\n- my-island: local-first ecosystem for human-agent collaboration'
  content += '\n- bonfire: information exchange space for mission, memory, docs, refs'
  content += '\n- memory: default inheritance for cross-mission experience'

  content += '\n\n## Instance'
  if (bonfireExists) {
    content += `\n- BONFIRE_DIR: ${input.bonfireDir}`
  } else {
    content += `\n- BONFIRE_DIR: ${input.bonfireDir} (not ready - bonfire does not exist)`
  }

  content += '\n\n## Mode'
  content += '\n- Default mode: discussion-first'
  content += '\n- If a mission.md path is explicitly provided, work in that mission context'

  return content
}

function generateMissionHint(missionPath: string) {
  return [
    '[mission context]',
    `- Active mission: ${missionPath}`,
    '- Read mission before proceeding.',
  ].join('\n')
}

export const myIslandPlugin = async (pluginContext: { directory?: string; worktree?: string } = {}) => {
  const homeDir = os.homedir()
  const bonfireDir = resolveBonfireDir(homeDir)
  const bootstrappedSessions = new Set<string>()

  return {
    'shell.env': async (_input: unknown, output: { env: Record<string, string> }) => {
      output.env.BONFIRE_DIR = bonfireDir
      const myIslandRoot = resolveMyIslandRoot(pluginContext)
      if (myIslandRoot) {
        output.env.MY_ISLAND_ROOT = myIslandRoot
      }
    },

    event: async ({ event }: { event: { type: string; properties?: { info?: { id?: string } } } }) => {
      if (event.type !== 'session.created') return

      const sessionId = event.properties?.info?.id
      if (sessionId) {
        bootstrappedSessions.add(sessionId)
      }
    },

    'chat.message': async (
      input: { sessionID: string },
      output: {
        message?: { content?: string }
        parts: Array<{ type: string; text: string }>
      },
    ) => {
      const sessionId = input.sessionID

      if (bootstrappedSessions.has(sessionId)) {
        bootstrappedSessions.delete(sessionId)
        const myIslandRoot = resolveMyIslandRoot(pluginContext)
        output.parts.unshift({
          type: 'text',
          text: generateBaseContext({ bonfireDir, myIslandRoot }),
        })
      }

      const missionPath = extractMissionPath(output.message?.content ?? '', homeDir)
      if (!missionPath) return

      output.parts.push({
        type: 'text',
        text: generateMissionHint(missionPath),
      })
    },
  }
}
