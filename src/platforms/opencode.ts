import fs from 'node:fs'
import os from 'node:os'

import { copyDirectoryRecursive, ensureParentDir } from '../lib/fs.js'
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

export async function installOpencode(input: {
  cwd: string
  env: NodeJS.ProcessEnv
  homeDir?: string
}): Promise<InstallResult> {
  const homeDir = input.homeDir ?? os.homedir()
  const repoRoot = resolveRepoRoot(input.cwd)

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

  return {
    ok: true,
    bonfireDir,
    pluginPath,
  }
}
