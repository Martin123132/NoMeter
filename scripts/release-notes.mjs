import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, relative } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const artifactDir = resolve(process.cwd(), args.artifactDir || process.env.NOMETER_ARTIFACT_DIR || 'outputs')
const outputFile = resolve(
  process.cwd(),
  args.outputFile || process.env.NOMETER_RELEASE_NOTES_OUTPUT || join(artifactDir, 'release-notes.md')
)
const provenanceFile = join(artifactDir, 'release-provenance.txt')
const checksumsFile = join(artifactDir, 'checksums.sha256')

const metadata = collectMetadata()
const provenance = loadProvenance()
const checksums = loadChecksums()
const artifactNames = checksums.map((item) => item.file)

if (metadata.failures.length > 0 && !args.relaxed) {
  for (const issue of metadata.failures) {
    console.error(`[release-notes] ${issue}`)
  }
  process.exit(1)
}

const releaseNotes = buildNotes({
  releaseVersion: metadata.version,
  artifactDir: relative(process.cwd(), artifactDir),
  checksums,
  provenance,
  artifacts: artifactNames,
  generatedAt: new Date().toISOString(),
  project: metadata.projectName,
})

if (args.stdout) {
  console.log(releaseNotes)
} else {
  writeFileSync(outputFile, releaseNotes, 'utf8')
  console.log(`Wrote release notes draft to ${outputFile}`)
}

function collectMetadata() {
  const packagePath = resolve(process.cwd(), 'package.json')
  let projectName = 'NoMeter'
  let version = '0.0.0'
  const failures = []

  if (!existsSync(packagePath)) {
    failures.push('package.json missing')
  } else {
    try {
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
      projectName = packageJson.name || projectName
      version = packageJson.version || version
    } catch (_error) {
      failures.push('failed to read package.json')
    }
  }

  if (!existsSync(provenanceFile)) failures.push('release-provenance.txt not found')
  if (!existsSync(checksumsFile)) failures.push('checksums.sha256 not found')

  return { projectName, version, failures }
}

function loadProvenance() {
  if (!existsSync(provenanceFile)) {
    return new Map([['ProvenanceFile', `${relative(process.cwd(), provenanceFile)}`]])
  }

  const provenanceText = readFileSync(provenanceFile, 'utf8')
  const entries = new Map()
  for (const rawLine of provenanceText.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    entries.set(key, value)
  }

  return entries
}

function loadChecksums() {
  if (!existsSync(checksumsFile)) {
    return []
  }

  const lines = readFileSync(checksumsFile, 'utf8').split('\n')
  const rows = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const match = line.match(/^([a-f0-9]{64})\s{2}(.*)$/i)
    if (!match) continue

    const [, hash, relativeFile] = match
    rows.push({
      hash,
      file: relativeFile,
      base: basename(relativeFile),
    })
  }

  return rows
}

function buildNotes({ releaseVersion, artifactDir, checksums, provenance, artifacts, generatedAt, project }) {
  const provenanceLines = {
    project: provenance.get('Project') || project || 'NoMeter',
    version: provenance.get('Version') || releaseVersion || '0.0.0',
    generated: provenance.get('GeneratedAt') || generatedAt,
    artifactsDir:
      provenance.get('ArtifactsDir') || (artifactDir ? `./${artifactDir}` : './outputs'),
    commit: provenance.get('GitCommit') || provenance.get('Commit') || 'not-available',
    commitShort: provenance.get('GitCommitShort') || provenance.get('CommitShort') || 'not-available',
    branch: provenance.get('GitBranch') || 'not-available',
  }

  const artifactRows = checksums.length
    ? checksums
        .map((entry) => `| ${entry.base} | \`${entry.hash}\` |`)
        .join('\n')
    : '| _No checksum entries found_ | _Missing_ |'

  const artifactSummary =
    checksums.length > 0
      ? `- **Artifacts:** ${artifacts.join(', ')}`
      : '- **Artifacts:** _None detected from checksums file_'

  const provenanceRows = [
    `- **Project:** ${provenanceLines.project}`,
    `- **Version:** ${provenanceLines.version}`,
    `- **Generated:** ${generatedAt}`,
    `- **Artifacts directory:** ${provenanceLines.artifactsDir}`,
    `- **Commit:** ${provenanceLines.commit}`,
    `- **Commit short:** ${provenanceLines.commitShort}`,
    `- **Branch:** ${provenanceLines.branch}`,
    `- **Build timestamp:** ${provenanceLines.generated}`,
  ]

  if (provenance.get('Node')) provenanceRows.push(`- **Node:** ${provenance.get('Node')}`)
  if (provenance.get('NPM')) provenanceRows.push(`- **NPM:** ${provenance.get('NPM')}`)
  if (provenance.get('Cargo')) provenanceRows.push(`- **Cargo:** ${provenance.get('Cargo')}`)
  if (provenance.get('Rustc')) provenanceRows.push(`- **Rustc:** ${provenance.get('Rustc')}`)

  const notes = `# ${provenanceLines.project} Release Draft

Generated for dry-run review from local metadata.

## Release Metadata

${provenanceRows.join('\n')}

${artifactSummary}

## Artifacts

| File | SHA-256 |
| --- | --- |
${artifactRows}

## Verification commands

Use the commands below against each artifact before publishing:

~~~powershell
certutil -hashfile <artifact> SHA256
Get-FileHash <artifact> -Algorithm SHA256
sha256sum <artifact>
~~~

## Release notes checklist

- [ ] Confirm version bump is intentional (expected: ${releaseVersion}).
- [ ] Confirm all target OS/arch artifacts are present.
- [ ] Confirm checksums match post-upload files.
- [ ] Confirm provenance values align with this commit.
- [ ] Add a user-facing changelog section and paste this draft into GitHub Releases.
`

  return notes
}

function parseArgs(argv) {
  const options = {
    artifactDir: undefined,
    outputFile: undefined,
    stdout: false,
    relaxed: false,
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

    if (arg === '--stdout') {
      options.stdout = true
      continue
    }

    if (arg === '--relaxed') {
      options.relaxed = true
      continue
    }

    console.warn(`Unrecognized argument: ${arg}`)
  }

  return options
}

function showHelp() {
  console.log(`NoMeter release notes draft generator

Usage:
  node scripts/release-notes.mjs [options]

Options:
  --artifact-dir, -a   Artifact directory used by release:prepare (default: outputs)
  --output-file, -o    Output path for Markdown release notes draft
  --stdout             Print draft to stdout instead of writing file
  --relaxed            Do not fail if provenance/checksum files are missing
  --help, -h           Show this help message

Inputs:
  <artifact-dir>/release-provenance.txt
  <artifact-dir>/checksums.sha256

Environment:
  NOMETER_ARTIFACT_DIR
  NOMETER_RELEASE_NOTES_OUTPUT
`)
}
