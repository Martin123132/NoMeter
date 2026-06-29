import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { delimiter, join, parse, resolve } from 'node:path'

const projectRoot = resolve('.')
const noMeterRoot = envValue('NOMETER_ROOT', 'OPENFORGE_ROOT') || 'D:\\Codex\\OpenForge'
const toolchainRoot = envValue('NOMETER_TOOLCHAIN_ROOT', 'OPENFORGE_TOOLCHAIN_ROOT') || 'D:\\Codex\\Toolchains'
const cargoHome = process.env.CARGO_HOME || join(toolchainRoot, 'rust', 'cargo')
const rustupHome = process.env.RUSTUP_HOME || join(toolchainRoot, 'rust', 'rustup')
const cargoBin = join(cargoHome, 'bin')
const tempDir = envValue('NOMETER_TEMP', 'OPENFORGE_TEMP') || 'D:\\Codex\\Temp'
const ffmpegRoot = envValue('NOMETER_FFMPEG_ROOT', 'OPENFORGE_FFMPEG_ROOT') || join(noMeterRoot, 'tools', 'ffmpeg')
const pandocRoot = envValue('NOMETER_PANDOC_ROOT', 'OPENFORGE_PANDOC_ROOT') || join(noMeterRoot, 'tools', 'pandoc')
const qpdfRoot = envValue('NOMETER_QPDF_ROOT', 'OPENFORGE_QPDF_ROOT') || join(noMeterRoot, 'tools', 'qpdf')
const ghostscriptRoot = envValue('NOMETER_GHOSTSCRIPT_ROOT', 'OPENFORGE_GHOSTSCRIPT_ROOT') || join(noMeterRoot, 'tools', 'ghostscript')
const tesseractRoot = envValue('NOMETER_TESSERACT_ROOT', 'OPENFORGE_TESSERACT_ROOT') || join(noMeterRoot, 'tools', 'tesseract')
const ocrmypdfRoot = envValue('NOMETER_OCRMYPDF_ROOT', 'OPENFORGE_OCRMYPDF_ROOT') || join(noMeterRoot, 'tools', 'ocrmypdf')
const pathWithToolchain = existsSync(cargoBin)
  ? `${cargoBin}${delimiter}${process.env.PATH || ''}`
  : process.env.PATH || ''
const commonEnv = {
  ...process.env,
  CARGO_HOME: cargoHome,
  RUSTUP_HOME: rustupHome,
  TEMP: tempDir,
  TMP: tempDir,
  NOMETER_WORK_DIR: envValue('NOMETER_WORK_DIR', 'OPENFORGE_WORK_DIR') || join(noMeterRoot, 'work'),
  OPENFORGE_WORK_DIR: envValue('NOMETER_WORK_DIR', 'OPENFORGE_WORK_DIR') || join(noMeterRoot, 'work'),
  PATH: pathWithToolchain,
}
const skipRequiredChecks = process.env.NOMETER_SKIP_REQUIRED === '1'

const localFfmpeg = findFile(ffmpegRoot, 'ffmpeg.exe')
const localFfprobe = findFile(ffmpegRoot, 'ffprobe.exe')
const localPandoc = findFile(pandocRoot, 'pandoc.exe')
const localQpdf = findFile(qpdfRoot, 'qpdf.exe')
const localGhostscript = findFile(ghostscriptRoot, 'gswin64c.exe') || findFile(ghostscriptRoot, 'gs.exe')
const localTesseract = findFile(tesseractRoot, 'tesseract.exe')
const localOcrmypdf = findFile(ocrmypdfRoot, 'ocrmypdf.exe') || findFile(ocrmypdfRoot, 'ocrmypdf')
const checks = [
  { name: 'Node.js', command: 'node', args: ['--version'], required: true },
  npmCheck(),
  { name: 'Rust cargo', command: commandPath('cargo'), args: ['--version'], required: true },
  { name: 'Rust compiler', command: commandPath('rustc'), args: ['--version'], required: true },
  { name: 'FFmpeg', command: localFfmpeg || 'ffmpeg', args: ['-version'], required: false },
  { name: 'FFprobe', command: localFfprobe || 'ffprobe', args: ['-version'], required: false },
  { name: 'Pandoc', command: localPandoc || 'pandoc', args: ['--version'], required: false },
  { name: 'qpdf', command: localQpdf || 'qpdf', args: ['--version'], required: false },
  { name: 'Ghostscript', command: localGhostscript || 'gswin64c', args: ['--version'], required: false },
  { name: 'Tesseract', command: localTesseract || 'tesseract', args: ['--version'], required: false },
  { name: 'OCRmyPDF', command: localOcrmypdf || 'ocrmypdf', args: ['--version'], required: false },
]

const drive = parse(projectRoot).root.toUpperCase()
let failedRequired = false

console.log('NoMeter native doctor')
console.log(`Project: ${projectRoot}`)
console.log(`Drive: ${drive}`)
console.log(`Cargo home: ${cargoHome}`)
console.log(`Rustup home: ${rustupHome}`)
console.log(`Work dir: ${commonEnv.NOMETER_WORK_DIR}`)
console.log(`Optional Ghostscript root: ${ghostscriptRoot}`)
console.log(`Optional Tesseract root: ${tesseractRoot}`)
console.log(`Optional OCRmyPDF root: ${ocrmypdfRoot}`)

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

  if (check.required && !skipRequiredChecks) {
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
  checkSidecar('Pandoc sidecar', `src-tauri/binaries/pandoc-${hostTriple}.exe`, false)
  checkSidecar('qpdf sidecar', `src-tauri/binaries/qpdf-${hostTriple}.exe`, false)
  checkSidecar('qpdf runtime DLL', 'src-tauri/binaries/qpdf30.dll', false)
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

function envValue(primaryName, legacyName) {
  return process.env[primaryName] || process.env[legacyName] || ''
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
    console.log(`WARN ${name}: ${path} missing; run npm.cmd run native:sync-sidecars`)
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
