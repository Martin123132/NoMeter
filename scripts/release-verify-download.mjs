import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = process.cwd()
const packageJson = readPackageJson()
const args = parseArgs(process.argv.slice(2))
const version = args.version || packageJson.version || '0.0.0'
const tag = args.tag || `v${version}`
const repo = args.repo || process.env.NOMETER_GITHUB_REPO || 'Martin123132/NoMeter'
const downloadDir = resolve(
  repositoryRoot,
  args.downloadDir || process.env.NOMETER_RELEASE_VERIFY_DIR || 'outputs/release-download-verify'
)
const expectedAssets = args.assets.length > 0
  ? args.assets
  : [
      `NoMeter_${version}_x64-portable.exe`,
      'nometer-static.zip',
      'checksums.sha256',
      'release-provenance.txt',
    ]

const release = await getJson(`https://api.github.com/repos/${repo}/releases/tags/${tag}`)
const tagSha = await resolveTagSha(repo, tag)
const targetSha = normalizeSha(release.target_commitish)

console.log(`NoMeter release download verifier`)
console.log(`Repository: ${repo}`)
console.log(`Tag: ${tag}`)
console.log(`Target: ${targetSha}`)
console.log(`Download dir: ${downloadDir}`)

if (!targetSha || !isFullSha(targetSha)) {
  fail(`Release target is not a full commit SHA: ${release.target_commitish}`)
}

if (tagSha && tagSha !== targetSha) {
  fail(`Tag ref ${tag} points at ${tagSha}, but release target is ${targetSha}`)
}

if (args.expectedCommit) {
  const expectedCommit = resolveExpectedCommit(args.expectedCommit)
  if (expectedCommit !== targetSha) {
    fail(`Expected commit ${expectedCommit}, but release target is ${targetSha}`)
  }
}

prepareDownloadDir(downloadDir, args.clean)

const assets = new Map((release.assets || []).map((asset) => [asset.name, asset]))
for (const assetName of expectedAssets) {
  const asset = assets.get(assetName)
  if (!asset) {
    fail(`Missing release asset: ${assetName}`)
  }

  await downloadAsset(asset.browser_download_url, join(downloadDir, assetName))
  console.log(`[downloaded] ${assetName}`)
}

const checksumFile = join(downloadDir, 'checksums.sha256')
const provenanceFile = join(downloadDir, 'release-provenance.txt')
const checksumEntries = readChecksums(checksumFile)

for (const requiredChecksum of expectedAssets.filter((name) => name !== 'checksums.sha256' && name !== 'release-provenance.txt')) {
  if (!checksumEntries.has(requiredChecksum)) {
    fail(`checksums.sha256 does not include ${requiredChecksum}`)
  }
}

for (const [fileName, expectedHash] of checksumEntries.entries()) {
  const filePath = join(downloadDir, fileName)
  if (!existsSync(filePath)) {
    fail(`Checksum references missing downloaded file: ${fileName}`)
  }

  const actualHash = hashFile(filePath)
  if (actualHash !== expectedHash) {
    fail(`Checksum mismatch for ${fileName}: expected ${expectedHash}, got ${actualHash}`)
  }

  const apiDigest = assets.get(fileName)?.digest || ''
  if (apiDigest.startsWith('sha256:')) {
    const apiHash = apiDigest.slice('sha256:'.length).toLowerCase()
    if (apiHash !== actualHash) {
      fail(`GitHub asset digest mismatch for ${fileName}: expected ${apiHash}, got ${actualHash}`)
    }
  }

  console.log(`[verified] ${fileName} ${actualHash}`)
}

const checksumAssetHash = hashFile(checksumFile)
const checksumApiDigest = assets.get('checksums.sha256')?.digest || ''
if (checksumApiDigest.startsWith('sha256:') && checksumApiDigest.slice('sha256:'.length).toLowerCase() !== checksumAssetHash) {
  fail('GitHub asset digest mismatch for checksums.sha256')
}

const provenance = readProvenance(provenanceFile)
assertProvenance(provenance, {
  version,
  targetSha,
  tag,
})

console.log('release:verify-download completed successfully')

function prepareDownloadDir(directoryPath, clean) {
  if (clean && existsSync(directoryPath)) {
    rmSync(directoryPath, { recursive: true, force: true })
  }
  mkdirSync(directoryPath, { recursive: true })
}

async function downloadAsset(url, outputPath) {
  const response = await fetch(url, {
    headers: githubHeaders(),
    redirect: 'follow',
  })

  if (!response.ok) {
    fail(`Failed to download ${url}: HTTP ${response.status}`)
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(outputPath, bytes)
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: githubHeaders(),
  })

  if (!response.ok) {
    fail(`GitHub API request failed: ${url} HTTP ${response.status}`)
  }

  return response.json()
}

