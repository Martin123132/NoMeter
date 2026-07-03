import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { delimiter, dirname, isAbsolute, join, parse } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const noMeterRoot = envValue('NOMETER_ROOT', 'OPENFORGE_ROOT') || 'D:\\Codex\\OpenForge'
const toolchainRoot = envValue('NOMETER_TOOLCHAIN_ROOT', 'OPENFORGE_TOOLCHAIN_ROOT') || 'D:\\Codex\\Toolchains'
const tesseractRoot =
  envValue('NOMETER_TESSERACT_ROOT', 'OPENFORGE_TESSERACT_ROOT') || join(noMeterRoot, 'tools', 'tesseract')
const ocrmypdfRoot =
  envValue('NOMETER_OCRMYPDF_ROOT', 'OPENFORGE_OCRMYPDF_ROOT') || join(noMeterRoot, 'tools', 'ocrmypdf')
const ghostscriptRoot =
  envValue('NOMETER_GHOSTSCRIPT_ROOT', 'OPENFORGE_GHOSTSCRIPT_ROOT') || join(noMeterRoot, 'tools', 'ghostscript')
const qpdfRoot = envValue('NOMETER_QPDF_ROOT', 'OPENFORGE_QPDF_ROOT') || join(noMeterRoot, 'tools', 'qpdf')
const tempDir = envValue('NOMETER_TEMP', 'OPENFORGE_TEMP') || join(noMeterRoot, 'tmp')
const tesseractExe =
  envValue('NOMETER_TESSERACT_EXE', 'OPENFORGE_TESSERACT_EXE') || findFile(tesseractRoot, executableName('tesseract'))
const ocrmypdfExe =
  envValue('NOMETER_OCRMYPDF_EXE', 'OPENFORGE_OCRMYPDF_EXE') ||
  findFile(ocrmypdfRoot, executableName('ocrmypdf')) ||
  findFile(ocrmypdfRoot, 'ocrmypdf')
const ghostscriptExe =
  envValue('NOMETER_GHOSTSCRIPT_EXE', 'OPENFORGE_GHOSTSCRIPT_EXE') ||
  findFile(ghostscriptRoot, 'gswin64c.exe') ||
  findFile(ghostscriptRoot, 'gs.exe') ||
  findFile(ghostscriptRoot, 'gs')
const qpdfExe = findFile(qpdfRoot, executableName('qpdf'))
const pythonExe =
  envValue('NOMETER_PYTHON_EXE', 'OPENFORGE_PYTHON_EXE') ||
  findFile(ocrmypdfRoot, process.platform === 'win32' ? 'python.exe' : 'python') ||
  executableName('python')

const pathWithRoots = [
  tesseractExe ? dirname(tesseractExe) : '',
  ocrmypdfExe ? dirname(ocrmypdfExe) : '',
  ghostscriptExe ? dirname(ghostscriptExe) : '',
  qpdfExe ? dirname(qpdfExe) : '',
  process.env.PATH || '',
]
  .filter(Boolean)
  .join(delimiter)

const commonEnv = {
  ...process.env,
  TEMP: tempDir,
  TMP: tempDir,
  PATH: pathWithRoots,
}

let failed = false
let warnings = 0

console.log('NoMeter OCR preflight')
console.log(`Strict mode: ${args.strict ? 'on' : 'off'}`)
console.log(`NoMeter root: ${noMeterRoot}`)
console.log(`Toolchain root: ${toolchainRoot}`)
console.log(`Tesseract root: ${tesseractRoot}`)
console.log(`OCRmyPDF root: ${ocrmypdfRoot}`)

checkConfiguredPath('NoMeter root', noMeterRoot, true)
checkConfiguredPath('Toolchain root', toolchainRoot, true)
checkConfiguredPath('Tesseract root', tesseractRoot, false)
checkConfiguredPath('OCRmyPDF root', ocrmypdfRoot, false)

const tesseractOk = checkTool({
  name: 'Tesseract',
  command: tesseractExe || executableName('tesseract'),
  args: ['--version'],
  requiredInStrict: true,
  help: 'Install Tesseract under the configured non-system tool folder, or set NOMETER_TESSERACT_EXE.',
})

checkTessdata(tesseractOk)

checkTool({
  name: 'Python',
  command: pythonExe,
  args: ['--version'],
  requiredInStrict: true,
  help: 'OCRmyPDF needs a 64-bit Python runtime. Prefer a root-local virtualenv under NOMETER_OCRMYPDF_ROOT.',
})

checkTool({
  name: 'Ghostscript',
  command: ghostscriptExe || executableName(process.platform === 'win32' ? 'gswin64c' : 'gs'),
  args: ['--version'],
  requiredInStrict: true,
  help: 'OCRmyPDF needs Ghostscript. NoMeter already supports NOMETER_GHOSTSCRIPT_ROOT/NOMETER_GHOSTSCRIPT_EXE.',
})

