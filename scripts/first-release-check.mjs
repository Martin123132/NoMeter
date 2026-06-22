import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = process.cwd()
const checklistPath = resolve(repositoryRoot, 'docs', 'first-release-checklist.md')
const readinessPath = resolve(repositoryRoot, 'docs', 'release-readiness.md')
const issueTemplatePath = resolve(repositoryRoot, '.github', 'ISSUE_TEMPLATE', 'nometer-release-review.md')
const evidenceRunbookPath = resolve(repositoryRoot, 'docs', 'release-dry-run-evidence.md')
const packageJsonPath = resolve(repositoryRoot, 'package.json')

let failed = false

checkFileContains(checklistPath, 'expected public artifacts', [
  '## Public artifacts inventory',
  'NoMeter_<version>_x64-setup.exe',
  'NoMeter_<version>_x64_en-US.msi',
  'nometer-static.zip',
  'release-provenance.txt',
  'checksums.sha256',
  'release-notes.md',
  '## Release execution commands',
  '## Public-safe review gates',
])

checkFileContains(checklistPath, 'first release command requirements', [
  'npm run release:prepare -- --artifact-dir <artifact-dir>',
  'npm run release:notes -- --artifact-dir <artifact-dir>',
  'npm run release:smoke',
  'npm run release:review-check',
  'npm run ci:maintenance-check',
  'npm run lint',
  'npm run build',
  'npm run native:doctor',
])

checkFileContains(issueTemplatePath, 'release template command coverage', [
  '`npm run release:smoke`',
  '`npm run release:prepare -- --artifact-dir <artifact-dir>`',
  '`npm run release:notes -- --artifact-dir <artifact-dir>`',
  '`npm run lint`',
  '`npm run build`',
  '`npm run native:doctor`',
  '`npm run release:evidence`',
  '`npm run release:evidence:run`',
  'tmp/release-evidence-check-logs/lint.log',
  'tmp/release-evidence-check-logs/build.log',
  'release-provenance.txt',
  'checksums.sha256',
  'release-notes.md',
  'NoMeter_*.exe',
  'NoMeter_*.msi',
  'nometer-static.zip',
  'release-dry-run-evidence.md',
])

checkFileContains(readinessPath, 'release-readiness discoverability', [
  'First release checklist',
  'first-release-checklist.md',
  'release:review-check',
  'release-smoke',
  'ci:maintenance-check',
  'release:evidence',
  'release:evidence:run',
  'tmp/release-evidence-check-logs',
  'release-dry-run-evidence.md',
  'Release dry-run evidence index',
])

checkFileContains(checklistPath, 'first release evidence checklist coverage', [
  '## Release dry-run evidence capture',
  'npm run release:evidence',
  'npm run release:evidence:run',
  'docs/release-dry-run-evidence.md',
  'release:notes -- --artifact-dir <artifact-dir>',
  'release:first-release-check',
])

checkFileContains(evidenceRunbookPath, 'runbook coverage', [
  'Release Dry-Run Evidence Index',
  'npm run lint',
  'npm run build',
  'npm run native:doctor',
  'npm run release:smoke',
  'npm run release:first-release-check',
  'NoMeter_',
  '_x64-setup.exe',
  '_x64_en-US.msi',
  'checksums.sha256',
  'release-notes.md',
  'release-provenance.txt',
])

checkFileContains(packageJsonPath, 'package script coverage', [
  '"release:evidence": "node scripts/release-evidence.mjs"',
  '"release:evidence:run": "node scripts/release-evidence-run.mjs"',
  '"release:evidence-index": "node scripts/release-evidence-index.mjs"',
])

if (failed) {
  process.exit(1)
}

console.log('first-release-check: checklist/docs/template checks passed')

function checkFileContains(filePath, label, patterns) {
  const content = loadText(filePath)
  const missing = []

  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      missing.push(pattern)
    }
  }

  if (missing.length > 0) {
    failed = true
    console.error(`[first-release-check] ${label} incomplete in ${filePath}:`)
    for (const missingEntry of missing) {
      console.error(` - missing: ${missingEntry}`)
    }
  }
}

function loadText(filePath) {
  try {
    return readFileSync(filePath, 'utf8')
  } catch (_error) {
    failed = true
    console.error(`[first-release-check] missing required file: ${filePath}`)
    return ''
  }
}
