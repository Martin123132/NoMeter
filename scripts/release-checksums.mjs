import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const artifactDir = resolve(process.cwd(), args.artifactDir || process.env.NOMETER_ARTIFACT_DIR || 'outputs')
const outputFile = resolve(
  process.cwd(),
  args.outputFile || process.env.NOMETER_CHECKSUM_OUTPUT || join(artifactDir, 'checksums.sha256')
)
const userArtifacts = args.artifacts.length
  ? args.artifacts
  : (process.env.NOMETER_ARTIFACTS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
const includePatterns = userArtifacts.length > 0
  ? userArtifacts
  : ['NoMeter_*.exe', 'NoMeter_*.msi', 'nometer-static.zip']
const strictMode = args.strict || process.env.NOMETER_CHECKSUM_STRICT === '1'
const lines = []

if (!existsSync(artifactDir)) {
  console.error(`Artifact folder not found: ${artifactDir}`)
  process.exit(strictMode ? 1 : 0)
}

const files = readdirSync(artifactDir)
for (const file of files) {
  if (!includeFile(file)) continue
  const filePath = join(artifactDir, file)
  if (!statSync(filePath).isFile()) continue

  const hash = await hashSha256(filePath)
  const relativePath = relative(artifactDir, filePath)
  const entry = `${hash}  ${relativePath}`
  lines.push(entry)
  console.log(entry)
}

if (lines.length === 0) {
  console.log(`No artifact files found in: ${artifactDir}`)
  process.exit(strictMode ? 1 : 0)
}

writeFileSync(outputFile, lines.join('\n') + '\n', 'utf8')
console.log(`Wrote ${lines.length} checksums to ${outputFile}`)

function includeFile(fileName) {
  return includePatterns.some((pattern) => matchesPattern(fileName, pattern))
}

function matchesPattern(fileName, pattern) {
  if (!pattern.includes('*')) return fileName.toLowerCase() === pattern.toLowerCase()
  const escaped = pattern
    .split('*')
    .map(escapeRegex)
    .join('.*')
  const regex = new RegExp(`^${escaped}$`, 'i')
  return regex.test(fileName)
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function hashSha256(filePath) {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

function parseArgs(argv) {
  const options = {
    strict: false,
    artifacts: [],
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      showHelp()
      process.exit(0)
    }

  if (arg === '--artifact-dir' || arg === '-a') {
      const value = argv[i + 1]
      if (!value) {
        console.error('Missing value for --artifact-dir')
        process.exit(1)
      }
      options.artifactDir = value
      i += 1
      continue
    }

    if (arg === '--output-file' || arg === '-o') {
      const value = argv[i + 1]
      if (!value) {
        console.error('Missing value for --output-file')
        process.exit(1)
      }
      options.outputFile = value
      i += 1
      continue
    }

    if (arg === '--artifacts') {
      const value = argv[i + 1]
      if (!value) {
        console.error('Missing value for --artifacts')
        process.exit(1)
      }
      options.artifacts = value
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      i += 1
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

function showHelp() {
  console.log(`NoMeter checksum generator

Usage:
  node scripts/release-checksums.mjs --artifact-dir <dir> [--output-file <path>] [--artifacts <a,b,c>] [--strict]

Options:
  --artifact-dir, -a   Folder containing release artifacts
  --output-file, -o    Path for checksums output (default: <artifact-dir>/checksums.sha256)
  --artifacts          Comma-separated filename patterns, default:
                       NoMeter_*.exe, NoMeter_*.msi, nometer-static.zip
  --strict             Exit with error if no artifacts found
  --help, -h           Show this help message

Environment:
  NOMETER_ARTIFACT_DIR
  NOMETER_ARTIFACTS
  NOMETER_CHECKSUM_OUTPUT
  NOMETER_CHECKSUM_STRICT
`)
}
