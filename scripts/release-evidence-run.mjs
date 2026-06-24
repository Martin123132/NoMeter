import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = process.cwd()
const requestedArgs = process.argv.slice(2)

if (hasHelpFlag(requestedArgs)) {
  showHelp()
  process.exit(0)
}

const options = parseArgs(requestedArgs)
const defaultArtifactDir = resolve(repositoryRoot, 'outputs', 'release')
const defaultOutputFile = resolve(repositoryRoot, 'docs', 'release-dry-run-evidence.md')
const defaultLogDir = resolve(repositoryRoot, 'tmp', 'release-evidence-check-logs')

const config = {
  artifactDir: resolve(repositoryRoot, options.artifactDir || defaultArtifactDir),
  outputFile: resolve(repositoryRoot, options.outputFile || defaultOutputFile),
  logs: {
    lint: resolve(repositoryRoot, options.lintEvidence || resolve(defaultLogDir, 'lint.log')),
    licensePositioning: resolve(repositoryRoot, options.licensePositioningEvidence || resolve(defaultLogDir, 'license-positioning-check.log')),
    guidedFlow: resolve(repositoryRoot, options.guidedFlowEvidence || resolve(defaultLogDir, 'guided-flow-check.log')),
    build: resolve(repositoryRoot, options.buildEvidence || resolve(defaultLogDir, 'build.log')),
    nativeDoctor: resolve(repositoryRoot, options.nativeDoctorEvidence || resolve(defaultLogDir, 'native-doctor.log')),
    smoke: resolve(repositoryRoot, options.smokeEvidence || resolve(defaultLogDir, 'release-smoke.log')),
    reviewCheck: resolve(repositoryRoot, options.reviewCheckEvidence || resolve(defaultLogDir, 'release-review-check.log')),
    maintenanceCheck: resolve(repositoryRoot, options.maintenanceCheckEvidence || resolve(defaultLogDir, 'ci-maintenance-check.log')),
    firstReleaseCheck: resolve(repositoryRoot, options.firstReleaseCheckEvidence || resolve(defaultLogDir, 'first-release-check.log')),
    publicSafetyCheck: resolve(repositoryRoot, options.publicSafetyCheckEvidence || resolve(defaultLogDir, 'public-safety-check.log')),
  },
}

const evidenceArgs = buildEvidenceArgs(config, options.rawArgs)
const checks = [
  {
    name: 'npm run lint',
    command: npmCommand('run', ['lint']),
    logFile: config.logs.lint,
  },
  {
    name: 'npm run license:positioning-check',
    command: npmCommand('run', ['license:positioning-check']),
    logFile: config.logs.licensePositioning,
  },
  {
    name: 'npm run qa:guided-flow-check',
    command: npmCommand('run', ['qa:guided-flow-check']),
    logFile: config.logs.guidedFlow,
  },
  {
    name: 'npm run build',
    command: npmCommand('run', ['build']),
    logFile: config.logs.build,
  },
  {
    name: 'npm run native:doctor',
    command: npmCommand('run', ['native:doctor']),
    logFile: config.logs.nativeDoctor,
  },
  {
    name: 'npm run release:smoke',
    command: npmCommand('run', ['release:smoke']),
    logFile: config.logs.smoke,
  },
  {
    name: 'npm run release:review-check',
    command: npmCommand('run', ['release:review-check']),
    logFile: config.logs.reviewCheck,
  },
  {
    name: 'npm run ci:maintenance-check',
    command: npmCommand('run', ['ci:maintenance-check']),
    logFile: config.logs.maintenanceCheck,
  },
  {
    name: 'npm run release:first-release-check',
    command: npmCommand('run', ['release:first-release-check']),
    logFile: config.logs.firstReleaseCheck,
  },
  {
    name: 'npm run release:public-safety-check',
    command: npmCommand('run', ['release:public-safety-check', '--', '--artifact-dir', config.artifactDir]),
    logFile: config.logs.publicSafetyCheck,
  },
]

mkdirSync(dirname(config.outputFile), { recursive: true })
mkdirSync(resolve(repositoryRoot, 'tmp', 'release-evidence-check-logs'), { recursive: true })
for (const check of checks) {
  mkdirSync(dirname(check.logFile), { recursive: true })
}

for (const check of checks) {
  runAndCaptureLog(check.name, check.command[0], check.command[1], check.logFile)
}

const evidenceResult = spawnSync(process.execPath, ['scripts/release-evidence.mjs', ...evidenceArgs], {
  cwd: repositoryRoot,
  stdio: 'inherit',
  shell: false,
})

if (evidenceResult.error) {
  console.error(`release:evidence failed to start: ${evidenceResult.error.message}`)
  process.exit(1)
}

if (evidenceResult.status !== 0) {
  process.exit(evidenceResult.status || 1)
}

