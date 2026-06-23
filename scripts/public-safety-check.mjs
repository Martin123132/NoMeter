import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const repositoryRoot = process.cwd()
const args = parseArgs(process.argv.slice(2))
const artifactDir = resolve(repositoryRoot, args.artifactDir || process.env.NOMETER_ARTIFACT_DIR || 'outputs/release')

const sharedFiles = [
  'README.md',
  'docs/release-readiness.md',
  'docs/first-release-checklist.md',
  'docs/release-dry-run-evidence.md',
  'docs/native-engines.md',
  'docs/proof/nometer-folder-e2e.html',
  '.github/ISSUE_TEMPLATE/nometer-release-review.md',
]

let failed = false

for (const filePath of sharedFiles) {
  scanTextFile(resolve(repositoryRoot, filePath))
}

scanDirectory(artifactDir)

if (failed) {
  process.exit(1)
}

console.log('public-safety-check: release-facing materials passed')

function scanDirectory(directoryPath) {
  if (!existsSync(directoryPath)) {
    return
  }

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = join(directoryPath, entry.name)
    scanName(entryPath, entry.name)

    if (entry.isDirectory()) {
      scanDirectory(entryPath)
      continue
    }

    if (entry.isFile() && isTextLike(entry.name)) {
      scanTextFile(entryPath)
    }
  }
}

function scanTextFile(filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return
  }

  scanName(filePath, basename(filePath))

  const content = readFileSync(filePath, 'utf8')
  const findings = findUnsafeMarkers(content)
  if (findings.length === 0) {
    return
  }

  failed = true
  console.error(`[public-safety-check] ${filePath}`)
  for (const finding of findings) {
    console.error(` - ${finding}`)
  }
}

function scanName(filePath, value) {
  const findings = findUnsafeMarkers(value)
  if (findings.length === 0) {
    return
  }

  failed = true
  console.error(`[public-safety-check] unsafe file or path name: ${filePath}`)
  for (const finding of findings) {
    console.error(` - ${finding}`)
  }
}

function findUnsafeMarkers(content) {
  const checks = [
    {
      label: 'C-drive or user-home path',
      pattern: /\b(?:C:\\|C:\/|[A-Za-z]:\\Users\\|[A-Za-z]:\/Users\/|\/Users\/|\/home\/|OneDrive\b)/gi,
    },
    {
      label: 'project-local machine path',
      pattern: /\bD:\\Codex\\OpenForge\\[^\s|)`]*/gi,
    },
    {
      label: 'raw local evidence-log path',
      pattern: /\b(?:tmp[\\/])?release-evidence-check-logs[\\/][^\s|)`]+/gi,
    },
    {
      label: 'local/private URL',
      pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|[^/\s]*(?:internal|private|corp|lan|local)[^/\s]*)/gi,
    },
    {
      label: 'file URL',
      pattern: /file:\/\//gi,
    },
    {
      label: 'secret-looking assignment',
      pattern: /\b(api[_-]?key|secret|token|password|passwd|client_secret|private_key)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,}/gi,
    },
    {
      label: 'authorization bearer credential',
      pattern: /authorization\s*:\s*bearer\s+[A-Za-z0-9_./+=-]{8,}/gi,
    },
    {
      label: 'private key material',
      pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/gi,
    },
  ]

  const findings = []
  for (const check of checks) {
    const matches = [...content.matchAll(check.pattern)]
      .map((match) => normalizeMatch(match[0]))
      .filter(Boolean)
    const visibleMatches = [...new Set(matches)].slice(0, 3)

    if (visibleMatches.length > 0) {
      findings.push(`${check.label}: ${visibleMatches.join(', ')}`)
    }
  }

  return findings
}

function normalizeMatch(value) {
  return value.trim().slice(0, 140)
}

function isTextLike(fileName) {
  return /\.(?:md|txt|sha256|json|yml|yaml|html|xml)$/i.test(fileName)
}

function parseArgs(argv) {
  const options = {
    artifactDir: '',
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

    console.warn(`Unrecognized argument: ${arg}`)
  }

  return options
}

function showHelp() {
  console.log(`NoMeter public safety check

Usage:
  node scripts/public-safety-check.mjs [--artifact-dir <dir>]

Scans release-facing docs plus generated release text files for private paths,
local URLs, raw local log references, credentials, and secret-looking strings.

Options:
  --artifact-dir, -a   Folder containing release notes/provenance/checksums
  --help, -h           Show this help message

Environment:
  NOMETER_ARTIFACT_DIR`)
}
