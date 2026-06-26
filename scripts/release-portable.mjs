import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import JSZip from 'jszip'

const repositoryRoot = process.cwd()
const args = parseArgs(process.argv.slice(2))
const packageJson = readPackageJson()
const version = packageJson.version || '0.0.0'
const artifactDir = resolve(repositoryRoot, args.artifactDir || process.env.NOMETER_ARTIFACT_DIR || 'outputs/release')
const distDir = resolve(repositoryRoot, 'dist')
const targetReleaseDir = resolve(repositoryRoot, 'src-tauri', 'target', 'release')
const nativeExe = resolve(targetReleaseDir, process.platform === 'win32' ? 'nometer.exe' : 'nometer')
const arch = normalizeArch(process.arch)
const portableName = process.platform === 'win32'
  ? `NoMeter_${version}_${arch}-portable.exe`
  : `NoMeter_${version}_${arch}-portable`

mkdirSync(artifactDir, { recursive: true })

console.log('NoMeter portable release artifact builder')
console.log(`Artifacts: ${artifactDir}`)
console.log(`Version: ${version}`)

if (!args.skipBuild) {
  runStep('build web app', npmCommand(['run', 'build']))
}

if (!args.skipNative) {
  runStep('build native executable', npmCommand(['run', 'tauri', '--', 'build', '--no-bundle']))
}

if (!existsSync(distDir)) {
  console.error(`Web build output not found: ${distDir}`)
  process.exit(1)
}

const staticZip = resolve(artifactDir, 'nometer-static.zip')
await writeStaticZip(distDir, staticZip)
console.log(`[ok] wrote ${relativePath(staticZip)}`)

if (!args.skipNative) {
  if (!existsSync(nativeExe)) {
    console.error(`Native executable not found: ${nativeExe}`)
    process.exit(1)
  }

  const portablePath = resolve(artifactDir, portableName)
  copyFileSync(nativeExe, portablePath)
  console.log(`[ok] wrote ${relativePath(portablePath)}`)
}

console.log('release:portable completed successfully')

async function writeStaticZip(sourceDir, outputFile) {
  const zip = new JSZip()
  addDirectoryToZip(zip, sourceDir, sourceDir)
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
  writeFileSync(outputFile, zipBuffer)
}

function addDirectoryToZip(zip, rootDir, currentDir) {
  for (const entry of readdirSync(currentDir)) {
    const entryPath = join(currentDir, entry)
    const stats = statSync(entryPath)
    if (stats.isDirectory()) {
      addDirectoryToZip(zip, rootDir, entryPath)
      continue
    }

    if (!stats.isFile()) continue

    const zipPath = relative(rootDir, entryPath).replaceAll('\\', '/')
    zip.file(zipPath, readFileSync(entryPath))
  }
}

function runStep(label, [command, commandArgs]) {
  console.log(`\n[step] ${label}`)
  const isCmd = command.endsWith('.cmd')
  const spawnCommand = isCmd ? (process.env.comspec || 'cmd') : command
  const spawnArgs = isCmd ? ['/c', command, ...commandArgs] : commandArgs
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    console.error(`[fail] ${label}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`[fail] ${label}: exited with ${result.status}`)
    process.exit(result.status || 1)
  }

  console.log(`[ok] ${label}`)
}

function npmCommand(argsValues) {
  return [process.platform === 'win32' ? 'npm.cmd' : 'npm', argsValues]
}

function parseArgs(argv) {
  const options = {
    artifactDir: '',
    skipBuild: false,
    skipNative: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      showHelp()
      process.exit(0)
    }

    if (arg === '--artifact-dir' || arg === '-a') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        console.error('Missing value for --artifact-dir')
        process.exit(1)
      }
      options.artifactDir = value
      i += 1
      continue
    }

    if (arg === '--skip-build') {
      options.skipBuild = true
      continue
    }

    if (arg === '--skip-native') {
      options.skipNative = true
      continue
    }

    console.warn(`Unrecognized argument: ${arg}`)
  }

  return options
}

function readPackageJson() {
  try {
    return JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'))
  } catch (_error) {
    return {}
  }
}

function normalizeArch(value) {
  if (value === 'x64') return 'x64'
  if (value === 'arm64') return 'arm64'
  return value || 'unknown'
}

function relativePath(targetPath) {
  return relative(repositoryRoot, targetPath).replaceAll('\\', '/')
}

function showHelp() {
  console.log(`NoMeter portable release artifact builder

Usage:
  npm run release:portable -- [options]

Options:
  --artifact-dir, -a  Artifact output directory (default: outputs/release)
  --skip-build        Reuse the current dist/ folder
  --skip-native       Only write nometer-static.zip
  --help, -h          Show this help

Outputs:
  nometer-static.zip
  NoMeter_<version>_<arch>-portable.exe on Windows

Follow with:
  npm run release:prepare -- --artifact-dir <artifact-dir>
  npm run release:notes -- --artifact-dir <artifact-dir>
`)
}
