import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const args = parseArgs(process.argv.slice(2))
const projectRoot = resolve(process.cwd())
const artifactDir = resolve(projectRoot, args.artifactDir || process.env.NOMETER_ARTIFACT_DIR || 'outputs')
const defaultOutput = existsSync(artifactDir)
  ? join(artifactDir, 'release-provenance.txt')
  : join(projectRoot, 'release-provenance.txt')
const outputFile = resolve(process.cwd(), args.outputFile || process.env.NOMETER_PROVENANCE_OUTPUT || defaultOutput)

const packageJson = readJson(join(projectRoot, 'package.json'))
const packageName = packageJson?.name || 'NoMeter'
const packageVersion = packageJson?.version || 'unknown'

const provenance = [
  `NoMeter Release Provenance`,
  `Project: ${packageName}`,
  `Version: ${packageVersion}`,
  `GeneratedAt: ${new Date().toISOString()}`,
  `Node: ${commandText(['node', ['-v']])}`,
  `NPM: ${commandText(npmCommandInfo())}`,
  `Cargo: ${commandText([commandPath('cargo'), ['--version']])}`,
  `Rustc: ${commandText([commandPath('rustc'), ['--version']])}`,
  `GitCommit: ${commandText(['git', ['rev-parse', 'HEAD']])}`,
  `GitCommitShort: ${commandText(['git', ['rev-parse', '--short', 'HEAD']])}`,
  `GitBranch: ${commandText(['git', ['branch', '--show-current']]) || 'detached'}`,
  `GitTag: ${commandText(['git', ['tag', '--points-at', 'HEAD']], { fallback: 'none' })}`,
  `ArtifactsDir: ${relativePath(projectRoot, artifactDir)}`,
  '',
]

if (args.summary) {
  const changedFiles = commandText(['git', ['status', '--short']], { multiline: true })
  provenance.push('GitStatus:')
  provenance.push(changedFiles || 'clean')
  provenance.push('')
}

writeFileSync(outputFile, `${provenance.join('\n')}\n`, 'utf8')
console.log(`Wrote release provenance to ${outputFile}`)

function commandText([command, commandArgs], options = {}) {
  const { multiline = false, fallback = 'unavailable' } = options
  try {
    const isCmd = command.endsWith('.cmd')
    const spawnCommand = isCmd ? (process.env.comspec || 'cmd') : command
    const spawnArgs = isCmd ? ['/c', command, ...commandArgs] : commandArgs

    const result = spawnSync(spawnCommand, spawnArgs, {
      encoding: 'utf8',
      shell: false,
    })
    if (result.status !== 0 && result.status !== null && !result.stdout) {
      return fallback
    }
    const combined = `${result.stdout || ''}${result.stderr || ''}`.trim()
    if (!combined) return fallback
    return multiline ? combined : combined.split('\n')[0]
  } catch (_error) {
    return fallback
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (_error) {
    return {}
  }
}

function commandPath(command) {
  const extension = process.platform === 'win32' ? '.exe' : ''
  return command + extension
}

function npmCommandInfo() {
  if (process.env.npm_execpath) {
    return [process.execPath, [process.env.npm_execpath, '--version']]
  }

  if (process.platform === 'win32') {
    return ['npm.cmd', ['--version']]
  }

  return ['npm', ['--version']]
}

function parseArgs(argv) {
  const options = {
    artifactDir: undefined,
    outputFile: undefined,
    summary: true,
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

    if (arg === '--no-summary') {
      options.summary = false
      continue
    }

    console.warn(`Unrecognized argument: ${arg}`)
  }

  return options
}

function relativePath(base, target) {
  return relative(base, target).replaceAll('\\', '/')
}

function showHelp() {
  console.log(`NoMeter release provenance generator

Usage:
  node scripts/release-provenance.mjs [--artifact-dir <dir>] [--output-file <path>] [--no-summary]

Options:
  --artifact-dir, -a   Folder containing artifacts (used for provenance path default)
  --output-file, -o    Explicit output path (default: <artifact-dir>/release-provenance.txt)
  --no-summary         Skip writing git status section
  --help, -h           Show this help message

Environment:
  NOMETER_ARTIFACT_DIR
  NOMETER_PROVENANCE_OUTPUT`)
}
