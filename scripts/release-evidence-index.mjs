import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { basename, dirname, relative, resolve } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const repositoryRoot = process.cwd()
const packageJson = loadPackageJson()
const artifactDir = resolve(repositoryRoot, args.artifactDir || 'outputs')
const outputFile = resolve(
  repositoryRoot,
  args.outputFile || 'tmp/release-dry-run-evidence-index.md'
)
const commitSha = readCommandValue(args.commitSha, 'git rev-parse HEAD')
const releaseBranch =
  args.branch || readCommandValue(undefined, 'git branch --show-current') || 'main'
const releaseVersion = args.version || packageJson.version || '0.5.0'
const strict = Boolean(args.strict)
const artifactVerification = args.artifactVerification || strict
const template = buildTemplate({
  commitSha,
  releaseBranch,
  releaseVersion,
  artifactDir,
  runUrls: {
    webQa: args.webQaRunUrl || '',
    releaseSmoke: args.releaseSmokeRunUrl || '',
    releaseReview: args.releaseReviewRunUrl || '',
    nativeDoctor: args.nativeDoctorRunUrl || '',
    maintenance: args.maintenanceRunUrl || '',
    firstRelease: args.firstReleaseRunUrl || '',
    publicSafety: args.publicSafetyRunUrl || '',
  },
  commandEvidence: {
    lint: args.lintEvidence || '',
    build: args.buildEvidence || '',
    nativeDoctor: args.nativeDoctorEvidence || '',
    smoke: args.smokeEvidence || '',
    reviewCheck: args.reviewCheckEvidence || '',
    maintenanceCheck: args.maintenanceEvidence || '',
    firstReleaseCheck: args.firstReleaseEvidence || '',
    publicSafetyCheck: args.publicSafetyEvidence || '',
  },
  artifactVerification,
  strict,
})

mkdirSync(dirname(outputFile), { recursive: true })

writeFileSync(outputFile, template, 'utf8')
console.log(`Wrote release dry-run evidence index to ${outputFile}`)

if (!existsSync(artifactDir)) {
  if (strict || artifactVerification) {
    console.error(`[release-evidence-index] evidence index requires an existing artifact directory: ${artifactDir}`)
    process.exit(1)
  }
}

if (strict && !isValidEvidencePath(outputFile)) {
  console.error(`[release-evidence-index] strict mode requires a valid output file path: ${outputFile}`)
  process.exit(1)
}

function buildTemplate({
  commitSha,
  releaseBranch,
  releaseVersion,
  artifactDir,
  runUrls,
  commandEvidence,
  artifactVerification,
}) {
  const generatedAt = new Date().toISOString()
  const artifacts = getArtifactRows(artifactDir, releaseVersion, artifactVerification)
  return `# Release Dry-Run Evidence Index

Generated: ${generatedAt}

Run metadata:
- Release version: ${releaseVersion}
- Commit: ${commitSha}
- Branch: ${releaseBranch}
- Artifact directory: ${formatArtifactDirectory(artifactDir)}

## Required command evidence

Run each command and record terminal output path:

| Command | Evidence path | Result |
| --- | --- | --- |
| npm run lint | ${formatEvidencePath(commandEvidence.lint)} | |
| npm run build | ${formatEvidencePath(commandEvidence.build)} | |
| npm run native:doctor | ${formatEvidencePath(commandEvidence.nativeDoctor)} | |
| npm run release:smoke | ${formatEvidencePath(commandEvidence.smoke)} | |
| npm run release:review-check | ${formatEvidencePath(commandEvidence.reviewCheck)} | |
| npm run ci:maintenance-check | ${formatEvidencePath(commandEvidence.maintenanceCheck)} | |
| npm run release:first-release-check | ${formatEvidencePath(commandEvidence.firstReleaseCheck)} | |
| npm run release:public-safety-check | ${formatEvidencePath(commandEvidence.publicSafetyCheck)} | |

## CI evidence URLs

| CI job | Run URL | Result |
| --- | --- | --- |
| Web QA | ${runUrls.webQa || '<paste CI run URL>'} | |
| Release metadata smoke | ${runUrls.releaseSmoke || '<paste CI run URL>'} | |
| Release review guard | ${runUrls.releaseReview || '<paste CI run URL>'} | |
| Native doctor | ${runUrls.nativeDoctor || '<paste CI run URL>'} | |
| CI maintenance check | ${runUrls.maintenance || '<paste CI run URL>'} | |
| First release readiness check | ${runUrls.firstRelease || '<paste CI run URL>'} | |
| Public safety check | ${runUrls.publicSafety || '<paste CI run URL>'} | |

## Required artifacts

${artifacts}

## Public-safe gates

- [ ] No private/local paths are embedded in release-notes.md
- [ ] release-provenance.txt includes commit, branch, timestamp, and toolchain/runtime metadata
- [ ] checksums.sha256 includes all expected public artifacts
- [ ] release-notes.md includes artifact list and verification command guidance
- [ ] npm run release:public-safety-check passes before sharing release-facing material
`
}

