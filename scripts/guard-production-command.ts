#!/usr/bin/env bun

const separatorIndex = Bun.argv.indexOf('--')

if (separatorIndex === -1) {
  console.error('Usage: bun scripts/guard-production-command.ts <target> -- <command> [...args]')
  process.exit(2)
}

const target = Bun.argv[2]
const command = Bun.argv.slice(separatorIndex + 1)
const confirmation = process.env.MCIS_CONFIRM_PRODUCTION
const expectedConfirmation = `allow:${target}`
const confirmations = new Set((confirmation ?? '').split(',').map((value) => value.trim()).filter(Boolean))

if (!target || command.length === 0) {
  console.error('Usage: bun scripts/guard-production-command.ts <target> -- <command> [...args]')
  process.exit(2)
}

if (!confirmations.has(expectedConfirmation)) {
  console.error(`Refusing production operation: ${target}`)
  console.error(`Set MCIS_CONFIRM_PRODUCTION=${expectedConfirmation} to run this command intentionally.`)
  console.error('Multiple operations can be comma-separated, for example: allow:predeploy,allow:deploy')
  process.exit(1)
}

const result = Bun.spawnSync(command, {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
  env: process.env,
})

process.exit(result.exitCode ?? 1)
