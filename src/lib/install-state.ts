import fs from 'node:fs'
import path from 'node:path'

import { ensureParentDir, listRelativeFilesRecursive } from './fs.js'
import { resolveBonfireInstallStatePath } from './paths.js'

export type InstallState = {
  schemaVersion: 1
  platform: 'opencode'
  bonfireDir: string
  pluginPath: string
  templateFiles: string[]
}

function isInstallState(value: unknown): value is InstallState {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    candidate.schemaVersion === 1 &&
    candidate.platform === 'opencode' &&
    typeof candidate.bonfireDir === 'string' &&
    typeof candidate.pluginPath === 'string' &&
    Array.isArray(candidate.templateFiles) &&
    candidate.templateFiles.every((entry) => typeof entry === 'string')
  )
}

export function readInstallState(bonfireDir: string): InstallState | null {
  const installStatePath = resolveBonfireInstallStatePath(bonfireDir)

  if (!fs.existsSync(installStatePath)) {
    return null
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(installStatePath, 'utf8'))
    if (!isInstallState(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeInstallState(input: {
  bonfireDir: string
  pluginPath: string
  templateRoot: string
}): void {
  const installStatePath = resolveBonfireInstallStatePath(input.bonfireDir)
  const state: InstallState = {
    schemaVersion: 1,
    platform: 'opencode',
    bonfireDir: input.bonfireDir,
    pluginPath: input.pluginPath,
    templateFiles: listRelativeFilesRecursive(input.templateRoot),
  }

  ensureParentDir(installStatePath)
  fs.writeFileSync(installStatePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export function bonfireMatchesLegacyTemplate(input: {
  bonfireDir: string
  templateRoot: string
}): boolean {
  if (!fs.existsSync(input.bonfireDir)) {
    return false
  }

  const templateFiles = listRelativeFilesRecursive(input.templateRoot)
  const bonfireFiles = listRelativeFilesRecursive(input.bonfireDir)

  if (templateFiles.length !== bonfireFiles.length) {
    return false
  }

  for (let index = 0; index < templateFiles.length; index += 1) {
    if (templateFiles[index] !== bonfireFiles[index]) {
      return false
    }
  }

  for (const relativePath of templateFiles) {
    const templateFilePath = path.join(input.templateRoot, relativePath)
    const bonfireFilePath = path.join(input.bonfireDir, relativePath)
    const templateContent = fs.readFileSync(templateFilePath)
    const bonfireContent = fs.readFileSync(bonfireFilePath)

    if (!templateContent.equals(bonfireContent)) {
      return false
    }
  }

  return true
}

export function pluginLooksLikeManagedMyIslandPlugin(source: string): boolean {
  return (
    source.includes('export const myIslandPlugin = async') &&
    source.includes("'shell.env': async") &&
    source.includes("'chat.message': async") &&
    source.includes('[my-island context]')
  )
}

const RUNTIME_STATE_FILE = 'runtime/my-island-install.json'

export function bonfireMatchesInstallState(input: {
  bonfireDir: string
  installState: InstallState
}): boolean {
  const currentFiles = listRelativeFilesRecursive(input.bonfireDir).filter(
    (f) => f !== RUNTIME_STATE_FILE
  )
  const expectedFiles = input.installState.templateFiles

  for (const expectedFile of expectedFiles) {
    const fullPath = path.join(input.bonfireDir, expectedFile)
    if (!fs.existsSync(fullPath)) {
      return false
    }

    const expectedSourcePath = path.join(input.installState.bonfireDir, expectedFile)
    if (fs.existsSync(expectedSourcePath)) {
      const currentContent = fs.readFileSync(fullPath)
      const expectedContent = fs.readFileSync(expectedSourcePath)
      if (!currentContent.equals(expectedContent)) {
        return false
      }
    }
  }

  if (currentFiles.length !== expectedFiles.length) {
    return false
  }

  return true
}
