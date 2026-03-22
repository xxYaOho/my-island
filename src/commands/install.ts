import type { CommandContext } from '../cli.js'
import { installOpencode } from '../platforms/opencode.js'

export async function runInstall(context: CommandContext) {
  const result = await installOpencode({
    packageRoot: context.packageRoot,
    env: context.env,
    homeDir: context.homeDir,
  })

  if (!result.ok) {
    context.stderr.write(`${result.message}\n`)
    return 1
  }

  context.stdout.write('Installed my-island for opencode.\n')
  context.stdout.write(`Bonfire: ${result.bonfireDir}\n`)
  context.stdout.write(`Plugin: ${result.pluginPath}\n`)
  return 0
}
