# Release Dry-Run Evidence Index

Generated: 2026-06-23T01:35:40.853Z

Run metadata:
- Release version: 0.5.0
- Commit: f5596755f08af38f7fe513494e9a6d1b75575ec9
- Branch: main
- Artifact directory: outputs/release

## Required command evidence

Run each command and record terminal output path:

| Command | Evidence path | Result |
| --- | --- | --- |
| npm run lint | <local-only evidence log: lint.log> | |
| npm run build | <local-only evidence log: build.log> | |
| npm run native:doctor | <local-only evidence log: native-doctor.log> | |
| npm run release:smoke | <local-only evidence log: release-smoke.log> | |
| npm run release:review-check | <local-only evidence log: release-review-check.log> | |
| npm run ci:maintenance-check | <local-only evidence log: ci-maintenance-check.log> | |
| npm run release:first-release-check | <local-only evidence log: first-release-check.log> | |
| npm run release:public-safety-check | <local-only evidence log: public-safety-check.log> | |

## CI evidence URLs

| CI job | Run URL | Result |
| --- | --- | --- |
| Web QA | <paste CI run URL> | |
| Release metadata smoke | <paste CI run URL> | |
| Release review guard | <paste CI run URL> | |
| Native doctor | <paste CI run URL> | |
| CI maintenance check | <paste CI run URL> | |
| First release readiness check | <paste CI run URL> | |
| Public safety check | <paste CI run URL> | |

## Required artifacts

| File | Location | Verified |
| --- | --- | --- |
| NoMeter_0.5.0_x64-setup.exe | outputs/release/NoMeter_0.5.0_x64-setup.exe | NO |
| NoMeter_0.5.0_x64_en-US.msi | outputs/release/NoMeter_0.5.0_x64_en-US.msi | NO |
| nometer-static.zip | outputs/release/nometer-static.zip | NO |
| release-provenance.txt | outputs/release/release-provenance.txt | NO |
| checksums.sha256 | outputs/release/checksums.sha256 | NO |
| release-notes.md | outputs/release/release-notes.md | NO |

## Public-safe gates

- [ ] No private/local paths are embedded in release-notes.md
- [ ] release-provenance.txt includes commit, branch, timestamp, and toolchain/runtime metadata
- [ ] checksums.sha256 includes all expected public artifacts
- [ ] release-notes.md includes artifact list and verification command guidance
- [ ] npm run release:public-safety-check passes before sharing release-facing material
