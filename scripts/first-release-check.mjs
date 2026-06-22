import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = process.cwd()
const checklistPath = resolve(repositoryRoot, 'docs', 'first-release-checklist.md')
const readinessPath = resolve(repositoryRoot, 'docs', 'release-readiness.md')
const issueTemplatePath = resolve(repositoryRoot, '.github', 'ISSUE_TEMPLATE', 'nometer-release-review.md')

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
  'release-provenance.txt',
  'checksums.sha256',
  'release-notes.md',
  'NoMeter_*.exe',
  'NoMeter_*.msi',
  'nometer-static.zip',
])

checkFileContains(readinessPath, 'release-readiness discoverability', [
  'First release checklist',
  'first-release-checklist.md',
  'release:review-check',
  'release-smoke',
  'ci:maintenance-check',
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