async function resolveTagSha(repoName, tagName) {
  const refName = tagName.replace(/^refs\/tags\//, '')
  const ref = await getJson(`https://api.github.com/repos/${repoName}/git/ref/tags/${encodeURIComponent(refName)}`)
  if (ref.object?.type === 'commit') {
    return normalizeSha(ref.object.sha)
  }

  if (ref.object?.type === 'tag' && ref.object.url) {
    const tagObject = await getJson(ref.object.url)
    return normalizeSha(tagObject.object?.sha || '')
  }

  return ''
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'NoMeter-release-verify-download',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  return headers
}

function readChecksums(filePath) {
  if (!existsSync(filePath)) {
    fail(`Missing checksums file: ${filePath}`)
  }

  const entries = new Map()
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i)
    if (!match) {
      fail(`Invalid checksum line: ${line}`)
    }

    entries.set(match[2], match[1].toLowerCase())
  }

  return entries
}

function readProvenance(filePath) {
  if (!existsSync(filePath)) {
    fail(`Missing provenance file: ${filePath}`)
  }

  const values = new Map()
  let lastKey = ''
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const separator = rawLine.indexOf(':')
    if (separator <= 0) {
      if (lastKey && !values.get(lastKey)) {
        values.set(lastKey, line)
      }
      continue
    }

    const key = rawLine.slice(0, separator).trim()
    const value = rawLine.slice(separator + 1).trim()
    values.set(key, value)
    lastKey = key
  }

  return values
}

function assertProvenance(provenance, { version: expectedVersion, targetSha: expectedSha, tag: expectedTag }) {
  const actualVersion = provenance.get('Version')
  const actualCommit = normalizeSha(provenance.get('GitCommit') || '')
  const actualStatus = provenance.get('GitStatus')

  if (actualVersion !== expectedVersion) {
    fail(`Provenance version mismatch: expected ${expectedVersion}, got ${actualVersion || '<missing>'}`)
  }

  if (actualCommit !== expectedSha) {
    fail(`Provenance commit mismatch: expected ${expectedSha}, got ${actualCommit || '<missing>'}`)
  }

  if (actualStatus !== 'clean') {
    fail(`Provenance GitStatus must be clean, got ${actualStatus || '<missing>'}`)
  }

  const provenanceTag = provenance.get('GitTag') || ''
  if (provenanceTag && provenanceTag !== 'none' && provenanceTag !== expectedTag) {
    fail(`Provenance GitTag mismatch: expected ${expectedTag} or none, got ${provenanceTag}`)
  }
}

function hashFile(filePath) {
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return hash.digest('hex')
}

function resolveExpectedCommit(value) {
  if (value === 'HEAD') {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      shell: false,
    })

    if (result.status !== 0) {
      fail('Unable to resolve HEAD for --expected-commit')
    }

    return normalizeSha(result.stdout.trim())
  }

  return normalizeSha(value)
}

function normalizeSha(value) {
  return String(value || '').trim().toLowerCase()
}

function isFullSha(value) {
  return /^[a-f0-9]{40}$/.test(value)
}

function readPackageJson() {
  try {
    return JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'))
  } catch (_error) {
    return {}
  }
}

function parseArgs(argv) {
  const options = {
    repo: '',
    tag: '',
    version: '',
    downloadDir: '',
    expectedCommit: '',
    clean: true,
    assets: [],
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      showHelp()
      process.exit(0)
    }

    if ([
      '--repo',
      '--tag',
      '--version',
      '--download-dir',
      '--expected-commit',
      '--assets',
    ].includes(arg)) {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        fail(`Missing value for ${arg}`)
      }

      switch (arg) {
        case '--repo':
          options.repo = value
          break
        case '--tag':
          options.tag = value
          break
        case '--version':
          options.version = value
          break
        case '--download-dir':
          options.downloadDir = value
          break
        case '--expected-commit':
          options.expectedCommit = value
          break
        case '--assets':
          options.assets = value.split(',').map((entry) => entry.trim()).filter(Boolean)
          break
      }
      i += 1
      continue
    }

    if (arg === '--no-clean') {
      options.clean = false
      continue
    }

    fail(`Unrecognized argument: ${arg}`)
  }

  return options
}

function showHelp() {
  console.log(`NoMeter release download verifier

Usage:
  npm run release:verify-download -- [options]

Options:
  --repo <owner/name>         GitHub repository (default: Martin123132/NoMeter)
  --tag <tag>                 Release tag (default: v<package version>)
  --version <version>         Expected NoMeter version (default: package.json version)
  --download-dir <path>       Download folder (default: outputs/release-download-verify)
  --expected-commit <sha|HEAD> Optional exact commit expected for the release target
  --assets <a,b,c>            Override expected release asset names
  --no-clean                  Do not clear the download folder before downloading
  --help, -h                  Show this help

Checks:
  - release tag target matches the GitHub tag ref
  - required assets exist and download successfully
  - checksums.sha256 matches downloaded artifacts
  - GitHub asset SHA-256 digests match when provided by GitHub
  - release-provenance.txt matches version, commit, and clean build state
`)
}

function fail(message) {
  console.error(`[release:verify-download] ${message}`)
  process.exit(1)
}
