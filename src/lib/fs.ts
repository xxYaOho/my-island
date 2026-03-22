import fs from 'node:fs'
import path from 'node:path'

export function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function copyDirectoryRecursive(sourceDir: string, targetDir: string) {
  fs.cpSync(sourceDir, targetDir, { recursive: true })
}
