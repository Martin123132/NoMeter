# Native Engine Pack

NoMeter's browser MVP already handles image conversion, ZIP bundling, PDF merge, and PDF split locally. The native engine pack adds the formats that need real system binaries.

## Target Engines

| Engine | Use |
|---|---|
| FFmpeg | Audio/video conversion, extraction, GIF/video workflows |
| Pandoc | Documents, Markdown, HTML, DOCX, ODT |
| qpdf | PDF repair, linearization, structural operations |
| Ghostscript | PDF compression and rasterization |
| OCRmyPDF | Searchable scanned PDFs |
| Tesseract | OCR text recognition |

## Adapter Rules

- Use structured arguments, not shell-string interpolation.
- Only execute allowlisted engine IDs.
- Keep output paths explicit.
- Keep temporary work off the system drive when possible.
- Return progress and artifacts through the shared job model.
- Do not silently upload files.

## Current Status

The Tauri v2 desktop app builds successfully on Windows.

Paths shown below are examples; they should be configurable via your local environment:

- Rust/Cargo: `${NOMETER_TOOLCHAIN_ROOT}/rust` (example default: workspace toolchain root).
- FFmpeg tools: `${NOMETER_ROOT}/tools/ffmpeg`
- Pandoc tools: `${NOMETER_ROOT}/tools/pandoc`
- qpdf tools: `${NOMETER_ROOT}/tools/qpdf`
- FFmpeg sidecars: `src-tauri/binaries/ffmpeg-<host-triple>.exe` and `src-tauri/binaries/ffprobe-<host-triple>.exe`
- Pandoc sidecar: `src-tauri/binaries/pandoc-<host-triple>.exe`
- qpdf sidecar: `src-tauri/binaries/qpdf-<host-triple>.exe`
- qpdf runtime DLLs: `src-tauri/binaries/*.dll`
- Work directory: `${NOMETER_WORK_DIR}`
- Native save directory: current UI-configured save path
- Bundler cache moved to a configured cache-safe directory after packaging.

Legacy `OPENFORGE_*` variables are still supported for existing local setups, but new configuration should prefer `NOMETER_*`.

Run:

```powershell
npm.cmd run native:doctor
```

to verify prerequisites. Ghostscript, Tesseract, and OCRmyPDF are expected warnings until their adapters are added.

Build installers with:

```powershell
npm.cmd run desktop:build
```

The desktop UI can override the native work and save folders. Defaults can be
configured for local environments, and the web preview stores the preference without
writing files.

The current FFmpeg adapter accepts an audio/video `File`, writes it to the configured work folder, runs the bundled FFmpeg sidecar, copies the output to the configured save folder, and returns a downloadable MP4 blob to the React job queue.

The current Pandoc adapter accepts a document `File`, writes it to the configured work folder, runs the bundled Pandoc sidecar, copies the output to the configured save folder, and returns downloadable HTML, DOCX, Markdown, or EPUB.

The current qpdf adapter accepts a PDF `File`, writes it to the configured work folder, runs the bundled qpdf sidecar, copies the output to the configured save folder, and returns a repaired, compressed, linearized PDF.
