import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const evidenceLogDir = resolve(process.cwd(), 'tmp', 'release-evidence-check-logs')

if (existsSync(evidenceLogDir)) {
  rmSync(evidenceLogDir, { recursive: true, force: true })
  console.log(`[release:evidence:cleanup] removed ${evidenceLogDir}`)
} else {
  console.log(`[release:evidence:cleanup] no evidence log folder found at ${evidenceLogDir}`)
}
