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

  const match = text.match(/(?:^|\s)(\S*mission\.md)/i)
  if (!match) return null

  let missionPath = match[1].trim().replace(/[.,;:!?]+$/, '')

  if (missionPath.startsWith('~/')) {
    missionPath = path.join(homeDir, missionPath.slice(2))
  }

  if (!pathExists(missionPath)) {
    return null
  }

  return path.resolve(missionPath)
}

interface RuntimeData {
  missionId: string
  status: string
  worktrees: Record<string, string>
}

function resolveActiveMissionContext(bonfireDir: string, worktree: string | undefined) {
  if (!worktree || !pathExists(bonfireDir)) {
    return null
  }

  const missionsDir = path.join(bonfireDir, 'missions')
  if (!pathExists(missionsDir)) {
    return null
  }

  let bestMatch: {
    missionPath: string
    member: string
    teamDir: string
    missionDir: string
  } | null = null

  const entries = fs.readdirSync(missionsDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const missionDir = path.join(missionsDir, entry.name)
    const runtimeJsonPath = path.join(missionDir, 'runtime.json')
    const missionMdPath = path.join(missionDir, 'mission.md')

    if (!pathExists(runtimeJsonPath) || !pathExists(missionMdPath)) continue

    let runtime: RuntimeData
    try {
      runtime = JSON.parse(fs.readFileSync(runtimeJsonPath, 'utf8'))
    } catch {
      continue
    }

    if (runtime.status !== 'active') continue

    const worktreeMatches: Array<{ member: string; memberWorktree: string }> = []
    for (const [member, memberWorktree] of Object.entries(runtime.worktrees)) {
      if (memberWorktree === worktree) {
        worktreeMatches.push({ member, memberWorktree })
      }
    }

    if (worktreeMatches.length === 1) {
      const { member } = worktreeMatches[0]
      const teamDir = path.join(missionDir, 'team', member)
      if (pathExists(teamDir)) {
        bestMatch = {
          missionPath: missionMdPath,
          member,
          teamDir,
          missionDir,
        }
        break
      }
    }
  }

  return bestMatch
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

function generateWorktreeMissionContext(input: {
  bonfireDir: string
  missionPath: string
  member: string
  teamDir: string
  missionDir: string
}) {
  const planPath = path.join(input.teamDir, 'plan.md')
  const reportPath = path.join(input.teamDir, 'report.md')
  const notesPath = path.join(input.teamDir, 'notes.md')
  const inheritancePath = path.join(input.bonfireDir, 'memory', 'inheritance.md')
  const missionRulesPath = path.join(input.bonfireDir, 'docs', 'mission-rules.md')

  const lines = ['[mission context]']
  lines.push(`- Active mission: ${input.missionPath}`)
  lines.push(`- Member: ${input.member}`)
  lines.push(`- Member plan: ${pathExists(planPath) ? planPath : 'N/A'}`)
  lines.push(`- Member report: ${pathExists(reportPath) ? reportPath : 'N/A'}`)
  lines.push(`- Member notes: ${pathExists(notesPath) ? notesPath : 'N/A'}`)
  lines.push(`- Inherited memory: ${pathExists(inheritancePath) ? inheritancePath : 'N/A'}`)
  lines.push(`- Mission rules: ${pathExists(missionRulesPath) ? missionRulesPath : 'N/A'}`)
  lines.push('- Skills remain the execution core.')
  lines.push('- Mission maintenance after creation is human-driven.')

  return lines.join('\n')
}

export const myIslandPlugin = async (pluginContext: { directory?: string; worktree?: string; bonfireDir?: string } = {}) => {
  const homeDir = os.homedir()
  const bonfireDir = pluginContext.bonfireDir ?? resolveBonfireDir(homeDir)
  const bootstrappedSessions = new Set<string>()
  const initializedSessions = new Set<string>()

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

      if (!initializedSessions.has(sessionId)) {
        initializedSessions.add(sessionId)
        bootstrappedSessions.delete(sessionId)
        const myIslandRoot = resolveMyIslandRoot(pluginContext)
        output.parts.unshift({
          type: 'text',
          text: generateBaseContext({ bonfireDir, myIslandRoot }),
        })

        const worktreeContext = resolveActiveMissionContext(bonfireDir, pluginContext.worktree)
        if (worktreeContext) {
          output.parts.push({
            type: 'text',
            text: generateWorktreeMissionContext({
              bonfireDir,
              missionPath: worktreeContext.missionPath,
              member: worktreeContext.member,
              teamDir: worktreeContext.teamDir,
              missionDir: worktreeContext.missionDir,
            }),
          })
        }
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

export default myIslandPlugin
