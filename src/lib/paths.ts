import fs from 'node:fs'
import path from 'node:path'

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

export function resolveBonfireDir(input: {
  env: NodeJS.ProcessEnv
  homeDir: string
}) {
  if (input.env.BONFIRE_DIR) {
    return path.resolve(input.env.BONFIRE_DIR)
  }

  return path.join(input.homeDir, DEFAULT_BONFIRE_DIR)
}

export function resolveOpenCodePluginPath(input: {
  env: NodeJS.ProcessEnv
  homeDir: string
}) {
  return path.join(input.homeDir, '.config', 'opencode', 'plugins', 'my-island.ts')
}

export function resolveRepoRoot(fromDir: string) {
  let currentPath = path.resolve(fromDir)

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

export function resolveAdapterSourcePath(repoRoot: string) {
  return path.join(repoRoot, 'adapters', 'opencode', 'my-island.ts')
}

export function resolveTemplateRoot(repoRoot: string) {
  return path.join(repoRoot, 'templates', 'bonfire')
}
