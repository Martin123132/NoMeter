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
4. Generate checksums:
   - `npm run release:checksums -- --artifact-dir <path>`
   - review generated checksums file
5. Include a short human-readable note in the release body about the artifact set and OS/arch targets.

## Provenance capture

Collect these values in a `release-provenance.txt` (or release notes section) before publishing:

```powershell
git rev-parse HEAD
git rev-parse --short HEAD
git status --short
git tag --points-at HEAD
Get-Date -Format o
node -v
npm -v
cargo -V
rustc -V
```

Example provenance file format:

```text
NoMeter Release
Version: 0.5.0
Commit: <SHA>
Built at: <ISO-8601 timestamp>
Branch: <branch>
Node: v24.15.0
NPM: 11.12.1
Rustup/Cargo: cargo 1.96.0
rustc: rustc 1.96.0
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
