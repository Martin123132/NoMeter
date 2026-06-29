import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repositoryRoot = process.cwd()
const issueTemplate = resolve(
  repositoryRoot,
  '.github',
  'ISSUE_TEMPLATE',
  'nometer-release-review.md'
)
const readinessDoc = resolve(repositoryRoot, 'docs', 'release-readiness.md')

const requirements = [
  {
    id: 'template-path',
    file: issueTemplate,
    title: 'Release review issue template exists',
    checks: [
      {
        label: 'Template includes required release:smoke command',
        pattern: '`npm run release:smoke`',
      },
      {
        label: 'Template includes required release:prepare command',
        pattern: '`npm run release:prepare -- --artifact-dir',
      },
      {
        label: 'Template includes portable artifact command',
        pattern: '`npm run release:portable -- --artifact-dir',
      },
      {
        label: 'Template includes required release:notes command',
        pattern: '`npm run release:notes -- --artifact-dir',
      },
      {
        label: 'Template includes post-publish download verification',
        pattern: '`npm run release:verify-download`',
      },
      {
        label: 'Template includes native doctor verification',
        pattern: '`npm run native:doctor`',
      },
      {
        label: 'Template includes public safety verification',
        pattern: '`npm run release:public-safety-check`',
      },
      {
        label: 'Template requires provenance artifact file',
        pattern: 'release-provenance.txt',
      },
      {
        label: 'Template requires checksums artifact file',
        pattern: 'checksums.sha256',
      },
      {
        label: 'Template requires release notes artifact file',
        pattern: 'release-notes.md',
      },
      {
        label: 'Template includes public artifact rule',
        pattern: 'NoMeter_*-portable.exe',
      },
      {
        label: 'Template includes public artifact rule',
        pattern: 'NoMeter_*.exe',
      },
      {
        label: 'Template includes public artifact rule',
        pattern: 'NoMeter_*.msi',
      },
      {
        label: 'Template includes public artifact rule',
        pattern: 'nometer-static.zip',
      },
      {
        label: 'Template includes public-safe path reminder',
        pattern: 'sanitized',
      },
    ],
  },
  {
    id: 'readiness-doc',
    file: readinessDoc,
    title: 'Release readiness document covers review checks',
    checks: [
      {
        label: 'Readiness doc references release:prepare',
        pattern: 'release:prepare',
      },
      {
        label: 'Readiness doc references portable artifact builder',
        pattern: 'release:portable',
      },
      {
        label: 'Readiness doc references release:notes',
        pattern: 'release:notes',
      },
      {
        label: 'Readiness doc references release:smoke',
        pattern: 'release:smoke',
      },
      {
        label: 'Readiness doc references public safety guard',
        pattern: 'release:public-safety-check',
      },
      {
        label: 'Readiness doc references native doctor verification',
        pattern: 'native:doctor',
      },
      {
        label: 'Readiness doc references checksum generation',
        pattern: 'Checksums',
      },
      {
        label: 'Readiness doc references provenance',
        pattern: 'provenance',
      },
      {
        label: 'Readiness doc references the review issue template',
        pattern: 'nometer-release-review.md',
      },
      {
        label: 'Readiness doc includes sanitizer/privately-safe reminder',
        pattern: 'public-safe',
      },
      {
        label: 'Readiness doc includes public artifact list',
        pattern: 'NoMeter_*.msi',
      },
      {
        label: 'Readiness doc includes public artifact list',
        pattern: 'nometer-static.zip',
      },
    ],
  },
]

let hasFailure = false

for (const requirementGroup of requirements) {
  const content = loadText(requirementGroup.file)
  const missing = []

  for (const check of requirementGroup.checks) {
    if (!content.includes(check.pattern)) {
      missing.push(check.label)
    }
  }

  if (missing.length > 0) {
    hasFailure = true
    console.error(`\n[release-review-check] ${requirementGroup.title} incomplete:`)
    for (const entry of missing) {
      console.error(` - ${entry}`)
    }
  }
}

if (hasFailure) {
  process.exit(1)
}

console.log('release-review-check: docs and issue template checks passed')

function loadText(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch (_error) {
    console.error(`[release-review-check] missing required file: ${path}`)
    process.exit(1)
  }
}
