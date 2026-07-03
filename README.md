# NoMeter

[![CI](https://github.com/Martin123132/NoMeter/actions/workflows/ci.yml/badge.svg)](https://github.com/Martin123132/NoMeter/actions/workflows/ci.yml)

NoMeter is a **source-available, local-first conversion toolbox** for browser and desktop workflows. It is free for personal and non-commercial use: files stay on your machine by default; there are no uploads, no accounts, and no usage credits.

Commercial use requires a separate written license from TWO HANDS NETWORK LTD. That includes resale, paid products, hosted/SaaS/API services, managed services, enterprise products, commercial developer tools, commercial AI systems, and commercial AI training/evaluation pipelines.

## Download

Latest release: [`v0.5.0`](https://github.com/Martin123132/NoMeter/releases/tag/v0.5.0)

- Use `NoMeter_0.5.0_x64-portable.exe` for the Windows desktop app.
- Use `nometer-static.zip` for browser/static hosting or inspection.
- Download `checksums.sha256` and verify hashes before running release artifacts.

```powershell
Get-FileHash .\NoMeter_0.5.0_x64-portable.exe -Algorithm SHA256
Get-FileHash .\nometer-static.zip -Algorithm SHA256
```

First run:

1. Launch the portable `.exe`.
2. Leave `Guided` mode on.
3. Click `Try sample files`.
4. Click `Run conversion`.
5. Open the result from the Exports panel.

Desktop-native jobs also show the saved file path in Exports. Set Work folder and Save folder in the Native pack panel before running your own native jobs.

See [`docs/first-run.md`](docs/first-run.md) for the short user guide and [`docs/windows-trust.md`](docs/windows-trust.md) for the current unsigned-artifact trust model.

## What this project does

- Convert images in-browser (SVG, PNG, JPG, WebP, GIF, BMP).
- Bundle mixed local files into ZIP archives in-browser.
- Merge PDF files in-browser.
- Split PDFs into ZIP archives in-browser.
- Run desktop conversions with bundled sidecar engines:
  - FFmpeg: media transcoding to MP4.
  - Pandoc: document output to HTML, DOCX, Markdown, EPUB.
  - qpdf: PDF repair/compression/linearization.
  - Ghostscript: optional local PDF compression when installed/configured.
  - Rat-Trap: optional local GMW archive packing, metadata inspection, extraction, and ZIP export when installed/configured.
- Configure native work and save directories (with defaults that can be set to avoid system-drive usage).

## Quick start

### 1) Install and run in the browser

```powershell
npm install
npm run dev
```

Open the app at the URL shown by Vite.

### 2) Native desktop mode (Tauri)

```powershell
npm run desktop:dev
```

Desktop mode enables the native engines above. Use the sidebars to switch between recipes.

### 3) Build artifacts

```powershell
npm run lint
npm run build
npm run release:portable -- --artifact-dir D:\path\to\artifacts
```

`release:portable` builds the web bundle, builds the desktop executable without packaging installers, and writes:

- `NoMeter_<version>_x64-portable.exe`
- `nometer-static.zip`

Installer builds are still available with `npm run desktop:build`, but the portable artifact path is the preferred first-release route while installer packaging is being hardened.

After a successful installer build, collect installer artifacts with:

```powershell
npm run release:installers -- --artifact-dir D:\path\to\artifacts --strict
```

See [`docs/installer-packaging.md`](docs/installer-packaging.md) before including installer files in a public release.

## Usage guide

### Browser workflows

- `image-convert`: image re-encode/format conversion with optional quality control.
- `archive-zip`: bundle any local files into one ZIP archive.
- `pdf-merge`: combine PDFs.
- `pdf-split`: split PDF pages into ZIP archives.

### Native workflows

- `native-engine`: audio/video conversion with FFmpeg.
- `document-convert`: document conversion with Pandoc.
- `pdf-optimize`: PDF repair/compression with qpdf.

### Runtime folders

- Work folder: configurable in Settings.
- Save folder: configurable in Settings.

If you run on a machine with custom drives or folders, set your own values in the UI before queued native jobs.

## Public proof / screenshots

The following outputs are demo-safe and sanitized:

- Native folder export artifact: [`docs/proof/nometer-folder-e2e.html`](docs/proof/nometer-folder-e2e.html)
- Native run screenshot: [`docs/proof/nometer-folder-e2e.png`](docs/proof/nometer-folder-e2e.png)

## Release readiness

For a public-safe release preparation pass (without publishing a release), use:

```powershell
npm run release:portable -- --artifact-dir D:\path\to\artifacts
npm run release:prepare -- --artifact-dir D:\path\to\artifacts
```

This builds the portable/static artifacts, then runs lint + licence positioning + web build + native doctor and writes provenance and checksums to the artifact folder.

Generate a paste-ready release draft (without publishing):

```powershell
npm run release:portable -- --artifact-dir D:\path\to\artifacts
npm run release:prepare -- --artifact-dir D:\path\to\artifacts
npm run release:notes -- --artifact-dir D:\path\to\artifacts --stdout
```

For CI-safe verification in developer workflows:

```powershell
npm run release:smoke
npm run release:verify-download
```

Optional flags are available for local-only runs (for example `--skip-build`, `--skip-doctor`, `--non-strict`).

See the full checklist: [`docs/release-readiness.md`](docs/release-readiness.md).

## Roadmap snapshot

- Browser core is stable (images/ZIP/PDF merge/split).
- Native engine adapters (FFmpeg, Pandoc, qpdf) are wired and queue-integrated.
- Ghostscript PDF compression/rasterization and Rat-Trap GMW archive workflows are available as optional local desktop engines.
- Remaining roadmap focuses on OCR support and richer document formats.

Full roadmap details live in [`ROADMAP.md`](ROADMAP.md).

## Development checks

Run these before PRs:

```powershell
npm run lint
npm run license:positioning-check
npm run qa:guided-flow-check
npm run build
npm run native:doctor
npm run native:ocr-preflight
```

`native:doctor` verifies local prerequisites and emits useful warnings for optional engines not yet bundled.
`native:ocr-preflight` keeps the planned Tesseract/OCRmyPDF path visible without requiring OCR tools in CI; run it with `-- --strict` after installing local OCR binaries.
`license:positioning-check` keeps public wording aligned with the non-commercial public licence and commercial-use boundary.
`qa:guided-flow-check` keeps the guided conversion path, mixed-file recipe switching, mobile queue cards, and native folder guardrails from drifting.

### Related scripts

- `npm run native:sync-sidecars`: sync local native sidecars.
- `npm run native:ocr-preflight`: check planned local OCR prerequisites and D-drive posture.
- `npm run native:relocate-tauri-cache`: copy bundler cache back to configured toolchain-safe path.

## License

NoMeter is licensed for personal and non-commercial use under the **PolyForm Noncommercial License 1.0.0**. See [`LICENSE`](LICENSE) and [`NOTICE.md`](NOTICE.md).

Commercial use is not granted by the public licence. See [`COMMERCIAL-LICENSE.md`](COMMERCIAL-LICENSE.md) before bundling NoMeter into paid products, hosted services, managed services, enterprise tools, commercial AI systems, or commercial AI training/evaluation pipelines.

```text
NoMeter mission: free personal use, no uploads, no usage credits.
```