function getArtifactRows(artifactDir, version, shouldCheck) {
  const expectedArtifacts = [
    `NoMeter_${version}_x64-setup.exe`,
    `NoMeter_${version}_x64_en-US.msi`,
    'nometer-static.zip',
    'release-provenance.txt',
    'checksums.sha256',
    'release-notes.md',
  ]
  const rows = []
  let missing = false

  for (const fileName of expectedArtifacts) {
    const filePath = resolve(artifactDir, fileName)
    const exists = existsSync(filePath) ? 'YES' : 'NO'
    rows.push(`| ${fileName} | ${formatArtifactPath(artifactDir, fileName)} | ${exists} |`)
    if (shouldCheck && !existsSync(filePath)) {
      missing = true
    }
  }
  if (shouldCheck && missing) {
    console.error('[release-evidence-index] strict mode: missing expected artifact files')
    process.exit(1)
  }

  if (!rows.length) {
    return '| File | Location | Verified |\n| --- | --- | --- |\n| _No expected artifacts configured_ | - | - |'
  }

  return `| File | Location | Verified |\n| --- | --- | --- |\n${rows.join('\n')}`
}

function loadPackageJson() {
  try {
    const raw = readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')
    return JSON.parse(raw)
  } catch (_error) {
    return { version: '0.5.0' }
  }
}

function formatArtifactDirectory(directoryPath) {
  const relativePath = relativeToRepository(directoryPath)
  if (relativePath) {
    return relativePath
  }

  return '<artifact-dir>'
}

function formatArtifactPath(directoryPath, fileName) {
  const directoryLabel = formatArtifactDirectory(directoryPath)
  if (directoryLabel === '.') {
    return fileName
  }

  return `${directoryLabel.replace(/\/$/, '')}/${fileName}`
}

function formatEvidencePath(filePath) {
  if (!filePath) {
    return '<record path>'
  }

  return `<local-only evidence log: ${basename(filePath)}>`
}

function relativeToRepository(targetPath) {
  const relativePath = relative(repositoryRoot, resolve(targetPath)).replaceAll('\\', '/')
  if (!relativePath || relativePath === '.') {
    return '.'
  }

  if (relativePath.startsWith('../') || relativePath === '..' || /^[A-Za-z]:/.test(relativePath)) {
    return ''
  }

  return relativePath
}

function isValidEvidencePath(filePath) {
  return typeof filePath === 'string' && filePath.trim().length > 0 && filePath.endsWith('.md')
}

function readCommandValue(providedValue, fallbackCommand) {
  if (providedValue) {
    return providedValue
  }
  if (!fallbackCommand) {
    return ''
  }

  try {
    return execSync(fallbackCommand, { cwd: repositoryRoot, encoding: 'utf8' }).trim()
  } catch (_error) {
    return ''
  }
}

