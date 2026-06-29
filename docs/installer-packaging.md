# Windows Installer Packaging

NoMeter `v0.5.0` ships the portable Windows executable as the recommended public desktop artifact. Installer artifacts are still supported, but should be included in a future release only after a clean installer rehearsal.

## Artifact Types

| Artifact | Purpose | Current posture |
|---|---|---|
| `NoMeter_<version>_x64-portable.exe` | Portable desktop app | Preferred public desktop artifact |
| `NoMeter_<version>_x64-setup.exe` | NSIS installer | Optional after packaging rehearsal |
| `NoMeter_<version>_x64_en-US.msi` | MSI installer | Optional after packaging rehearsal |
| `nometer-static.zip` | Static web bundle | Public inspection/static hosting artifact |

## Build Installers

Run the desktop bundle build from the repository:

```powershell
npm run desktop:build
```

The command uses the D-drive toolchain wrapper in `scripts/with-d-toolchain.mjs`, including D-drive temp/work/cache defaults.

Expected Tauri output folders:

- `src-tauri/target/release/bundle/nsis`
- `src-tauri/target/release/bundle/msi`

## Copy Installers Into The Release Artifact Folder

After `desktop:build`, copy installer outputs into the selected release artifact folder:

```powershell
npm run release:installers -- --artifact-dir <artifact-dir> --strict
```

The helper searches the Tauri bundle folders, normalizes the public filenames, and writes:

- `NoMeter_<version>_x64-setup.exe`
- `NoMeter_<version>_x64_en-US.msi`

Use `--strict` for release rehearsals so missing installer outputs fail the command.

## Validate With Release Metadata

After copying installers, regenerate and inspect release metadata:

```powershell
npm run release:prepare -- --artifact-dir <artifact-dir>
npm run release:notes -- --artifact-dir <artifact-dir>
npm run release:public-safety-check -- --artifact-dir <artifact-dir>
```

The existing checksum patterns include installer files, so `checksums.sha256` should cover the portable executable, optional installer files, and `nometer-static.zip`.

## Include Installers Only When All Gates Pass

Do not include installer artifacts in a public release unless:

- `npm run desktop:build` completes on the release machine.
- `npm run release:installers -- --artifact-dir <artifact-dir> --strict` copies both installer types.
- `release:prepare`, `release:notes`, `release:public-safety-check`, and `release:verify-download` remain clean for the final artifact set.
- The release notes clearly state whether users should prefer the portable app or installer.
