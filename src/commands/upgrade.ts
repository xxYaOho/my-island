import type { CommandContext } from '../cli.js'

export async function runUpgrade(context: CommandContext) {
  context.stdout.write(
    'upgrade --platform opencode is planned next; slice 1 only installs bonfire and deploys the adapter.\n',
  )
  return 0
}
