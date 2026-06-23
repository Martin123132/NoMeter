import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const requestedArgs = process.argv.slice(2)
const repositoryRoot = process.cwd()

if (hasHelpFlag(requestedArgs)) {
  showHelp()
  process.exit(0)
}

const defaultArtifactDir = resolve(repositoryRoot, 'outputs', 'release')
const defaultOutputFile = resolve(repositoryRoot, 'docs', 'release-dry-run-evidence.md')
const defaultLogDir = resolve(repositoryRoot, 'tmp', 'release-evidence-check-logs')

const defaultEvidenceArgs = [
  ['--artifact-dir', defaultArtifactDir],
  ['--output-file', defaultOutputFile],
  ['--lint-evidence', resolve(defaultLogDir, 'lint.log')],
  ['--build-evidence', resolve(defaultLogDir, 'build.log')],
  ['--native-doctor-evidence', resolve(defaultLogDir, 'native-doctor.log')],
  ['--smoke-evidence', resolve(defaultLogDir, 'release-smoke.log')],
  ['--review-check-evidence', resolve(defaultLogDir, 'release-review-check.log')],
  ['--maintenance-check-evidence', resolve(defaultLogDir, 'ci-maintenance-check.log')],
  ['--first-release-check-evidence', resolve(defaultLogDir, 'first-release-check.log')],
  ['--public-safety-check-evidence', resolve(defaultLogDir, 'public-safety-check.log')],
]

const childArgs = buildChildArgs(requestedArgs, defaultEvidenceArgs)

mkdirSync(dirname(defaultOutputFile), { recursive: true })

const evidenceResult = spawnSync(process.execPath, ['scripts/release-evidence-index.mjs', ...childArgs], {
  cwd: repositoryRoot,
  stdio: 'inherit',
  shell: false,
})

if (evidenceResult.error) {
  console.error(`release-evidence failed to start: ${evidenceResult.error.message}`)
  process.exit(1)
}

if (evidenceResult.status !== 0) {
  process.exit(evidenceResult.status || 1)
}

function buildChildArgs(requestedArgs, defaults) {
  const childArgs = []
  for (const [name, value] of defaults) {
    if (!hasFlag(requestedArgs, name)) {
      childArgs.push(name, value)
    }
  }

  childArgs.push(...requestedArgs)

  return childArgs
}

function hasFlag(argv, flag) {
  return argv.includes(flag)
}

function hasHelpFlag(argv) {
  return argv.includes('--help') || argv.includes('-h')
}

function showHelp() {
  console.log(`NoMeter release evidence wrapper

Usage:
  npm run release:evidence [options]

This command calls release-evidence-index with repository defaults:
  --artifact-dir outputs/release
  --output-file docs/release-dry-run-evidence.md
  --lint-evidence tmp/release-evidence-check-logs/lint.log
  --build-evidence tmp/release-evidence-check-logs/build.log
  --native-doctor-evidence tmp/release-evidence-check-logs/native-doctor.log
  --smoke-evidence tmp/release-evidence-check-logs/release-smoke.log
  --review-check-evidence tmp/release-evidence-check-logs/release-review-check.log
  --maintenance-check-evidence tmp/release-evidence-check-logs/ci-maintenance-check.log
  --first-release-check-evidence tmp/release-evidence-check-logs/first-release-check.log
  --public-safety-check-evidence tmp/release-evidence-check-logs/public-safety-check.log

You can override any default by passing the same flag(s) supported by
release-evidence-index. Examples:

  npm run release:evidence -- --artifact-dir D:\\path\\to\\artifacts
  npm run release:evidence -- --output-file D:\\tmp\\evidence.md --lint-evidence C:\\logs\\lint.log

  Run the wrapped index command directly for all supported options:
  npm run release:evidence -- --help
`)
}
