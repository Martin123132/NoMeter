import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workflowPath = resolve(process.cwd(), '.github', 'workflows', 'ci.yml')
const workflowText = loadText()

const jobRequirements = [
  {
    id: 'web-qa',
    displayName: 'Web QA',
    steps: [
      { name: 'Checkout', action: 'actions/checkout@v7' },
      {
        name: 'Setup Node.js',
        action: 'actions/setup-node@v6',
        nodeVersion: '22',
      },
    ],
  },
  {
    id: 'release-smoke',
    displayName: 'Release metadata smoke',
    steps: [
      { name: 'Checkout', action: 'actions/checkout@v7' },
      {
        name: 'Setup Node.js',
        action: 'actions/setup-node@v6',
        nodeVersion: '22',
      },
    ],
  },
  {
    id: 'release-review-guard',
    displayName: 'Release review guard',
    steps: [
      { name: 'Checkout', action: 'actions/checkout@v7' },
      {
        name: 'Setup Node.js',
        action: 'actions/setup-node@v6',
        nodeVersion: '22',
      },
    ],
  },
  {
    id: 'public-safety-check',
    displayName: 'Public safety check',
    steps: [
      { name: 'Checkout', action: 'actions/checkout@v7' },
      {
        name: 'Setup Node.js',
        action: 'actions/setup-node@v6',
        nodeVersion: '22',
      },
    ],
  },
  {
    id: 'native-doctor',
    displayName: 'Native doctor',
    steps: [
      { name: 'Checkout', action: 'actions/checkout@v7' },
      {
        name: 'Setup Node.js',
        action: 'actions/setup-node@v6',
        nodeVersion: '22',
      },
    ],
  },
]

let failed = false

for (const job of jobRequirements) {
  if (!workflowText.includes(`  ${job.id}:`)) {
    reportMissingJob(job.id)
    failed = true
    continue
  }

  const jobBlock = extractJobBlock(workflowText, job.id)
  if (!jobBlock.includes(`name: ${job.displayName}`)) {
    reportIssue(`expected job name "${job.displayName}" for ${job.id} in workflow`, `workflow.yml`)
    failed = true
  }

  for (const stepRequirement of job.steps) {
    const stepMetadata = extractStepUses(jobBlock, stepRequirement.name)
    if (!stepMetadata) {
      reportMissingStep(job.id, stepRequirement.name)
      failed = true
      continue
    }

    if (!stepMetadata.uses.includes(stepRequirement.action)) {
      reportIssue(
        `expected ${job.id} step "${stepRequirement.name}" to use ${stepRequirement.action}`,
        `${job.id} step "${stepRequirement.name}" uses ${stepMetadata.uses}`
      )
      failed = true
    }

    if (stepRequirement.nodeVersion && stepMetadata.nodeVersion !== stepRequirement.nodeVersion) {
      reportIssue(
        `expected ${job.id} step "${stepRequirement.name}" node-version to be ${stepRequirement.nodeVersion}`,
        `${job.id} step "${stepRequirement.name}" node-version is ${stepMetadata.nodeVersion || 'missing'}`
      )
      failed = true
    }
  }
}

const requiredRunSteps = [
  {
    label: 'guided flow regression guard',
    snippets: ['Run guided flow regression guard', 'run: npm run qa:guided-flow-check'],
  },
]

for (const requirement of requiredRunSteps) {
  const missing = requirement.snippets.filter((snippet) => !workflowText.includes(snippet))
  if (missing.length > 0) {
    reportIssue(
      `${requirement.label} missing from workflow`,
      `missing ${missing.join(', ')}`
    )
    failed = true
  }
}

if (workflowText.includes('actions/checkout@v4') || workflowText.includes('actions/setup-node@v4')) {
  reportIssue(
    'legacy action pin still present',
    'workflow still contains actions/*@v4 references'
  )
  failed = true
}

if (failed) {
  process.exit(1)
}

console.log('ci-maintenance-check: critical CI jobs and runtime expectations passed')

function extractJobBlock(text, jobId) {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line.trimStart() === `${jobId}:` && line.startsWith('  '))
  if (start === -1) {
    return ''
  }

  const body = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^ {2}\S/.test(line) && !line.startsWith('  steps:') && line.match(/^ {2}[a-zA-Z0-9_-]+:/)) {
      break
    }
    body.push(line)
  }
  return body.join('\n')
}

function extractStepUses(blockText, stepName) {
  const lines = blockText.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const match = line.match(/^\s*- name:\s*(.*?)\s*$/)
    if (!match) {
      continue
    }
    if (match[1].trim() !== stepName) {
      continue
    }

    const metadata = {
      uses: '',
      nodeVersion: '',
    }
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j]
      if (next.match(/^\s{6}- name:/)) {
        break
      }

      const usesMatch = next.match(/^\s+uses:\s*(.*)$/)
      if (usesMatch) {
        metadata.uses = usesMatch[1].trim()
      }

      const nodeVersionMatch = next.match(/^\s+node-version:\s*(.*)$/)
      if (nodeVersionMatch) {
        metadata.nodeVersion = nodeVersionMatch[1].replaceAll('"', '').trim()
      }
    }
    if (metadata.uses) {
      return metadata
    }
  }
  return ''
}

function reportMissingJob(jobId) {
  console.error(`[ci-maintenance-check] required job missing: ${jobId}`)
}

function reportMissingStep(jobId, stepName) {
  console.error(`[ci-maintenance-check] missing step "${stepName}" in job ${jobId}`)
}

function reportIssue(message, details) {
  console.error(`[ci-maintenance-check] ${message}: ${details}`)
}

function loadText() {
  try {
    return readFileSync(workflowPath, 'utf8').replace(/\r\n?/g, '\n')
  } catch (_error) {
    console.error(`[ci-maintenance-check] missing workflow file: ${workflowPath}`)
    process.exit(1)
  }
}
