import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const defaultToolchainRoot = 'D:\\Codex\\Toolchains'
const defaultNoMeterRoot = 'D:\\Codex\\OpenForge'

const toolchainRoot = envValue('NOMETER_TOOLCHAIN_ROOT', 'OPENFORGE_TOOLCHAIN_ROOT') || defaultToolchainRoot
const noMeterRoot = envValue('NOMETER_ROOT', 'OPENFORGE_ROOT') || defaultNoMeterRoot
const cargoHome = process.env.CARGO_HOME || join(toolchainRoot, 'rust', 'cargo')
const rustupHome = process.env.RUSTUP_HOME || join(toolchainRoot, 'rust', 'rustup')
const tempDir = envValue('NOMETER_TEMP', 'OPENFORGE_TEMP') || 'D:\\Codex\\Temp'
const workDir = envValue('NOMETER_WORK_DIR', 'OPENFORGE_WORK_DIR') || join(noMeterRoot, 'work')
const localAppData = envValue('NOMETER_LOCALAPPDATA', 'OPENFORGE_LOCALAPPDATA') || join(noMeterRoot, 'tools', 'local-appdata')

for (const dir of [cargoHome, rustupHome, tempDir, workDir, localAppData]) {
  mkdirSync(dir, { recursive: true })
}

const commandSpec = process.argv[2] === '--' ? process.argv.slice(3) : process.argv.slice(2)

if (commandSpec.length === 0) {
  console.error('Usage: node scripts/with-d-toolchain.mjs -- <command> [...args]')
  process.exit(1)
}

const [command, ...args] = commandSpec
const cargoBin = join(cargoHome, 'bin')
const env = {
  ...process.env,
  CARGO_HOME: cargoHome,
  RUSTUP_HOME: rustupHome,
  TEMP: tempDir,
  TMP: tempDir,
  LOCALAPPDATA: localAppData,
  NOMETER_WORK_DIR: workDir,
  OPENFORGE_WORK_DIR: workDir,
  PATH: existsSync(cargoBin) ? `${cargoBin}${delimiter}${process.env.PATH || ''}` : process.env.PATH || '',
}
const { executable, executableArgs } = resolveCommand(command, args, env.PATH)

const child = spawn(executable, executableArgs,
{
  cwd: projectRoot,
  env,
  shell: false,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`${command} exited with signal ${signal}`)
    process.exit(1)
  }

  process.exit(code ?? 0)
})

function resolveCommand(command, args, pathValue) {
  if (process.platform === 'win32' && command === 'tauri') {
    return {
      executable: process.execPath,
      executableArgs: [join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), ...args],
    }
  }

  if (process.platform !== 'win32' || command.includes('\\') || command.includes('/')) {
    return { executable: command, executableArgs: args }
  }

  const extensions = command.includes('.') ? [''] : ['.cmd', '.exe', '.bat', '']
  const searchPaths = (pathValue || '').split(delimiter).filter(Boolean)

  for (const directory of searchPaths) {
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension}`)
      if (existsSync(candidate)) return { executable: candidate, executableArgs: args }
    }
  }

  return { executable: command, executableArgs: args }
}

function envValue(primaryName, legacyName) {
  return process.env[primaryName] || process.env[legacyName] || ''
}
