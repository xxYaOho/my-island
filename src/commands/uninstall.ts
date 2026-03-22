import type { CommandContext } from '../cli.js'
import { uninstallOpencode } from '../platforms/opencode.js'

export async function runUninstall(context: CommandContext) {
  const result = await uninstallOpencode({
    cwd: context.cwd,
    env: context.env,
    homeDir: context.homeDir,
  })

  if (!result.ok) {
    context.stderr.write(`${result.message}\n`)
    return 1
  }

  context.stdout.write('Uninstalled my-island for opencode.\n')
  context.stdout.write(`Bonfire: ${result.removedBonfire ? result.bonfireDir : 'not found'}\n`)
  context.stdout.write(`Plugin: ${result.removedPlugin ? result.pluginPath : 'not found'}\n`)
  return 0
}
