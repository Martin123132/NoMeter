import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = process.cwd()

const packageJsonPath = resolve(repositoryRoot, 'package.json')
const readmePath = resolve(repositoryRoot, 'README.md')
const noticePath = resolve(repositoryRoot, 'NOTICE.md')
const commercialLicensePath = resolve(repositoryRoot, 'COMMERCIAL-LICENSE.md')
const licensePath = resolve(repositoryRoot, 'LICENSE')
const cargoTomlPath = resolve(repositoryRoot, 'src-tauri', 'Cargo.toml')
const tauriConfigPath = resolve(repositoryRoot, 'src-tauri', 'tauri.conf.json')

const packageJson = JSON.parse(loadText(packageJsonPath))
const readme = loadText(readmePath)
const notice = loadText(noticePath)
const commercialLicense = loadText(commercialLicensePath)
const license = loadText(licensePath)
const cargoToml = loadText(cargoTomlPath)
const tauriConfig = loadText(tauriConfigPath)

let failed = false

checkEqual('package.json license field', packageJson.license, 'SEE LICENSE IN LICENSE')

checkContains(readmePath, readme, [
  'source-available',
  'personal and non-commercial use',
  'PolyForm Noncommercial License 1.0.0',
  'Commercial use requires a separate written license',
  'COMMERCIAL-LICENSE.md',
])

checkContains(noticePath, notice, [
  'source-available software, not open-source software',
  'PolyForm Noncommercial License 1.0.0',
  'Commercial use requires a separate written license',
  'TWO HANDS NETWORK LTD',
])

checkContains(commercialLicensePath, commercialLicense, [
  'Commercial use is not included in the public license',
  'paid product',
  'hosted service',
  'commercial AI system',
  'No commercial license is granted unless agreed in writing',
])

checkContains(licensePath, license, [
  'Required Notice: NoMeter is source-available',
  'PolyForm Noncommercial License 1.0.0',
  'Commercial use',
  'requires a separate written license',
])

checkDoesNotContain(readmePath, readme, [
  'AGPL-3.0-only',
  'open-source, local-first',
])

checkContains(cargoTomlPath, cargoToml, [
  'Free for personal/non-commercial use',
  'license-file = "../LICENSE"',
])

checkDoesNotContain(cargoTomlPath, cargoToml, [
  'AGPL-3.0-only',
  'No credits, no limits',
])

checkContains(tauriConfigPath, tauriConfig, [
  'Free personal use',
  'personal and non-commercial use',
  'no uploads',
])

checkDoesNotContain(tauriConfigPath, tauriConfig, [
  'No credits, no limits',
])

if (failed) {
  process.exit(1)
}

console.log('license-positioning-check: licence and commercial-use positioning passed')

function checkEqual(label, actual, expected) {
  if (actual !== expected) {
    failed = true
    console.error(`[license-positioning-check] ${label} expected "${expected}", found "${actual}"`)
  }
}

function checkContains(filePath, content, requiredSnippets) {
  const missing = requiredSnippets.filter((snippet) => !content.includes(snippet))
  if (missing.length === 0) return

  failed = true
  console.error(`[license-positioning-check] ${filePath} is missing required positioning:`)
  for (const snippet of missing) {
    console.error(` - ${snippet}`)
  }
}

function checkDoesNotContain(filePath, content, blockedSnippets) {
  const present = blockedSnippets.filter((snippet) => content.includes(snippet))
  if (present.length === 0) return

  failed = true
  console.error(`[license-positioning-check] ${filePath} contains outdated positioning:`)
  for (const snippet of present) {
    console.error(` - ${snippet}`)
  }
}

function loadText(filePath) {
  try {
    return readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n')
  } catch (error) {
    failed = true
    console.error(`[license-positioning-check] failed to read ${filePath}: ${error?.message || error}`)
    return ''
  }
}
