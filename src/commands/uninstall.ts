import type { CommandContext } from '../cli.js'

export async function runUninstall(context: CommandContext) {
  context.stdout.write(
    'uninstall --platform opencode is planned next; slice 1 only installs bonfire and deploys the adapter.\n',
  )
  return 0
}
