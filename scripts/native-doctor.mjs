import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { delimiter, join, parse, resolve } from 'node:path'

const projectRoot = resolve('.')
const openForgeRoot = process.env.OPENFORGE_ROOT || 'D:\\Codex\\OpenForge'
const toolchainRoot = process.env.OPENFORGE_TOOLCHAIN_ROOT || 'D:\\Codex\\Toolchains'
const cargoHome = process.env.CARGO_HOME || join(toolchainRoot, 'rust', 'cargo')
const rustupHome = process.env.RUSTUP_HOME || join(toolchainRoot, 'rust', 'rustup')
const cargoBin = join(cargoHome, 'bin')
const tempDir = process.env.OPENFORGE_TEMP || 'D:\\Codex\\Temp'
const ffmpegRoot = process.env.OPENFORGE_FFMPEG_ROOT || join(openForgeRoot, 'tools', 'ffmpeg')
const pathWithToolchain = existsSync(cargoBin)
  ? `${cargoBin}${delimiter}${process.env.PATH || ''}`
  : process.env.PATH || ''
const commonEnv = {
  ...process.env,
  CARGO_HOME: cargoHome,
  RUSTUP_HOME: rustupHome,
  TEMP: tempDir,
  TMP: tempDir,
  OPENFORGE_WORK_DIR: process.env.OPENFORGE_WORK_DIR || join(openForgeRoot, 'work'),
  PATH: pathWithToolchain,
}

const localFfmpeg = findFile(ffmpegRoot, 'ffmpeg.exe')
const localFfprobe = findFile(ffmpegRoot, 'ffprobe.exe')
const checks = [
  { name: 'Node.js', command: 'node', args: ['--version'], required: true },
  npmCheck(),
  { name: 'Rust cargo', command: commandPath('cargo'), args: ['--version'], required: true },
  { name: 'Rust compiler', command: commandPath('rustc'), args: ['--version'], required: true },
  { name: 'FFmpeg', command: localFfmpeg || 'ffmpeg', args: ['-version'], required: false },
  { name: 'FFprobe', command: localFfprobe || 'ffprobe', args: ['-version'], required: false },
  { name: 'Pandoc', command: 'pandoc', args: ['--version'], required: false },
  { name: 'qpdf', command: 'qpdf', args: ['--version'], required: false },
  { name: 'Ghostscript', command: 'gswin64c', args: ['--version'], required: false },
  { name: 'Tesseract', command: 'tesseract', args: ['--version'], required: false },
  { name: 'OCRmyPDF', command: 'ocrmypdf', args: ['--version'], required: false },
]

const drive = parse(projectRoot).root.toUpperCase()
let failedRequired = false

console.log('OpenForge native doctor')
console.log(`Project: ${projectRoot}`)
console.log(`Drive: ${drive}`)
console.log(`Cargo home: ${cargoHome}`)
console.log(`Rustup home: ${rustupHome}`)
console.log(`Work dir: ${commonEnv.OPENFORGE_WORK_DIR}`)

if (drive.startsWith('C:')) {
  failedRequired = true
  console.log('FAIL project is on the system drive; move it to D: or another data drive.')
} else {
  console.log('PASS project is off the system drive.')
}

if (existsSync('src-tauri/tauri.conf.json')) {
  console.log('PASS Tauri config found.')
} else {
  failedRequired = true
  console.log('FAIL src-tauri/tauri.conf.json is missing.')
}

for (const check of checks) {
  const result = spawnSync(check.command, check.args, {
    encoding: 'utf8',
    env: commonEnv,
    shell: check.shell ?? false,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n')[0]

  if (result.status === 0) {
    console.log(`PASS ${check.name}: ${output}`)
    continue
  }

  if (check.required) {
    failedRequired = true
    console.log(`FAIL ${check.name}: not found`)
  } else {
    console.log(`WARN ${check.name}: not found; install or bundle later`)
  }
}

const hostTriple = getHostTriple()
if (hostTriple) {
  checkSidecar('FFmpeg sidecar', `src-tauri/binaries/ffmpeg-${hostTriple}.exe`, false)
  checkSidecar('FFprobe sidecar', `src-tauri/binaries/ffprobe-${hostTriple}.exe`, false)
} else {
  console.log('WARN sidecar check skipped: Rust target triple unavailable')
}

if (failedRequired) {
  process.exitCode = 1
}

function npmCheck() {
  if (process.env.npm_execpath) {
    return {
      name: 'npm',
      command: process.execPath,
      args: [process.env.npm_execpath, '--version'],
      required: true,
    }
  }

  return {
    name: 'npm',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['--version'],
    required: true,
    shell: process.platform === 'win32',
  }
}

function commandPath(command) {
  const extension = process.platform === 'win32' ? '.exe' : ''
  const localPath = join(cargoBin, `${command}${extension}`)
  return existsSync(localPath) ? localPath : command
}

function getHostTriple() {
  const result = spawnSync(commandPath('rustc'), ['--print', 'host-tuple'], {
    encoding: 'utf8',
    env: commonEnv,
    shell: false,
  })

  return result.status === 0 ? result.stdout.trim() : null
}

function checkSidecar(name, path, required) {
  if (existsSync(path)) {
    console.log(`PASS ${name}: ${path}`)
    return
  }

  if (required) {
    failedRequired = true
    console.log(`FAIL ${name}: ${path} missing`)
  } else {
    console.log(`WARN ${name}: ${path} missing; run npm.cmd run native:sync-ffmpeg`)
  }
}

function findFile(root, fileName) {
  if (!existsSync(root)) return null

  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      const match = findFile(fullPath, fileName)
      if (match) return match
      continue
    }

    if (entry.toLowerCase() === fileName.toLowerCase()) {
      return fullPath
    }
  }

  return null
}
