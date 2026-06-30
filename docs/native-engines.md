# Native Engine Pack

NoMeter's browser MVP already handles image conversion, ZIP bundling, PDF merge, and PDF split locally. The native engine pack adds the formats that need real system binaries.

## Target Engines

| Engine | Use | Status |
|---|---|---|
| FFmpeg | Audio/video conversion, extraction, GIF/video workflows | Wired |
| Pandoc | Documents, Markdown, HTML, DOCX, ODT | Wired |
| qpdf | PDF repair, linearization, structural operations | Wired |
| Ghostscript | PDF compression through local `pdfwrite` | Optional local engine |
| Rat-Trap | GMW archive compression for local file batches | Optional local engine |
| OCRmyPDF | Searchable scanned PDFs | Planned optional engine |
| Tesseract | OCR text recognition | Planned optional engine |

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
- Ghostscript tools: `${NOMETER_GHOSTSCRIPT_ROOT}` or `${NOMETER_ROOT}/tools/ghostscript`
- Rat-Trap tools: `${NOMETER_RATTRAP_ROOT}` or `${NOMETER_ROOT}/tools/rat-trap`
- Tesseract tools: `${NOMETER_TESSERACT_ROOT}` or `${NOMETER_ROOT}/tools/tesseract`
- OCRmyPDF tools: `${NOMETER_OCRMYPDF_ROOT}` or `${NOMETER_ROOT}/tools/ocrmypdf`
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

to verify prerequisites. Tesseract and OCRmyPDF are expected warnings until their adapters are added. Ghostscript is optional: it is usable when `native:doctor` can find `gswin64c`, `gs`, or an explicit `NOMETER_GHOSTSCRIPT_EXE`. Rat-Trap is optional: it is usable when `native:doctor` can find `rat-trap`, an explicit `NOMETER_RATTRAP_EXE`, or a Python package root at `NOMETER_RATTRAP_ROOT`. When that root contains `.venv`, NoMeter prefers the root-local Python before falling back to `PATH`.

`native:doctor` checks the optional engine roots above before falling back to `PATH`. Passing optional checks means the tool is discoverable on the developer machine. The UI marks Ghostscript and Rat-Trap as `Optional` and keeps Tesseract/OCRmyPDF as `Planned` until their native commands, sidecar policy, and sample/fixture paths exist.

Build the preferred portable release artifacts with:

```powershell
npm.cmd run release:portable -- --artifact-dir D:\path\to\artifacts
```

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

The current Ghostscript adapter accepts a PDF `File`, writes it to the configured work folder, runs a locally installed Ghostscript executable with a controlled `pdfwrite` compression preset, copies the output to the configured save folder, and returns a compressed PDF. It does not bundle Ghostscript.

The current Rat-Trap adapter accepts queued NoMeter files, writes them to a configured work folder, runs a locally installed Rat-Trap CLI or Python package entry point, copies the `.gmw` output to the configured save folder, and returns a downloadable GMW archive. It does not bundle Rat-Trap or copy private engine source into this public repository.

## Planned OCR/PDF Engine Rules

Before Tesseract or OCRmyPDF is promoted from `Planned` to `Wired`, or before Ghostscript is promoted from optional-local to bundled:

- Add a dedicated Tauri command with structured arguments.
- Add sidecar or local-tool discovery rules.
- Keep work and save folders explicit and off the system drive.
- Add a deterministic sample or fixture path where practical.
- Update `native:doctor`, the UI engine status, and release notes together.
