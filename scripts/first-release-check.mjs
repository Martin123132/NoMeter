import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = process.cwd()
const checklistPath = resolve(repositoryRoot, 'docs', 'first-release-checklist.md')
const readinessPath = resolve(repositoryRoot, 'docs', 'release-readiness.md')
const issueTemplatePath = resolve(repositoryRoot, '.github', 'ISSUE_TEMPLATE', 'nometer-release-review.md')
const evidenceRunbookPath = resolve(repositoryRoot, 'docs', 'release-dry-run-evidence.md')
const packageJsonPath = resolve(repositoryRoot, 'package.json')
const gitignorePath = resolve(repositoryRoot, '.gitignore')
const evidenceCleanupScriptPath = resolve(repositoryRoot, 'scripts', 'release-evidence-cleanup.mjs')
const publicSafetyScriptPath = resolve(repositoryRoot, 'scripts', 'public-safety-check.mjs')
const guidedFlowScriptPath = resolve(repositoryRoot, 'scripts', 'guided-flow-check.mjs')
const licensePositioningScriptPath = resolve(repositoryRoot, 'scripts', 'license-positioning-check.mjs')

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
  'npm run license:positioning-check',
  'npm run qa:guided-flow-check',
  'npm run lint',
  'npm run build',
  'npm run native:doctor',
  'npm run release:public-safety-check',
])

checkFileContains(issueTemplatePath, 'release template command coverage', [
  '`npm run release:smoke`',
  '`npm run release:prepare -- --artifact-dir <artifact-dir>`',
  '`npm run release:notes -- --artifact-dir <artifact-dir>`',
  '`npm run license:positioning-check`',
  '`npm run qa:guided-flow-check`',
  '`npm run lint`',
  '`npm run build`',
  '`npm run native:doctor`',
  '`npm run release:evidence`',
  '`npm run release:evidence:run`',
  '`npm run release:public-safety-check`',
  '<local-only evidence log: lint.log>',
  '<local-only evidence log: build.log>',
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
  'license:positioning-check',
  'qa:guided-flow-check',
  'license-positioning-check.log',
  'release:evidence',
  'release:evidence:run',
  'release:evidence:cleanup',
  'release:public-safety-check',
  'guided-flow-check.log',
  '<local-only evidence log: lint.log>',
  'release-dry-run-evidence.md',
  'Release dry-run evidence index',
  'Public safety guard',
  'Evidence log hygiene',
])

checkFileContains(checklistPath, 'first release evidence checklist coverage', [
  '## Release dry-run evidence capture',
  'npm run release:evidence',
  'npm run release:evidence:run',
  'docs/release-dry-run-evidence.md',
  '<local-only evidence log: lint.log>',
  '<local-only evidence log: license-positioning-check.log>',
  '<local-only evidence log: guided-flow-check.log>',
  'npm run release:public-safety-check',
  'npm run release:evidence:cleanup',
  'release:notes -- --artifact-dir <artifact-dir>',
  'release:first-release-check',
])

checkFileContains(checklistPath, 'evidence-log hygiene coverage', [
  '## Evidence log hygiene (pre-share)',
  'npm run release:evidence:cleanup',
  'docs/release-dry-run-evidence.md',
  'local-only output',
])

checkFileContains(evidenceRunbookPath, 'runbook coverage', [
  'Release Dry-Run Evidence Index',
  'npm run lint',
  'npm run license:positioning-check',
  'npm run qa:guided-flow-check',
  'npm run build',
  'npm run native:doctor',
  'npm run release:smoke',
  'npm run release:first-release-check',
  'npm run release:public-safety-check',
  'NoMeter_',
  '_x64-setup.exe',
  '_x64_en-US.msi',
  'checksums.sha256',
  'release-notes.md',
  'release-provenance.txt',
])

checkFileContains(gitignorePath, 'local generated output ignore coverage', [
  'outputs/',
  'tmp/',
])

checkFileContains(packageJsonPath, 'package script coverage', [
  '"release:evidence": "node scripts/release-evidence.mjs"',
  '"release:evidence:run": "node scripts/release-evidence-run.mjs"',
  '"release:evidence-index": "node scripts/release-evidence-index.mjs"',
  '"release:evidence:cleanup": "node scripts/release-evidence-cleanup.mjs"',
  '"release:public-safety-check": "node scripts/public-safety-check.mjs"',
  '"license:positioning-check": "node scripts/license-positioning-check.mjs"',
  '"qa:guided-flow-check": "node scripts/guided-flow-check.mjs"',
])

checkFileContains(issueTemplatePath, 'release template evidence log coverage', [
  '`npm run release:evidence:cleanup`',
  '`npm run release:public-safety-check`',
  '<local-only evidence log: license-positioning-check.log>',
  '<local-only evidence log: guided-flow-check.log>',
  '<local-only evidence log: public-safety-check.log>',
])

if (!existsSync(evidenceCleanupScriptPath)) {
  failed = true
  console.error(`[first-release-check] missing required file: ${evidenceCleanupScriptPath}`)
}

if (!existsSync(publicSafetyScriptPath)) {
  failed = true
  console.error(`[first-release-check] missing required file: ${publicSafetyScriptPath}`)
}

if (!existsSync(guidedFlowScriptPath)) {
  failed = true
  console.error(`[first-release-check] missing required file: ${guidedFlowScriptPath}`)
}

if (!existsSync(licensePositioningScriptPath)) {
  failed = true
  console.error(`[first-release-check] missing required file: ${licensePositioningScriptPath}`)
}

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
