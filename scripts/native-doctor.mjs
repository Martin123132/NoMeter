import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { parse, resolve } from 'node:path'

const checks = [
  { name: 'Node.js', command: 'node', args: ['--version'], required: true },
  {
    name: 'npm',
    command: process.execPath,
    args: process.env.npm_execpath ? [process.env.npm_execpath, '--version'] : ['--version'],
    required: true,
  },
  { name: 'Rust cargo', command: 'cargo', args: ['--version'], required: true },
  { name: 'Rust compiler', command: 'rustc', args: ['--version'], required: true },
  { name: 'FFmpeg', command: 'ffmpeg', args: ['-version'], required: false },
  { name: 'Pandoc', command: 'pandoc', args: ['--version'], required: false },
  { name: 'qpdf', command: 'qpdf', args: ['--version'], required: false },
  { name: 'Ghostscript', command: 'gswin64c', args: ['--version'], required: false },
  { name: 'Tesseract', command: 'tesseract', args: ['--version'], required: false },
  { name: 'OCRmyPDF', command: 'ocrmypdf', args: ['--version'], required: false },
]

const projectRoot = resolve('.')
const drive = parse(projectRoot).root.toUpperCase()
let failedRequired = false

console.log('OpenForge native doctor')
console.log(`Project: ${projectRoot}`)
console.log(`Drive: ${drive}`)

if (drive.startsWith('C:')) {
  failedRequired = true
  console.log('FAIL project is on the system drive; move it to D: or another data drive.')
} else {
  console.log('PASS project is off the system drive.')
}

if (existsSync('src-tauri/tauri.conf.json')) {
  console.log('PASS Tauri config found.')
} else {
  failedRequired = true
  console.log('FAIL src-tauri/tauri.conf.json is missing.')
}

for (const check of checks) {
  const result = spawnSync(check.command, check.args, {
    encoding: 'utf8',
    shell: false,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n')[0]

  if (result.status === 0) {
    console.log(`PASS ${check.name}: ${output}`)
    continue
  }

  if (check.required) {
    failedRequired = true
    console.log(`FAIL ${check.name}: not found`)
  } else {
    console.log(`WARN ${check.name}: not found; install or bundle later`)
  }
}

if (failedRequired) {
  process.exitCode = 1
}
