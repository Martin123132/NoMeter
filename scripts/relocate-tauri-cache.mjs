import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const noMeterRoot = resolve(envValue('NOMETER_ROOT', 'OPENFORGE_ROOT') || 'D:\\Codex\\OpenForge')
const destinationRoot = resolve(envValue('NOMETER_LOCALAPPDATA', 'OPENFORGE_LOCALAPPDATA') || join(noMeterRoot, 'tools', 'local-appdata'))
const destination = join(destinationRoot, 'tauri')
const localAppData = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || homedir(), 'AppData', 'Local')
const userLocalAppData = join(process.env.USERPROFILE || homedir(), 'AppData', 'Local')
const candidates = [...new Set([join(localAppData, 'tauri'), join(localAppData, 'Tauri'), join(userLocalAppData, 'tauri'), join(userLocalAppData, 'Tauri')])]

if (!destinationRoot.toLowerCase().startsWith(noMeterRoot.toLowerCase())) {
  console.error(`Refusing to move Tauri cache outside the NoMeter workspace root: ${destinationRoot}`)
  process.exit(1)
}

mkdirSync(destinationRoot, { recursive: true })

let moved = false
for (const source of candidates) {
  const resolvedSource = resolve(source)

  if (!existsSync(resolvedSource) || resolvedSource.toLowerCase() === destination.toLowerCase()) {
    continue
  }

  if (existsSync(destination)) {
    rmSync(destination, { recursive: true, force: true })
  }

  mkdirSync(dirname(destination), { recursive: true })
  cpSync(resolvedSource, destination, { recursive: true })
  rmSync(resolvedSource, { recursive: true, force: true })
  console.log(`moved Tauri cache ${resolvedSource} -> ${destination}`)
  moved = true
}

if (!moved) {
  console.log('no Tauri AppData cache found on C: to relocate')
}

function envValue(primaryName, legacyName) {
  return process.env[primaryName] || process.env[legacyName] || ''
}
