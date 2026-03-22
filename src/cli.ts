import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { runInstall } from './commands/install.js'
import { runUninstall } from './commands/uninstall.js'
import { runUpgrade } from './commands/upgrade.js'

export type CommandContext = {
  cwd: string
  env: NodeJS.ProcessEnv
  homeDir: string
  stdout: NodeJS.WriteStream
  stderr: NodeJS.WriteStream
}

function parsePlatform(args: string[]) {
  const index = args.indexOf('--platform')
  if (index === -1 || !args[index + 1]) {
    return null
  }

  return args[index + 1]
}

function writeUsage(stderr: NodeJS.WriteStream) {
  stderr.write('Usage: my-island <install|uninstall|upgrade> --platform opencode\n')
}

export async function run(argv: string[], io?: Partial<CommandContext>) {
  const context: CommandContext = {
    cwd: io?.cwd ?? process.cwd(),
    env: io?.env ?? process.env,
    homeDir: io?.homeDir ?? os.homedir(),
    stdout: io?.stdout ?? process.stdout,
    stderr: io?.stderr ?? process.stderr,
  }

  const [command, ...rest] = argv

  if (!command || !['install', 'uninstall', 'upgrade'].includes(command)) {
    writeUsage(context.stderr)
    return 1
  }

  const platform = parsePlatform(rest)
  if (!platform) {
    context.stderr.write('Missing required flag: --platform <value>\n')
    writeUsage(context.stderr)
    return 1
  }

  if (platform !== 'opencode') {
    context.stderr.write(`Unsupported platform: ${platform}\n`)
    return 1
  }

  if (command === 'install') {
    return runInstall(context)
  }

  if (command === 'uninstall') {
    return runUninstall(context)
  }

  return runUpgrade(context)
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const exitCode = await run(process.argv.slice(2))
  process.exitCode = exitCode
}
