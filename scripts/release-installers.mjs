import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const repositoryRoot = process.cwd()
const args = parseArgs(process.argv.slice(2))
const packageJson = readPackageJson()
const version = packageJson.version || '0.0.0'
const arch = normalizeArch(process.arch)
const artifactDir = resolve(repositoryRoot, args.artifactDir || process.env.NOMETER_ARTIFACT_DIR || 'outputs/release')
const sourceDirs = args.sourceDirs.length > 0
  ? args.sourceDirs.map((dir) => resolve(repositoryRoot, dir))
  : [
      resolve(repositoryRoot, 'src-tauri', 'target', 'release', 'bundle', 'nsis'),
      resolve(repositoryRoot, 'src-tauri', 'target', 'release', 'bundle', 'msi'),
    ]

mkdirSync(artifactDir, { recursive: true })

const candidates = sourceDirs.flatMap(scanInstallerDir)
const nsis = newest(candidates.filter((file) => file.kind === 'nsis'))
const msi = newest(candidates.filter((file) => file.kind === 'msi'))
const copied = []

console.log('NoMeter installer artifact collector')
console.log(`Artifacts: ${artifactDir}`)

if (nsis) {
  copied.push(copyInstaller(nsis.path, `NoMeter_${version}_${arch}-setup.exe`))
} else {
  console.log('WARN NSIS installer not found.')
}

if (msi) {
  copied.push(copyInstaller(msi.path, `NoMeter_${version}_${arch}_en-US.msi`))
} else {
  console.log('WARN MSI installer not found.')
}

if (copied.length === 0) {
  console.log('No installer artifacts copied.')
  process.exit(args.strict ? 1 : 0)
}

if (args.strict && copied.length < 2) {
  console.error('Strict mode requires both NSIS and MSI installer artifacts.')
  process.exit(1)
}

console.log(`release:installers copied ${copied.length} artifact${copied.length === 1 ? '' : 's'}`)

function scanInstallerDir(sourceDir) {
  if (!existsSync(sourceDir)) return []

  const found = []
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const entryPath = join(sourceDir, entry.name)

    if (entry.isDirectory()) {
      found.push(...scanInstallerDir(entryPath))
      continue
    }

    if (!entry.isFile()) continue

    const lower = entry.name.toLowerCase()
    if (lower.endsWith('.msi')) {
      found.push({ path: entryPath, kind: 'msi', mtimeMs: statSync(entryPath).mtimeMs })
      continue
    }

    if (lower.endsWith('.exe')) {
      found.push({ path: entryPath, kind: 'nsis', mtimeMs: statSync(entryPath).mtimeMs })
    }
  }

  return found
}

function newest(files) {
  return files.sort((left, right) => right.mtimeMs - left.mtimeMs)[0] ?? null
}

function copyInstaller(sourcePath, outputName) {
  const outputPath = resolve(artifactDir, outputName)
  if (!['.exe', '.msi'].includes(extname(sourcePath).toLowerCase())) {
    throw new Error(`Refusing to copy non-installer artifact: ${sourcePath}`)
  }

  copyFileSync(sourcePath, outputPath)
  console.log(`[ok] ${relativePath(sourcePath)} -> ${relativePath(outputPath)}`)
  return outputPath
}

function parseArgs(argv) {
  const options = {
    artifactDir: '',
    sourceDirs: [],
    strict: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      showHelp()
      process.exit(0)
    }

    if (arg === '--artifact-dir' || arg === '-a') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        console.error('Missing value for --artifact-dir')
        process.exit(1)
      }
      options.artifactDir = value
      index += 1
      continue
    }

    if (arg === '--source-dir') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        console.error('Missing value for --source-dir')
        process.exit(1)
      }
      options.sourceDirs.push(value)
      index += 1
      continue
    }

    if (arg === '--strict') {
      options.strict = true
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
  console.log(`NoMeter installer artifact collector

Usage:
  npm run release:installers -- [options]

Options:
  --artifact-dir, -a  Artifact output directory (default: outputs/release)
  --source-dir <dir>  Installer source directory; can be provided more than once
  --strict            Fail unless both NSIS and MSI artifacts are copied
  --help, -h          Show this help

Default source folders:
  src-tauri/target/release/bundle/nsis
  src-tauri/target/release/bundle/msi

Outputs:
  NoMeter_<version>_<arch>-setup.exe
  NoMeter_<version>_<arch>_en-US.msi
`)
}
