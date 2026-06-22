import { spawnSync } from 'node:child_process'

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  showHelp()
  process.exit(0)
}

const artifactDir = args.artifactDir || process.env.NOMETER_ARTIFACT_DIR || 'outputs'
const nodeCommand = process.platform === 'win32' ? 'node' : 'node'

console.log('NoMeter release prepare')
console.log(`Artifacts: ${artifactDir}`)
console.log(`Working dir: ${process.cwd()}`)

if (!args.skipLint) runStep('lint', npmCommand('run', ['lint']))
if (!args.skipBuild) runStep('build', npmCommand('run', ['build']))
if (!args.skipDoctor) runStep('native:doctor', npmCommand('run', ['native:doctor']))

runStep('release:provenance', [
  nodeCommand,
  ['scripts/release-provenance.mjs', '--artifact-dir', artifactDir],
])

runStep('release:checksums', [
  nodeCommand,
  [
    'scripts/release-checksums.mjs',
    '--artifact-dir',
    artifactDir,
    ...(args.strictChecksums ? ['--strict'] : []),
  ],
])

console.log('release:prepare completed successfully')

function runStep(name, [command, commandArgs]) {
  console.log(`\n[step] ${name}`)
  const isCmd = command.endsWith('.cmd')
  const spawnCommand = isCmd ? (process.env.comspec || 'cmd') : command
  const spawnArgs = isCmd ? ['/c', command, ...commandArgs] : commandArgs

  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    console.error(`[fail] ${name}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`[fail] ${name}: exited with ${result.status}`)
    process.exit(result.status || 1)
  }

  console.log(`[ok] ${name}`)
}

function npmCommand(action, argsValues) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return [executable, [action, ...argsValues]]
}

function parseArgs(argv) {
  const options = {
    artifactDir: undefined,
    skipLint: false,
    skipBuild: false,
    skipDoctor: false,
    strictChecksums: true,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
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

    if (arg === '--skip-lint') {
      options.skipLint = true
      continue
    }

    if (arg === '--skip-build') {
      options.skipBuild = true
      continue
    }

    if (arg === '--skip-doctor') {
      options.skipDoctor = true
      continue
    }

    if (arg === '--non-strict') {
      options.strictChecksums = false
      continue
    }

    console.warn(`Unrecognized argument: ${arg}`)
  }

  return options
}

function showHelp() {
  console.log(`NoMeter release prepare

Usage:
  node scripts/release-prepare.mjs [options]

Options:
  --artifact-dir, -a      Artifact directory for provenance/checksum outputs (default: outputs)
  --skip-lint             Skip npm run lint
  --skip-build            Skip npm run build
  --skip-doctor           Skip npm run native:doctor
  --non-strict            Do not fail if no matching artifacts are found
  --help, -h              Show this help message

Description:
  Runs lint, web build, native doctor, then writes release provenance and checksums.

Environment:
  NOMETER_ARTIFACT_DIR

Examples:
  node scripts/release-prepare.mjs
  node scripts/release-prepare.mjs --artifact-dir D:\\Path\\To\\Artifacts`)
}
