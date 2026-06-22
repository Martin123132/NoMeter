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
