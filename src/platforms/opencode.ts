import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { copyDirectoryRecursive, ensureParentDir, listRelativeFilesRecursive } from '../lib/fs.js'
import {
  bonfireMatchesInstallState,
  bonfireMatchesLegacyTemplate,
  pluginLooksLikeManagedMyIslandPlugin,
  readInstallState,
  writeInstallState,
} from '../lib/install-state.js'
import {
  resolveAdapterSourcePath,
  resolveBonfireDir,
  resolveOpenCodePluginPath,
  resolveRepoRoot,
  resolveTemplateRoot,
} from '../lib/paths.js'

export type InstallResult =
  | { ok: true; bonfireDir: string; pluginPath: string }
  | { ok: false; message: string }

export type UninstallResult =
  | {
      ok: true
      bonfireDir: string
      pluginPath: string
      removedBonfire: boolean
      removedPlugin: boolean
    }
  | { ok: false; message: string }

export type UpgradeResult =
  | { ok: true; bonfireDir: string; pluginPath: string; changed: boolean }
  | { ok: false; message: string }

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

function copyMissingTemplateFiles(input: { templateRoot: string; bonfireDir: string }) {
  let changed = false

  function walk(sourceDir: string, targetDir: string) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name)
      const targetPath = path.join(targetDir, entry.name)

      if (entry.isDirectory()) {
        walk(sourcePath, targetPath)
        continue
      }

      if (entry.isFile() && !fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath)
        changed = true
      }
    }
  }

  walk(input.templateRoot, input.bonfireDir)
  return changed
}

export async function installOpencode(input: {
  packageRoot: string
  env: NodeJS.ProcessEnv
  homeDir?: string
}): Promise<InstallResult> {
  const homeDir = input.homeDir ?? os.homedir()
  const repoRoot = resolveRepoRoot(input.packageRoot)

  if (!repoRoot) {
    return { ok: false, message: 'Could not resolve my-island repository root.' }
  }

  const templateRoot = resolveTemplateRoot(repoRoot)
  const adapterSourcePath = resolveAdapterSourcePath(repoRoot)
  const bonfireDir = resolveBonfireDir({ env: input.env, homeDir })
  const pluginPath = resolveOpenCodePluginPath({ env: input.env, homeDir })

  if (!fs.existsSync(templateRoot)) {
    return { ok: false, message: `Bonfire template is missing: ${templateRoot}` }
  }

  if (!fs.existsSync(adapterSourcePath)) {
    return { ok: false, message: `OpenCode adapter source is missing: ${adapterSourcePath}` }
  }

  if (fs.existsSync(bonfireDir)) {
    return { ok: false, message: `Bonfire already exists at ${bonfireDir}` }
  }

  copyDirectoryRecursive(templateRoot, bonfireDir)
  ensureParentDir(pluginPath)
  fs.copyFileSync(adapterSourcePath, pluginPath)
  writeInstallState({ bonfireDir, pluginPath, templateRoot })

  return {
    ok: true,
    bonfireDir,
    pluginPath,
  }
}

export async function uninstallOpencode(input: {
  packageRoot: string
  env: NodeJS.ProcessEnv
  homeDir?: string
}): Promise<UninstallResult> {
  const homeDir = input.homeDir ?? os.homedir()
  const repoRoot = resolveRepoRoot(input.packageRoot)

  if (!repoRoot) {
    return { ok: false, message: 'Could not resolve my-island repository root.' }
  }

  const templateRoot = resolveTemplateRoot(repoRoot)
  const bonfireDir = resolveBonfireDir({ env: input.env, homeDir })
  const pluginPath = resolveOpenCodePluginPath({ env: input.env, homeDir })

  const bonfireExists = fs.existsSync(bonfireDir)
  const pluginExists = fs.existsSync(pluginPath)

  if (!bonfireExists && !pluginExists) {
    return { ok: false, message: `No OpenCode install found at ${bonfireDir} and ${pluginPath}.` }
  }

  if (bonfireExists) {
    const installState = readInstallState(bonfireDir)
    const hasValidInstallState = installState !== null
    const looksLikeLegacyTemplate = bonfireMatchesLegacyTemplate({
      bonfireDir,
      templateRoot,
    })

    if (!hasValidInstallState && !looksLikeLegacyTemplate) {
      return {
        ok: false,
        message: `Refusing to uninstall: bonfire at ${bonfireDir} is not recognized as my-island-managed.`,
      }
    }

    if (hasValidInstallState && installState) {
      const matchesInstallState = bonfireMatchesInstallState({
        bonfireDir,
        installState,
        templateRoot,
      })
      if (!matchesInstallState) {
        return {
          ok: false,
          message: `Refusing to uninstall: bonfire at ${bonfireDir} contains extra files or modified content.`,
        }
      }
    }
  }

  if (pluginExists) {
    let pluginContent = ''
    try {
      pluginContent = fs.readFileSync(pluginPath, 'utf8')
    } catch {
      return {
        ok: false,
        message: `Refusing to uninstall: failed to read plugin at ${pluginPath}.`,
      }
    }

    if (!pluginLooksLikeManagedMyIslandPlugin(pluginContent)) {
      return {
        ok: false,
        message: `Refusing to uninstall: plugin at ${pluginPath} is not recognized as my-island-managed.`,
      }
    }
  }

  if (pluginExists) {
    fs.rmSync(pluginPath, { force: true })
  }

  if (bonfireExists) {
    fs.rmSync(bonfireDir, { recursive: true, force: true })
  }

  return {
    ok: true,
    bonfireDir,
    pluginPath,
    removedBonfire: bonfireExists,
    removedPlugin: pluginExists,
  }
}

