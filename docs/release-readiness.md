# Release Readiness Checklist

This document describes how to prepare and publish a release-ready artifact set for NoMeter without exposing private workspace data.

## Current public artifacts

The workspace currently produces these installers/bundles:

- `NoMeter_*.exe` (NSIS installer)
- `NoMeter_*.msi` (MSI installer)
- `nometer-static.zip` (browser/static delivery bundle)

These are expected in an output directory you control during release prep, typically:

- `D:\...` paths are examples only. In normal practice use `--artifact-dir`.

## Packaging checks

1. Validate code health:
   - `npm run lint`
   - `npm run build`
   - `npm run native:doctor`
2. Build release artifacts:
   - `npm run desktop:build`
   - verify outputs exist in the selected artifact folder.
3. Confirm provenance values are documented for the build:
   - commit SHA (`git rev-parse HEAD`)
   - build timestamp
   - toolchain/runtime versions (`npm --version`, `node --version`, `cargo --version`, `rustc --version` where available)
   - optional summary of local workspace state (`git status --short`)
   - then generate a checked file: `npm run release:provenance -- --artifact-dir <path>`
4. Generate checksums:
   - `npm run release:checksums -- --artifact-dir <path>`
   - review generated checksums file
5. Include a short human-readable note in the release body about the artifact set and OS/arch targets.

## One-command local release prep

Run the full local preparation path in one command:

```powershell
npm run release:prepare -- --artifact-dir D:\path\to\artifacts
```

This runs (in order):

- `npm run lint`
- `npm run build`
- `npm run native:doctor`
- `npm run release:provenance -- --artifact-dir <path>`
- `npm run release:checksums -- --artifact-dir <path>`

To run in constrained environments (e.g., if you are only validating metadata), use:

```powershell
npm run release:prepare -- --artifact-dir D:\path\to\artifacts --skip-build --skip-doctor --non-strict
```

## One-command release draft generation

After a successful `release:prepare`, generate a sanitized draft release body:

```powershell
npm run release:notes -- --artifact-dir D:\path\to\artifacts
```

Optional helpers:

- Print to console for quick inspection:

```powershell
npm run release:notes -- --artifact-dir D:\path\to\artifacts --stdout
```

- Use a custom output file:

```powershell
npm run release:notes -- --artifact-dir D:\path\to\artifacts --output-file D:\path\to\artifacts\release-draft.md
```

`release:notes` reads the local provenance/checksum files and emits a draft with:

- version and commit metadata
- generated artifact list and SHA-256 table
- verification commands
- a release-readiness checklist

## CI-safe deterministic metadata smoke test

Use this local CI-style smoke check to verify the full metadata pipeline stays functional without building installers:

```powershell
npm run release:smoke
```

It writes a tiny local fixture set in `tmp/release-smoke-artifacts`, runs:

- `release:prepare` with fast paths (`--skip-lint --skip-build --skip-doctor`)
- `release:notes` against that fixture

The command fails if it cannot produce:

- `tmp/release-smoke-artifacts/release-provenance.txt`
- `tmp/release-smoke-artifacts/checksums.sha256`
- `tmp/release-smoke-artifacts/release-notes.md`

## Release dry-run evidence index

Before final review, capture all required validation evidence in one file:

```powershell
npm run release:evidence
```

To capture a full local evidence run with logs automatically:

```powershell
npm run release:evidence:run
```

This command runs:

- `npm run lint`
- `npm run build`
- `npm run native:doctor`
- `npm run release:smoke`
- `npm run release:review-check`
- `npm run ci:maintenance-check`
- `npm run release:first-release-check`

then writes the same evidence scaffold.

Defaults used by `release:evidence`:

- Artifact directory: `outputs/release`
- Output file: `docs/release-dry-run-evidence.md`
- Evidence log paths are recorded as local-only labels, such as `<local-only evidence log: lint.log>`.

All paths are overrideable via the underlying `release-evidence-index` options (for example `--artifact-dir`, `--output-file`, and `--lint-evidence`).

This writes an evidence sheet with:

- command outputs for:
  - `npm run lint`
  - `npm run build`
  - `npm run native:doctor`
  - `npm run release:smoke`
  - `npm run release:review-check`
  - `npm run ci:maintenance-check`
  - `npm run release:first-release-check`
- public-safety check output for `npm run release:public-safety-check`
- CI run URLs for `Web QA`, `Release metadata smoke`, `Release review guard`, `Public safety check`, `Native doctor`, `CI maintenance check`, `First release readiness check`
- expected artifact presence (`NoMeter_<version>_x64-setup.exe`, `NoMeter_<version>_x64_en-US.msi`, `nometer-static.zip`, `release-provenance.txt`, `checksums.sha256`, `release-notes.md`)
- public-safe review gates and sign-off fields

## Public safety guard

Before sharing release-facing material, run:

```powershell
npm run release:public-safety-check
```

For an explicit artifact folder:

```powershell
npm run release:public-safety-check -- --artifact-dir D:\path\to\artifacts
```

This scans release notes, evidence docs, provenance/checksum outputs, review templates, checklist docs, and proof HTML for private paths, raw local log references, local URLs, credentials, secret-looking strings, and private key material.

## Evidence log hygiene

