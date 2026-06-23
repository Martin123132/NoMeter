import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const cargoHome = process.env.CARGO_HOME || 'D:\\Codex\\Toolchains\\rust\\cargo'
const rustupHome = process.env.RUSTUP_HOME || 'D:\\Codex\\Toolchains\\rust\\rustup'
const qpdfRoot = envValue('NOMETER_QPDF_ROOT', 'OPENFORGE_QPDF_ROOT') || 'D:\\Codex\\OpenForge\\tools\\qpdf'
const binariesDir = join(projectRoot, 'src-tauri', 'binaries')
const cargoBin = join(cargoHome, 'bin')
const rustc = process.platform === 'win32' ? join(cargoBin, 'rustc.exe') : join(cargoBin, 'rustc')

const env = {
  ...process.env,
  CARGO_HOME: cargoHome,
  RUSTUP_HOME: rustupHome,
  PATH: `${cargoBin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`,
}

const host = spawnSync(existsSync(rustc) ? rustc : 'rustc', ['--print', 'host-tuple'], {
  encoding: 'utf8',
  env,
  shell: false,
})

if (host.status !== 0) {
  console.error('Could not determine Rust target triple. Install Rust first or set CARGO_HOME/RUSTUP_HOME.')
  process.exit(1)
}

const triple = host.stdout.trim()
const qpdf = findFile(qpdfRoot, 'qpdf.exe')

if (!qpdf) {
  console.error(`Could not find qpdf.exe under ${qpdfRoot}`)
  process.exit(1)
}

const qpdfBinDir = dirname(qpdf)
mkdirSync(binariesDir, { recursive: true })
copySidecar(qpdf, 'qpdf', triple)

for (const entry of readdirSync(qpdfBinDir)) {
  if (entry.toLowerCase().endsWith('.dll')) {
    const source = join(qpdfBinDir, entry)
    const destination = join(binariesDir, entry)
    copyFileSync(source, destination)
    console.log(`synced ${entry} -> ${destination}`)
  }
}

function copySidecar(source, name, triple) {
  const extension = extname(source)
  const destination = join(binariesDir, `${name}-${triple}${extension}`)
  copyFileSync(source, destination)
  console.log(`synced ${basename(source)} -> ${destination}`)
}

function findFile(root, fileName) {
  if (!existsSync(root)) return null

  const entries = readdirSync(root)
  for (const entry of entries) {
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

function envValue(primaryName, legacyName) {
  return process.env[primaryName] || process.env[legacyName] || ''
}
