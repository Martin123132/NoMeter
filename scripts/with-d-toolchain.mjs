import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const defaultToolchainRoot = 'D:\\Codex\\Toolchains'
const defaultOpenForgeRoot = 'D:\\Codex\\OpenForge'

const toolchainRoot = process.env.OPENFORGE_TOOLCHAIN_ROOT || defaultToolchainRoot
const openForgeRoot = process.env.OPENFORGE_ROOT || defaultOpenForgeRoot
const cargoHome = process.env.CARGO_HOME || join(toolchainRoot, 'rust', 'cargo')
const rustupHome = process.env.RUSTUP_HOME || join(toolchainRoot, 'rust', 'rustup')
const tempDir = process.env.OPENFORGE_TEMP || 'D:\\Codex\\Temp'
const workDir = process.env.OPENFORGE_WORK_DIR || join(openForgeRoot, 'work')
const localAppData = process.env.OPENFORGE_LOCALAPPDATA || join(openForgeRoot, 'tools', 'local-appdata')

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
