# Release Dry-Run Evidence Index

Generated: 2026-06-22T07:56:08.364Z

Run metadata:
- Release version: 0.5.0
- Commit: c28072938e9c24f91f1410e6886d9f85a5ad8ace
- Branch: main
- Artifact directory: D:\Codex\OpenForge\outputs\release

## Required command evidence

Run each command and record terminal output path:

| Command | Evidence path | Result |
| --- | --- | --- |
| npm run lint | <record path> | |
| npm run build | <record path> | |
| npm run native:doctor | <record path> | |
| npm run release:smoke | <record path> | |
| npm run release:review-check | <record path> | |
| npm run ci:maintenance-check | <record path> | |
| npm run release:first-release-check | <record path> | |

## CI evidence URLs

| CI job | Run URL | Result |
| --- | --- | --- |
| Web QA | <paste CI run URL> | |
| Release metadata smoke | <paste CI run URL> | |
| Release review guard | <paste CI run URL> | |
| Native doctor | <paste CI run URL> | |
| CI maintenance check | <paste CI run URL> | |
| First release readiness check | <paste CI run URL> | |

## Required artifacts

| File | Location | Verified |
| --- | --- | --- |
| NoMeter_0.5.0_x64-setup.exe | D:\Codex\OpenForge\outputs\release\NoMeter_0.5.0_x64-setup.exe | NO |
| NoMeter_0.5.0_x64_en-US.msi | D:\Codex\OpenForge\outputs\release\NoMeter_0.5.0_x64_en-US.msi | NO |
| nometer-static.zip | D:\Codex\OpenForge\outputs\release\nometer-static.zip | NO |
| release-provenance.txt | D:\Codex\OpenForge\outputs\release\release-provenance.txt | NO |
| checksums.sha256 | D:\Codex\OpenForge\outputs\release\checksums.sha256 | NO |
| release-notes.md | D:\Codex\OpenForge\outputs\release\release-notes.md | NO |

## Public-safe gates

- [ ] No private/local paths are embedded in release-notes.md
- [ ] release-provenance.txt includes commit, branch, timestamp, and toolchain/runtime metadata
- [ ] checksums.sha256 includes all expected public artifacts
- [ ] release-notes.md includes artifact list and verification command guidance