function parseArgs(argv) {
  const options = {
    artifactDir: undefined,
    outputFile: undefined,
    strict: false,
    artifactVerification: false,
    webQaRunUrl: '',
    releaseSmokeRunUrl: '',
    releaseReviewRunUrl: '',
    nativeDoctorRunUrl: '',
    maintenanceRunUrl: '',
    firstReleaseRunUrl: '',
    publicSafetyRunUrl: '',
    lintEvidence: '',
    buildEvidence: '',
    nativeDoctorEvidence: '',
    smokeEvidence: '',
    reviewCheckEvidence: '',
    maintenanceEvidence: '',
    firstReleaseEvidence: '',
    publicSafetyEvidence: '',
    commitSha: '',
    branch: 'main',
    version: undefined,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) {
      continue
    }

    if ([
      '--artifact-dir',
      '--output-file',
      '--web-qa-run',
      '--release-smoke-run',
      '--release-review-run',
      '--native-doctor-run',
      '--maintenance-run',
      '--first-release-run',
      '--public-safety-run',
      '--commit-sha',
      '--branch',
      '--version',
      '--lint-evidence',
      '--build-evidence',
      '--native-doctor-evidence',
      '--smoke-evidence',
      '--review-check-evidence',
      '--maintenance-check-evidence',
      '--first-release-check-evidence',
      '--public-safety-check-evidence',
    ].includes(arg)) {
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        console.error(`[release-evidence-index] missing value for ${arg}`)
        process.exit(1)
      }

      switch (arg) {
        case '--artifact-dir':
          options.artifactDir = next
          break
        case '--output-file':
          options.outputFile = next
          break
        case '--web-qa-run':
          options.webQaRunUrl = next
          break
        case '--release-smoke-run':
          options.releaseSmokeRunUrl = next
          break
        case '--release-review-run':
          options.releaseReviewRunUrl = next
          break
        case '--native-doctor-run':
          options.nativeDoctorRunUrl = next
          break
        case '--maintenance-run':
          options.maintenanceRunUrl = next
          break
        case '--first-release-run':
          options.firstReleaseRunUrl = next
          break
        case '--public-safety-run':
          options.publicSafetyRunUrl = next
          break
        case '--commit-sha':
          options.commitSha = next
          break
        case '--branch':
          options.branch = next
          break
        case '--version':
          options.version = next
          break
        case '--lint-evidence':
          options.lintEvidence = next
          break
        case '--build-evidence':
          options.buildEvidence = next
          break
        case '--native-doctor-evidence':
          options.nativeDoctorEvidence = next
          break
        case '--smoke-evidence':
          options.smokeEvidence = next
          break
        case '--review-check-evidence':
          options.reviewCheckEvidence = next
          break
        case '--maintenance-check-evidence':
          options.maintenanceEvidence = next
          break
        case '--first-release-check-evidence':
          options.firstReleaseEvidence = next
          break
        case '--public-safety-check-evidence':
          options.publicSafetyEvidence = next
          break
        default:
          break
      }
      i += 1
      continue
    }

    if (arg === '--strict') {
      options.strict = true
      continue
    }

    if (arg === '--artifact-verification' || arg === '--verify-artifacts') {
      options.artifactVerification = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      showHelp()
      process.exit(0)
    }
  }

  return options
}

function showHelp() {
  console.log(`NoMeter release dry-run evidence index generator

Usage:
  node scripts/release-evidence-index.mjs [options]

Options:
  --artifact-dir <path>       Artifact directory used for evidence (default: outputs)
  --output-file <path>        Output file path (default: tmp/release-dry-run-evidence-index.md)
  --strict                    Fail if required artifact files are missing
  --artifact-verification      Verify expected artifact files are present when creating evidence
  --commit-sha <sha>          Commit SHA for this dry run
  --branch <branch>           Branch used for the release attempt
  --version <version>         Release version
  --web-qa-run <url>          CI run URL for Web QA
  --release-smoke-run <url>    CI run URL for release smoke
  --release-review-run <url>   CI run URL for release review guard
  --native-doctor-run <url>    CI run URL for native doctor
  --maintenance-run <url>      CI run URL for CI maintenance check
  --first-release-run <url>    CI run URL for first release readiness check
  --public-safety-run <url>    CI run URL for public safety check
  --lint-evidence <path>      Local log path for npm run lint
  --build-evidence <path>     Local log path for npm run build
  --native-doctor-evidence <path>  Local log path for npm run native:doctor
  --smoke-evidence <path>     Local log path for npm run release:smoke
  --review-check-evidence <path>   Local log path for npm run release:review-check
  --maintenance-check-evidence <path> Local log path for npm run ci:maintenance-check
  --first-release-check-evidence <path> Local log path for npm run release:first-release-check
  --public-safety-check-evidence <path> Local log path for npm run release:public-safety-check
  --help, -h                  Show this help message
`)
}
