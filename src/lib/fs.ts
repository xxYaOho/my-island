import fs from 'node:fs'
import path from 'node:path'

export function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function copyDirectoryRecursive(sourceDir: string, targetDir: string) {
  fs.cpSync(sourceDir, targetDir, { recursive: true })
}

export function listRelativeFilesRecursive(rootDir: string) {
  const files: string[] = []

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }

      if (entry.isFile()) {
        const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/')
        files.push(relativePath)
      }
    }
  }

  walk(rootDir)
  files.sort()

  return files
}