Keep evidence logs local and disposable before sharing:

- The evidence-run log folder is intentionally local temp output only.
- It is gitignored and should not be attached to issues or PRs.
- Run a cleanup after sharing:

```powershell
npm run release:evidence:cleanup
```

- For any public share, keep `docs/release-dry-run-evidence.md` only and scrub local filesystem paths from pasted snippets if present.

## First public release review checklist

Before publishing a first public release, create a review issue from the GitHub template:

`.github/ISSUE_TEMPLATE/nometer-release-review.md`

That template requires verification with:

- `release:prepare`
- `release:notes`
- `release:smoke`
- `npm run lint`
- `npm run build`
- `npm run native:doctor`

and confirms public-safe artifact/provenance/checksum handling.

Validate that the template and review references remain aligned with the release readiness contract:

```powershell
npm run release:review-check
```

This deterministic guard ensures the review path keeps requiring:

- `release:prepare`, `release:notes`, `release:smoke`
- `native:doctor`
- checksum/provenance output capture
- public-safe artifact rules

## Provenance capture

Collect these values with a small reproducible file:

```powershell
git rev-parse HEAD
git rev-parse --short HEAD
git branch --show-current
git tag --points-at HEAD
Get-Date -Format o
node -v
npm -v
cargo -V
rustc -V
npm run release:provenance -- --artifact-dir D:\path\to\artifacts
```

The output file defaults to `<artifact-dir>/release-provenance.txt` and can be attached to release notes.

Example provenance file format:

```text
NoMeter Release Provenance
Project: nometer
Version: 0.5.0
GeneratedAt: 2026-06-22T00:00:00.000Z
Node: v24.15.0
NPM: 11.12.1
Cargo: cargo 1.96.0
Rustc: rustc 1.96.0
GitCommit: d052b3d...
GitCommitShort: d052b3d
GitBranch: main
GitTag: v0.5.0
ArtifactsDir: ./outputs
GitStatus:
 M scripts/new-file
```

## Checksum generation

Use the script to collect SHA-256 checksums for known NoMeter outputs:

```powershell
# default outputs folder under project root
npm run release:checksums

# explicit output folder and stricter validation
$env:NOMETER_ARTIFACT_DIR="D:\path\to\artifacts"
$env:NOMETER_CHECKSUM_STRICT="1"
npm run release:checksums

# custom filenames (comma-separated)
$env:NOMETER_ARTIFACTS="NoMeter_0.5.0_x64-setup.exe,NoMeter_0.5.0_x64_en-US.msi,nometer-static.zip"
npm run release:checksums
```

By default the command:

- searches `outputs` under the repo root,
- matches installer and static artifact patterns,
- writes `checksums.sha256` in the artifact folder,
- exits successfully even when no artifacts are found unless `NOMETER_CHECKSUM_STRICT=1`.

## How users can verify artifacts

Add generated checksums to your release notes and instruct users to compare hashes:

- Windows: `certutil -hashfile <artifact> SHA256`
- Windows PowerShell: `Get-FileHash <artifact> -Algorithm SHA256`
- Linux/macOS: `sha256sum <artifact>`

Example:

```powershell
certutil -hashfile NoMeter_0.5.0_x64-setup.exe SHA256
Get-FileHash NoMeter_0.5.0_x64-setup.exe -Algorithm SHA256
```

## Pre-release approval checklist

- [ ] Build passes lint + web build + native doctor.
- [ ] Release artifacts are built and placed in a dedicated artifact folder.
- [ ] Checksums file generated and validated against downloaded artifacts.
- [ ] Release notes include: version, changes since prior release, checksum file hash, and build date.
- [ ] No secrets, machine-local paths, or private paths are embedded in published materials.

## CI maintenance guard

Keep CI runtime posture auditable for release-critical checks:

- Required workflow jobs: `web-qa`, `release-smoke`, `release-review-guard`, `public-safety-check`, `native-doctor`.
- Required job display names:
  - `Web QA`
  - `Release metadata smoke`
  - `Release review guard`
  - `Public safety check`
  - `Native doctor`
- Required action pins in `/.github/workflows/ci.yml`:
  - `actions/checkout@v7`
  - `actions/setup-node@v6`
  - `node-version: "22"`

Run the lightweight drift check locally before merging workflow edits:

```powershell
npm run ci:maintenance-check
```

This guard fails if:

- a required job is missing or renamed,
- the critical jobs change action pins/runtime inputs,
- or legacy `@v4` `actions/checkout` / `actions/setup-node` pins are reintroduced.

## First release checklist

- [First release checklist](first-release-checklist.md) contains:
  - expected public artifacts (`NoMeter_*.exe`, `NoMeter_*.msi`, `nometer-static.zip`),
  - required metadata outputs (`release-provenance.txt`, `checksums.sha256`, `release-notes.md`),
  - required pre-publish commands (`release:prepare`, `release:notes`, `release:smoke`, `release:review-check`, `release:public-safety-check`, `ci:maintenance-check`, `lint`, `build`, `native:doctor`),
  - and public-safe evidence gates.

Run it directly:

```powershell
npm run release:first-release-check
```

This script keeps the checklist, issue template, and readiness docs aligned before the first release boundary.
