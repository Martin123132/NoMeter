import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const fixtureDir = resolve(process.cwd(), 'tmp', 'release-smoke-artifacts')
const packageVersion = readPackageVersion()
const fixtureFiles = [
  `NoMeter_${packageVersion}_x64-portable.exe`,
  `NoMeter_${packageVersion}_x64-setup.exe`,
  `NoMeter_${packageVersion}_x64_en-US.msi`,
  'nometer-static.zip',
]

const provenanceFile = join(fixtureDir, 'release-provenance.txt')
const checksumsFile = join(fixtureDir, 'checksums.sha256')
const notesFile = join(fixtureDir, 'release-notes.md')

let cleanupEnabled = true
let exitCode = 0

try {
  console.log(`NoMeter release smoke: writing deterministic fixtures to ${fixtureDir}`)
  writeFixture()

  runReleasePrepare()
  validateSmokeOutputs()

  console.log('NoMeter release smoke passed.')
} catch (error) {
  cleanupEnabled = false
  console.error(`NoMeter release smoke failed: ${error?.message || error}`)
  exitCode = 1
} finally {
  if (cleanupEnabled) {
    rmSync(fixtureDir, { recursive: true, force: true })
    console.log(`Cleaned fixture directory ${fixtureDir}`)
  }
}

if (exitCode !== 0) {
  process.exit(exitCode)
}

function writeFixture() {
  rmSync(fixtureDir, { recursive: true, force: true })
  mkdirSync(fixtureDir, { recursive: true })

  for (const fileName of fixtureFiles) {
    const filePath = join(fixtureDir, fileName)
    const content = `NoMeter smoke fixture: ${fileName}\n`
    writeFileSync(filePath, content, 'utf8')
  }
}

function runReleasePrepare() {
  runCommand([
    'node',
    [
      'scripts/release-prepare.mjs',
      '--artifact-dir',
      fixtureDir,
      '--skip-lint',
      '--skip-build',
      '--skip-doctor',
      '--non-strict',
    ],
  ], 'release:prepare')

  runCommand([
    'node',
    ['scripts/release-notes.mjs', '--artifact-dir', fixtureDir, '--output-file', notesFile],
  ], 'release:notes')
}

function validateSmokeOutputs() {
  assertFileExists(provenanceFile, 'release provenance')
  assertFileExists(checksumsFile, 'checksums file')
  assertFileExists(notesFile, 'release notes')

  const provenance = readFileSync(provenanceFile, 'utf8')
  assertContains(provenance, 'NoMeter Release Provenance', 'provenance header')
  assertContains(provenance, 'GeneratedAt:', 'provenance generated timestamp')

  const checksums = readFileSync(checksumsFile, 'utf8')
  for (const fileName of fixtureFiles) {
    assertContains(checksums, fileName, `checksum entry for ${fileName}`)
  }

  const notes = readFileSync(notesFile, 'utf8')
  assertContains(notes, 'Release Draft', 'release notes title')
  assertContains(notes, '## Artifacts', 'release notes artifact section')
  assertContains(notes, '## Verification commands', 'release notes verification section')
}

function runCommand([command, commandArgs], stepName) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    throw new Error(`[${stepName}] spawn failure: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`[${stepName}] exited with status ${result.status}`)
  }
}

function assertFileExists(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${basename(filePath)}`)
  }
}

function assertContains(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Missing ${label} in output: expected ${JSON.stringify(expected)}`)
  }
}

function readPackageVersion() {
  const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
  const parsed = JSON.parse(packageJson)
  return parsed.version || '0.5.0'
}
