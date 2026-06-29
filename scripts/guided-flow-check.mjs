import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repositoryRoot = process.cwd()
const appPath = resolve(repositoryRoot, 'src', 'App.tsx')
const cssPath = resolve(repositoryRoot, 'src', 'App.css')
const packagePath = resolve(repositoryRoot, 'package.json')
const workflowPath = resolve(repositoryRoot, '.github', 'workflows', 'ci.yml')

const appText = loadText(appPath)
const cssText = loadText(cssPath)
const packageText = loadText(packagePath)
const workflowText = loadText(workflowPath)

let failed = false

checkText(appText, appPath, 'guided mode state and persistence', [
  "type GuidanceMode = 'guided' | 'explorer'",
  "const guidanceModeStorageKey = 'nometer.guidanceMode.v1'",
  'setGuidanceModePreserve',
  "aria-label=\"NoMeter guidance mode\"",
  'Guided',
  'Explorer',
])

checkText(appText, appPath, 'four-step mission route', [
  "source: 'Load source files'",
  "options: 'Choose recipe + options'",
  "run: 'Run conversion'",
  "export: 'Collect exports'",
  'const missionProgressPercent = Math.round((missionProgress / 4) * 100)',
  'const missionRouteSummary = `${missionCurrentStep.label} ${missionLane.activeIndex + 1}/4`',
  'missionLane.steps.map',
  'mission-route-radar',
  'mission-lane',
])

checkText(appText, appPath, 'mission director lane', [
  'mission-lane-director',
  'Director - {missionRouteSummary}',
  'mission-lane-primary',
  'Follow route: ${missionLane.nextTitle}',
  'missionLane.nextActionLabel',
])

checkText(appText, appPath, 'sidebar route resume card', [
  'sidebar-route-card',
  'NoMeter current route',
  'sidebar-route-status',
  'missionCurrentStepStatusLabel',
  'sidebar-route-progress',
  'Resume route: ${missionLane.nextTitle}',
  'missionLane.nextAction',
])

checkText(appText, appPath, 'sample demo mission tracker', [
  'demoMissionActive',
  'setDemoMissionActive',
  'Demo mission loaded',
  'NoMeter demo mission',
  'demo-mission-card',
  'Sample route live',
  'Sample route complete',
  'demoMissionSteps.map',
  'Start another mission',
])

checkText(appText, appPath, 'first-run user path', [
  'Welcome to NoMeter',
  'Nothing uploads and desktop saves use your configured folders.',
  'Guided route',
  'Simple workbench',
  'Try sample files',
  'Open the Exports panel, download browser outputs, and check the saved path for desktop-native jobs.',
])

checkText(appText, appPath, 'run-or-review behavior', [
  'const missionCanReviewExport = missionHasExports && latestExport !== undefined',
  'const runOrFollowAction = canRunMission',
  'shouldFollowSuggestedTool && suggestedTool',
  '? openLatestExport',
  "'Open latest export'",
  '<Play size={17} fill="currentColor" />',
  '{runButtonLabel}',
])

checkText(appText, appPath, 'mixed queue recipe switching', [
  'function inferMissionTool(jobs: QueueJob[]): ToolId | null',
  "if (onlyKind === null) return 'archive-zip'",
  "if (onlyKind === 'image') return 'image-convert'",
  "if (onlyKind === 'media') return 'native-engine'",
  "if (onlyKind === 'document') return 'document-convert'",
  "if (onlyKind === 'pdf') return 'pdf-merge'",
  "if (onlyKind === 'archive' || onlyKind === 'unknown') return 'archive-zip'",
  'Try ${suggestedToolLabel} to match this file mix.',
  'Switch to ${suggestedToolLabel}',
])

checkText(appText, appPath, 'archive zip recipe', [
  "'archive-zip'",
  "label: 'Make ZIP'",
  'Bundle mixed files into one browser-local ZIP without uploading.',
  'archiveOutputName(files, preserveNames)',
  'runArchiveZip',
  'zipFiles(files, preserveNames)',
  "if (tool === 'archive-zip') return true",
  "activeTool === 'archive-zip'",
])

checkText(appText, appPath, 'native folder guardrails', [
  "workDir: 'D:\\\\Codex\\\\OpenForge\\\\work'",
  "outputDir: 'D:\\\\Codex\\\\OpenForge\\\\outputs\\\\converted'",
  'const nativeFolderStorageKey = \'nometer.nativeFolders.v1\'',
  'function validateNativeFolders(folders: NativeFolders)',
  'isCDrivePath(workDir) || isCDrivePath(outputDir)',
  'this NoMeter workspace stays off C:.',
  'Desktop saves native outputs to this Save folder.',
  'pickNativeFolder',
  'chooseNativeFolder',
  'path-picker-button',
])

checkText(appText, appPath, 'native optional engine status badges', [
  'engine-row-${engine.status}',
  'engine-status-badge',
  "engine.status === 'wired' ? 'Wired' : engine.status === 'optional' ? 'Optional' : 'Planned'",
])

checkText(appText, appPath, 'Ghostscript PDF compression route', [
  "'pdf-compress'",
  "label: 'Compress PDFs'",
  'Ghostscript optional',
  'compressPdfFile(job.file, nativeFolders)',
  'Ghostscript compression',
  'Install Ghostscript or set NOMETER_GHOSTSCRIPT_ROOT',
])

checkText(cssText, cssPath, 'responsive guided flow layout', [
  '.mission-route-radar',
  '.route-status',
  '.mission-lane',
  '.mission-lane-director',
  '.mission-lane-primary',
  '.sidebar-route-card',
  '.sidebar-route-action',
  '.demo-mission-card',
  '.demo-mission-steps',
  '.mission-rail',
  '.topbar-actions',
  '@media (max-width: 760px)',
  '.path-strip,',
  '.mission-location-strip,',
  '.mission-beacon {',
  'display: none;',
])

checkText(cssText, cssPath, 'mobile mixed queue cards', [
  '.queue-table-wrap',
  'overflow-x: visible;',
  '.queue-table thead',
  'display: none;',
  ".queue-table td:nth-child(2)::before",
  "content: 'Kind';",
  ".queue-table td:nth-child(3)::before",
  "content: 'Size';",
  '.output-cell',
  'white-space: normal;',
])

checkText(packageText, packagePath, 'package script wiring', [
  '"qa:guided-flow-check": "node scripts/guided-flow-check.mjs"',
])

checkText(workflowText, workflowPath, 'CI wiring', [
  'Run guided flow regression guard',
  'npm run qa:guided-flow-check',
])

if (failed) {
  process.exit(1)
}

console.log('guided-flow-check: guided conversion flow checks passed')

function checkText(content, filePath, label, patterns) {
  const missing = []

  for (const pattern of patterns) {
    if (!content.includes(pattern)) {
      missing.push(pattern)
    }
  }

  if (missing.length > 0) {
    failed = true
    console.error(`[guided-flow-check] ${label} incomplete in ${filePath}:`)
    for (const pattern of missing) {
      console.error(` - missing: ${pattern}`)
    }
  }
}

function loadText(filePath) {
  try {
    return readFileSync(filePath, 'utf8')
  } catch (error) {
    failed = true
    console.error(`[guided-flow-check] failed to read ${filePath}: ${error?.message || error}`)
    return ''
  }
}
