import type { CommandContext } from '../cli.js'
import { upgradeOpencode } from '../platforms/opencode.js'

export async function runUpgrade(context: CommandContext) {
  const result = await upgradeOpencode({
    cwd: context.cwd,
    env: context.env,
    homeDir: context.homeDir,
  })

  if (!result.ok) {
    context.stderr.write(`${result.message}\n`)
    return 1
  }

  context.stdout.write('Upgraded my-island for opencode.\n')
  context.stdout.write(`Bonfire: ${result.bonfireDir}\n`)
  context.stdout.write(`Plugin: ${result.pluginPath}\n`)
  if (!result.changed) {
    context.stdout.write('Already up to date.\n')
  }
  return 0
}