export async function upgradeOpencode(input: {
  packageRoot: string
  env: NodeJS.ProcessEnv
  homeDir?: string
}): Promise<UpgradeResult> {
  const homeDir = input.homeDir ?? os.homedir()
  const repoRoot = resolveRepoRoot(input.packageRoot)

  if (!repoRoot) {
    return { ok: false, message: 'Could not resolve my-island repository root.' }
  }

  const templateRoot = resolveTemplateRoot(repoRoot)
  const adapterSourcePath = resolveAdapterSourcePath(repoRoot)
  const bonfireDir = resolveBonfireDir({ env: input.env, homeDir })
  const pluginPath = resolveOpenCodePluginPath({ env: input.env, homeDir })

  if (!fs.existsSync(templateRoot)) {
    return { ok: false, message: `Bonfire template is missing: ${templateRoot}` }
  }

  if (!fs.existsSync(adapterSourcePath)) {
    return { ok: false, message: `OpenCode adapter source is missing: ${adapterSourcePath}` }
  }

  if (!fs.existsSync(bonfireDir)) {
    return {
      ok: false,
      message: `No bonfire installation found at ${bonfireDir}. Run install --platform opencode first.`,
    }
  }

  const hasValidInstallState = readInstallState(bonfireDir) !== null
  const isLegacyTemplateCompatible = bonfireMatchesLegacyTemplate({ bonfireDir, templateRoot })

  if (!hasValidInstallState && !isLegacyTemplateCompatible) {
    return {
      ok: false,
      message: `Refusing to upgrade: bonfire at ${bonfireDir} is not recognized as my-island-managed.`,
    }
  }

  const pluginExists = fs.existsSync(pluginPath)
  if (pluginExists) {
    const existingPluginSource = fs.readFileSync(pluginPath, 'utf8')
    if (!pluginLooksLikeManagedMyIslandPlugin(existingPluginSource)) {
      return {
        ok: false,
        message: `Refusing to upgrade: plugin at ${pluginPath} is not recognized as my-island-managed.`,
      }
    }
  }

  const templateFiles = listRelativeFilesRecursive(templateRoot)
  const existingState = readInstallState(bonfireDir)
  const stateIsCurrent =
    existingState !== null &&
    existingState.bonfireDir === bonfireDir &&
    existingState.pluginPath === pluginPath &&
    arraysEqual(existingState.templateFiles, templateFiles)

  let changed = false

  if (copyMissingTemplateFiles({ templateRoot, bonfireDir })) {
    changed = true
  }

  const adapterSource = fs.readFileSync(adapterSourcePath, 'utf8')
  if (!pluginExists) {
    ensureParentDir(pluginPath)
    fs.copyFileSync(adapterSourcePath, pluginPath)
    changed = true
  } else {
    const currentPluginSource = fs.readFileSync(pluginPath, 'utf8')
    if (currentPluginSource !== adapterSource) {
      fs.copyFileSync(adapterSourcePath, pluginPath)
      changed = true
    }
  }

  writeInstallState({ bonfireDir, pluginPath, templateRoot })
  if (!stateIsCurrent) {
    changed = true
  }

  return {
    ok: true,
    bonfireDir,
    pluginPath,
    changed,
  }
}
