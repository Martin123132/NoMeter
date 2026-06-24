---
name: NoMeter release review
about: Checklist to review the first public release candidate before publishing.
title: "release-review: v0.x.x"
labels: [release]
---

# NoMeter release review

Use this checklist for the first public release review. Keep all linked artifacts local-only and sanitized before attaching or sharing.

## Release metadata

- [ ] Release version:
- [ ] Target commit SHA:
- [ ] Artifact directory used (example: `<artifact-dir>`):
- [ ] Evidence index file generated: `docs/release-dry-run-evidence.md` (or equivalent)

## Required verification commands (run locally)

- [ ] `npm run release:smoke`
- [ ] `npm run release:prepare -- --artifact-dir <artifact-dir>`
- [ ] `npm run release:notes -- --artifact-dir <artifact-dir>`
- [ ] `npm run license:positioning-check`
- [ ] `npm run qa:guided-flow-check`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run native:doctor`
- [ ] `npm run release:evidence`
- [ ] `npm run release:evidence:run` (optional: full local run + log capture)
- [ ] `npm run release:evidence:cleanup` (clean raw logs before sharing)
- [ ] `npm run release:public-safety-check`

## Required evidence files

Attach or link local-safe outputs from `<artifact-dir>`:

- [ ] `release-provenance.txt` (from `release:provenance`)
- [ ] `checksums.sha256` (from `release:checksums`)
- [ ] `release-notes.md` (from `release:notes`)
- [ ] `docs/release-dry-run-evidence.md` (or generated equivalent file), including:
  - command evidence locations,
  - CI run URLs,
  - artifact presence and public-safe gate results.

Preferred evidence log labels (for `release:evidence` defaults):

- `<local-only evidence log: lint.log>`
- `<local-only evidence log: license-positioning-check.log>`
- `<local-only evidence log: guided-flow-check.log>`
- `<local-only evidence log: build.log>`
- `<local-only evidence log: native-doctor.log>`
- `<local-only evidence log: release-smoke.log>`
- `<local-only evidence log: release-review-check.log>`
- `<local-only evidence log: ci-maintenance-check.log>`
- `<local-only evidence log: first-release-check.log>`
- `<local-only evidence log: public-safety-check.log>`

## Sanity checks

- [ ] `checksums.sha256` contains entries for all expected public artifacts.
- [ ] `release-provenance.txt` includes commit, branch, timestamp, and versions.
- [ ] `release-notes.md` includes generated metadata and checksum table.
- [ ] Public README/package/release docs match the PolyForm Noncommercial public licence plus commercial-use boundary.
- [ ] Guided flow guard passes for the public UI path.
- [ ] `release-notes.md` does **not** contain private/local machine paths.
- [ ] No private files, secrets, or sensitive data are included in release notes or checked-in docs.
- [ ] `npm run release:public-safety-check` passes.
- [ ] Raw evidence logs are local-only and excluded from sharing.

## Public artifact rules

- [ ] Artifacts are limited to public build outputs only (`NoMeter_*.exe`, `NoMeter_*.msi`, `nometer-static.zip` or explicit replacement list).
- [ ] No screenshots/paths from private local folders are referenced in release metadata.
- [ ] Any example paths are sanitized and non-sensitive.

## Manual blocker list (must be empty to proceed)

- [ ] Version parity issue (docs/changelog mismatch).
- [ ] Checksum mismatch in a random sample artifact.
- [ ] Provenance missing required fields.
- [ ] Missing or non-reproducible public-safe evidence.

If any blocker stays unchecked, do not publish the release.
