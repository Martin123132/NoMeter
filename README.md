# OpenForge

OpenForge is a local-first, open-source file conversion and PDF toolbox.

The aim is simple: give people the everyday converter tools they pay subscriptions for, without accounts, credits, watermarks, or uploading private files to someone else's server.

## What Works Today

- Batch image conversion in the browser: SVG, PNG, JPG, WebP, GIF, BMP to WebP, PNG, or JPEG.
- PDF merge in the browser with `pdf-lib`.
- PDF split-to-ZIP in the browser with `pdf-lib` and `jszip`.
- Downloadable exports from local browser memory.
- A responsive React/Vite workbench.
- A Tauri v2 desktop build with bundled FFmpeg, FFprobe, Pandoc, and qpdf sidecars.
- Desktop FFmpeg audio/video transcode to MP4 through a Tauri command.
- Desktop Pandoc document conversion to HTML, DOCX, Markdown, and EPUB.
- Desktop qpdf PDF repair, compression, and linearization.
- Desktop work/save folder settings with D:-drive defaults.
- Windows MSI and NSIS installer outputs.

## Native Engine Pack

The desktop runtime is present under `src-tauri/`. On this workspace, Rust/Cargo live under `D:\Codex\Toolchains\rust`, native tools live under `D:\Codex\OpenForge\tools`, and OpenForge work files default to `D:\Codex\OpenForge\work`.

Current engines:

- FFmpeg for audio/video conversion to MP4.
- Pandoc for Markdown, HTML, DOCX, ODT, RTF, text, and EPUB document conversion.
- qpdf for PDF repair, compression, and linearization.

Planned engines:

- OCRmyPDF and Tesseract for OCR.
- Ghostscript for PDF rasterization and deeper compression.

OpenForge keeps this workspace's project, outputs, toolchains, build caches, and working directories away from the system drive where the tooling allows it. Tauri's Windows bundler cache is moved back to `D:\Codex\OpenForge\tools\local-appdata\tauri` after packaging.

Native desktop jobs default to:

- Work folder: `D:\Codex\OpenForge\work`
- Save folder: `D:\Codex\OpenForge\outputs\converted`

## Development

```powershell
npm.cmd install
npm.cmd run dev
```

Build the web app:

```powershell
npm.cmd run lint
npm.cmd run build
```

Preview the production build:

```powershell
npm.cmd run preview -- --host 127.0.0.1 --port 4173
```

Check native prerequisites:

```powershell
npm.cmd run native:doctor
```

Sync native sidecars after downloading or updating native tools:

```powershell
npm.cmd run native:sync-sidecars
```

Run the desktop app:

```powershell
npm.cmd run desktop:dev
```

Build the desktop installers:

```powershell
npm.cmd run desktop:build
```

Current release artifacts are copied to `D:\Codex\OpenForge\outputs`:

- `OpenForge_0.4.0_x64-setup.exe`
- `OpenForge_0.4.0_x64_en-US.msi`
- `openforge-static.zip`

## Desktop Prerequisites

- Rust and Cargo.
- Microsoft C++ Build Tools and WebView2 Runtime on Windows.
- FFmpeg, FFprobe, Pandoc, and qpdf synced into `src-tauri/binaries` with the platform target-triple suffix.
- Any additional native engines you want to use, either on `PATH` or bundled as Tauri sidecars later.

## License

OpenForge is licensed under AGPL-3.0-only. See `LICENSE`.

This is intentional: improvements made for network-hosted or productized versions should flow back to users.