function runAndCaptureLog(name, command, commandArgs, logFile) {
  const isCmd = command.endsWith('.cmd')
  const spawnCommand = isCmd ? (process.env.comspec || 'cmd') : command
  const spawnArgs = isCmd ? ['/c', command, ...commandArgs] : commandArgs
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: false,
  })

  const output = []
  const shellCommand = isCmd
    ? `${spawnCommand} ${spawnArgs.join(' ')}`
    : `${command} ${commandArgs.join(' ')}`
  output.push(`$ ${shellCommand}`)
  if (result.stdout) output.push(result.stdout.trimEnd())
  if (result.stderr) output.push(result.stderr.trimEnd())

  writeFileSync(logFile, `${output.join('\n')}\n`, 'utf8')

  if (result.error) {
    console.error(`${name} failed to start: ${result.error.message}`)
    console.error(`See: ${logFile}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`${name} failed with exit code ${result.status}`)
    console.error(`See: ${logFile}`)
    process.exit(result.status || 1)
  }

  console.log(`[release:evidence-run] ${name} done -> ${logFile}`)
}

function buildEvidenceArgs(config, rawArgs) {
  const evidenceArgs = [
    '--artifact-dir',
    config.artifactDir,
    '--output-file',
    config.outputFile,
    '--lint-evidence',
    config.logs.lint,
    '--license-positioning-evidence',
    config.logs.licensePositioning,
    '--guided-flow-evidence',
    config.logs.guidedFlow,
    '--build-evidence',
    config.logs.build,
    '--native-doctor-evidence',
    config.logs.nativeDoctor,
    '--smoke-evidence',
    config.logs.smoke,
    '--review-check-evidence',
    config.logs.reviewCheck,
    '--maintenance-check-evidence',
    config.logs.maintenanceCheck,
    '--first-release-check-evidence',
    config.logs.firstReleaseCheck,
    '--public-safety-check-evidence',
    config.logs.publicSafetyCheck,
  ]

  if (rawArgs.length > 0) {
    evidenceArgs.push(...rawArgs)
  }

  return evidenceArgs
}

function parseArgs(argv) {
  const parsed = {
    artifactDir: '',
    outputFile: '',
    lintEvidence: '',
    licensePositioningEvidence: '',
    guidedFlowEvidence: '',
    buildEvidence: '',
    nativeDoctorEvidence: '',
    smokeEvidence: '',
    reviewCheckEvidence: '',
    maintenanceCheckEvidence: '',
    firstReleaseCheckEvidence: '',
    publicSafetyCheckEvidence: '',
    rawArgs: argv,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    const value = argv[i + 1]
    if ([
      '--artifact-dir',
      '--output-file',
      '--lint-evidence',
      '--license-positioning-evidence',
      '--guided-flow-evidence',
      '--build-evidence',
      '--native-doctor-evidence',
      '--smoke-evidence',
      '--review-check-evidence',
      '--maintenance-check-evidence',
      '--first-release-check-evidence',
      '--public-safety-check-evidence',
    ].includes(arg)) {
      if (!value || value.startsWith('--')) {
        console.error(`Missing value for ${arg}`)
        process.exit(1)
      }

      switch (arg) {
        case '--artifact-dir':
          parsed.artifactDir = value
          break
        case '--output-file':
          parsed.outputFile = value
          break
        case '--lint-evidence':
          parsed.lintEvidence = value
          break
        case '--license-positioning-evidence':
          parsed.licensePositioningEvidence = value
          break
        case '--guided-flow-evidence':
          parsed.guidedFlowEvidence = value
          break
        case '--build-evidence':
          parsed.buildEvidence = value
          break
        case '--native-doctor-evidence':
          parsed.nativeDoctorEvidence = value
          break
        case '--smoke-evidence':
          parsed.smokeEvidence = value
          break
        case '--review-check-evidence':
          parsed.reviewCheckEvidence = value
          break
        case '--maintenance-check-evidence':
          parsed.maintenanceCheckEvidence = value
          break
        case '--first-release-check-evidence':
          parsed.firstReleaseCheckEvidence = value
          break
        case '--public-safety-check-evidence':
          parsed.publicSafetyCheckEvidence = value
          break
      }

      i += 1
      continue
    }
  }

  return parsed
}

function npmCommand(action, argsValues) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return [executable, [action, ...argsValues]]
}

function hasHelpFlag(argv) {
  return argv.includes('--help') || argv.includes('-h')
}

function showHelp() {
  const outputFile = resolve(repositoryRoot, 'docs', 'release-dry-run-evidence.md')
  const outputDir = resolve(repositoryRoot, 'outputs', 'release')
  const logDir = resolve(repositoryRoot, 'tmp', 'release-evidence-check-logs')

  console.log(`NoMeter release evidence run

Usage:
  npm run release:evidence:run [options]

Runs the standard evidence checks and writes logs to expected files, then
generates the evidence index:

  npm run release:evidence:run

Defaults:
  --artifact-dir outputs/release
  --output-file docs/release-dry-run-evidence.md
  --lint-evidence tmp/release-evidence-check-logs/lint.log
  --license-positioning-evidence tmp/release-evidence-check-logs/license-positioning-check.log
  --guided-flow-evidence tmp/release-evidence-check-logs/guided-flow-check.log
  --build-evidence tmp/release-evidence-check-logs/build.log
  --native-doctor-evidence tmp/release-evidence-check-logs/native-doctor.log
  --smoke-evidence tmp/release-evidence-check-logs/release-smoke.log
  --review-check-evidence tmp/release-evidence-check-logs/release-review-check.log
  --maintenance-check-evidence tmp/release-evidence-check-logs/ci-maintenance-check.log
  --first-release-check-evidence tmp/release-evidence-check-logs/first-release-check.log
  --public-safety-check-evidence tmp/release-evidence-check-logs/public-safety-check.log

You can override any path or output with:

  --artifact-dir <path>
  --output-file <path>
  --lint-evidence <path>
  --license-positioning-evidence <path>
  --guided-flow-evidence <path>
  --build-evidence <path>
  --native-doctor-evidence <path>
  --smoke-evidence <path>
  --review-check-evidence <path>
  --maintenance-check-evidence <path>
  --first-release-check-evidence <path>
  --public-safety-check-evidence <path>

Run this for a full local evidence evidence capture and check log bundle:

  npm run release:evidence:run -- --artifact-dir ${outputDir} --output-file ${outputFile}
`)
}
