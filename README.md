# NoMeter

[![CI](https://github.com/Martin123132/NoMeter/actions/workflows/ci.yml/badge.svg)](https://github.com/Martin123132/NoMeter/actions/workflows/ci.yml)

NoMeter is an **open-source, local-first conversion toolbox** for browser and desktop workflows. Files stay on your machine by default; there are no uploads, no accounts, and no usage limits.

## What this project does

- Convert images in-browser (SVG, PNG, JPG, WebP, GIF, BMP).
- Merge PDF files in-browser.
- Split PDFs into ZIP archives in-browser.
- Run desktop conversions with bundled sidecar engines:
  - FFmpeg: media transcoding to MP4.
  - Pandoc: document output to HTML, DOCX, Markdown, EPUB.
  - qpdf: PDF repair/compression/linearization.
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
npm run desktop:build   # Windows installer build
```

## Usage guide

### Browser workflows

- `image-convert`: image re-encode/format conversion with optional quality control.
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
npm run release:prepare -- --artifact-dir D:\path\to\artifacts
```

This runs lint + web build + native doctor, then writes provenance and checksums for release candidates (installers/static bundle) to the artifact folder.

Generate a paste-ready release draft (without publishing):

```powershell
npm run release:prepare -- --artifact-dir D:\path\to\artifacts
npm run release:notes -- --artifact-dir D:\path\to\artifacts --stdout
```

For CI-safe verification in developer workflows:

```powershell
npm run release:smoke
```

Optional flags are available for local-only runs (for example `--skip-build`, `--skip-doctor`, `--non-strict`).

See the full checklist: [`docs/release-readiness.md`](docs/release-readiness.md).

## Roadmap snapshot

- Browser core is stable (images/PDF merge/split).
- Native engine adapters (FFmpeg, Pandoc, qpdf) are wired and queue-integrated.
- Remaining roadmap focuses on OCR support, richer document formats, and portable builds.

Full roadmap details live in [`ROADMAP.md`](ROADMAP.md).

## Development checks

Run these before PRs:

```powershell
npm run lint
npm run build
npm run native:doctor
```

`native:doctor` verifies local prerequisites and emits useful warnings for optional engines not yet bundled.

### Related scripts

- `npm run native:sync-sidecars`: sync local native sidecars.
- `npm run native:relocate-tauri-cache`: copy bundler cache back to configured toolchain-safe path.

## License

NoMeter is licensed under **AGPL-3.0-only**. See [`LICENSE`](LICENSE).

```text
NoMeter mission: no credits, no limits, no uploads.
```
