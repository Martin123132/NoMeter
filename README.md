# OpenForge

OpenForge is a local-first, open-source file conversion and PDF toolbox.

The aim is simple: give people the everyday converter tools they pay subscriptions for, without accounts, credits, watermarks, or uploading private files to someone else's server.

## What Works Today

- Batch image conversion in the browser: SVG, PNG, JPG, WebP, GIF, BMP to WebP, PNG, or JPEG.
- PDF merge in the browser with `pdf-lib`.
- PDF split-to-ZIP in the browser with `pdf-lib` and `jszip`.
- Downloadable exports from local browser memory.
- A responsive React/Vite workbench.
- A Tauri v2 desktop scaffold for the native engine pack.

## Native Engine Pack

The next layer is the desktop runtime. The scaffold is present under `src-tauri/`, but this machine does not currently have Rust/Cargo installed, so the desktop binary has not been compiled here yet.

Planned engines:

- FFmpeg for audio/video conversion.
- Pandoc for document conversion.
- OCRmyPDF and Tesseract for OCR.
- qpdf and Ghostscript for PDF repair/compression.

OpenForge will default all project, output, and working directories away from the system drive when possible. For the current workspace, files live under `D:\Codex\OpenForge`.

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

Run the desktop app after installing Rust and platform prerequisites:

```powershell
npm.cmd run desktop:dev
```

## Desktop Prerequisites

- Rust and Cargo.
- WebView2 Runtime on Windows.
- Any native engines you want to use, either on `PATH` or bundled as Tauri sidecars later.

## License

OpenForge is licensed under AGPL-3.0-only. See `LICENSE`.

This is intentional: improvements made for network-hosted or productized versions should flow back to users.