checkTool({
  name: 'qpdf',
  command: qpdfExe || executableName('qpdf'),
  args: ['--version'],
  requiredInStrict: true,
  help: 'OCRmyPDF needs qpdf. NoMeter can use the existing qpdf sidecar/root.',
})

checkTool({
  name: 'OCRmyPDF',
  command: ocrmypdfExe || executableName('ocrmypdf'),
  args: ['--version'],
  requiredInStrict: true,
  help: 'Create a local OCRmyPDF virtualenv under NOMETER_OCRMYPDF_ROOT before wiring scanned-PDF OCR.',
})

if (failed) {
  process.exit(1)
}

if (warnings > 0) {
  console.log(`ocr-preflight: planning check completed with ${warnings} warning${warnings === 1 ? '' : 's'}`)
} else {
  console.log('ocr-preflight: OCR toolchain baseline passed')
}

function checkConfiguredPath(label, value, shouldExist) {
  if (!value || !isAbsolute(value)) {
    report(`${label}: use an absolute non-system path`, true)
    return false
  }

  if (isSystemDrivePath(value)) {
    report(`${label}: path is on the system drive; choose a data/tool drive`, true)
    return false
  }

  if (shouldExist && !existsSync(value)) {
    report(`${label}: path does not exist yet: ${value}`, true)
    return false
  }

  console.log(`PASS ${label}: non-system absolute path`)
  return true
}

function checkTool({ name, command, args: toolArgs, requiredInStrict, help }) {
  const result = spawnSync(command, toolArgs, {
    encoding: 'utf8',
    env: commonEnv,
    shell: false,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n')[0]

  if (result.status === 0) {
    console.log(`PASS ${name}: ${output}`)
    return true
  }

  report(`${name}: not found. ${help}`, requiredInStrict)
  return false
}

function checkTessdata(tesseractOk) {
  const candidates = [
    process.env.TESSDATA_PREFIX || '',
    join(tesseractRoot, 'tessdata'),
    tesseractExe ? join(dirname(tesseractExe), 'tessdata') : '',
  ].filter(Boolean)

  const tessdataDir = candidates.find((candidate) => existsSync(join(candidate, 'eng.traineddata')))

  if (tessdataDir) {
    checkConfiguredPath('Tesseract tessdata', tessdataDir, true)
    console.log('PASS Tesseract language data: eng.traineddata')
    return true
  }

  const message = tesseractOk
    ? 'Tesseract language data: eng.traineddata not found in configured tessdata folders.'
    : 'Tesseract language data: waiting for Tesseract install.'
  report(message, true)
  return false
}

function report(message, requiredInStrict) {
  if (args.strict && requiredInStrict) {
    failed = true
    console.log(`FAIL ${message}`)
    return
  }

  warnings += 1
  console.log(`WARN ${message}`)
}

function isSystemDrivePath(value) {
  const root = parse(value).root.toUpperCase()
  return root === 'C:\\' || root === 'C:/'
}

function executableName(name) {
  if (process.platform !== 'win32') return name
  return name.endsWith('.exe') ? name : `${name}.exe`
}

function envValue(primaryName, legacyName) {
  return process.env[primaryName] || process.env[legacyName] || ''
}

function findFile(root, fileName) {
  if (!root || !existsSync(root)) return null

  for (const entry of readdirSync(root)) {
    const fullPath = join(root, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      const match = findFile(fullPath, fileName)
      if (match) return match
      continue
    }

    if (entry.toLowerCase() === fileName.toLowerCase()) {
      return fullPath
    }
  }

  return null
}

function parseArgs(argv) {
  const options = {
    strict: false,
  }

  for (const arg of argv) {
    if (arg === '--strict') {
      options.strict = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      showHelp()
      process.exit(0)
    }

    console.warn(`Unrecognized argument: ${arg}`)
  }

  return options
}

function showHelp() {
  console.log(`NoMeter OCR preflight

Usage:
  node scripts/ocr-preflight.mjs [--strict]

Checks the planned local OCR stack without installing or publishing anything.
Default mode is advisory and passes with warnings. Use --strict after installing
Tesseract/OCRmyPDF to fail missing tools or language data.

Environment:
  NOMETER_ROOT
  NOMETER_TOOLCHAIN_ROOT
  NOMETER_TESSERACT_ROOT
  NOMETER_TESSERACT_EXE
  NOMETER_OCRMYPDF_ROOT
  NOMETER_OCRMYPDF_EXE
  NOMETER_GHOSTSCRIPT_ROOT
  NOMETER_GHOSTSCRIPT_EXE
  NOMETER_QPDF_ROOT
  NOMETER_PYTHON_EXE
  NOMETER_TEMP

Legacy OPENFORGE_* aliases are accepted for existing local setups.`)
}
