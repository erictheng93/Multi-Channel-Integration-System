#!/usr/bin/env bun

const proc = Bun.spawnSync({
  cmd: [process.execPath, 'x', 'eslint', 'src', '--max-warnings', '0'],
  stdout: 'inherit',
  stderr: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
  },
})

process.exit(proc.exitCode ?? (proc.success ? 0 : 1))
