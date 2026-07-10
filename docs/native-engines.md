# Native Engine Pack

NoMeter's browser MVP already handles image conversion, ZIP bundling, PDF merge, and PDF split locally. The native engine pack adds the formats that need real system binaries.

## Target Engines

| Engine | Use | Status |
|---|---|---|
| FFmpeg | Audio/video conversion, extraction, GIF/video workflows | Wired |
| Pandoc | Documents, Markdown, HTML, DOCX, ODT | Wired |
| qpdf | PDF repair, linearization, structural operations | Wired |
| Ghostscript | PDF compression through local `pdfwrite`, plus PDF page rasterization to PNG/JPEG ZIPs | Optional local engine |
| Rat-Trap | GMW archive packing, metadata inspection, extraction, and ZIP export | Optional local engine |
| OCRmyPDF | Searchable scanned PDFs | Optional local engine |
| Tesseract | OCR text recognition for image files | Optional local engine |

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
- Tesseract executable override: `${NOMETER_TESSERACT_EXE}`
- OCRmyPDF tools: `${NOMETER_OCRMYPDF_ROOT}` or `${NOMETER_ROOT}/tools/ocrmypdf`
- OCRmyPDF executable override: `${NOMETER_OCRMYPDF_EXE}`
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

to verify prerequisites. Tesseract and OCRmyPDF are optional local engines: their adapters remain available when the tools are installed, while CI reports their absence without failing. Ghostscript is optional: it is usable when `native:doctor` can find `gswin64c`, `gs`, or an explicit `NOMETER_GHOSTSCRIPT_EXE`. Rat-Trap is optional: it is usable when `native:doctor` can find `rat-trap`, an explicit `NOMETER_RATTRAP_EXE`, or a Python package root at `NOMETER_RATTRAP_ROOT`. When that root contains `.venv`, NoMeter prefers the root-local Python before falling back to `PATH`.

On Windows, install Ghostscript from the official Artifex installer interactively and point the destination at your local tool folder, for example `${NOMETER_ROOT}/tools/ghostscript/gs10.07.1`. If the executable lives somewhere else, set `NOMETER_GHOSTSCRIPT_EXE` to the absolute `gswin64c.exe` path. NoMeter does not bundle Ghostscript in this repository.

Run:

```powershell
npm.cmd run native:ocr-preflight
```

to check the optional OCR toolchain. The check is advisory by default so CI can validate the configuration path without installing Tesseract or OCRmyPDF. After installing local OCR tools, run:

```powershell
npm.cmd run native:ocr-preflight -- --strict
```

before testing OCR commands in the app. Tesseract should be installed under the configured non-system tool folder, or exposed with `NOMETER_TESSERACT_EXE`, and should include at least one `.traineddata` language in a reachable `tessdata` folder. The app queries `tesseract --list-langs` and only offers installed language codes. The [Tesseract installation docs](https://tesseract-ocr.github.io/tessdoc/Installation.html) point Windows users to the UB Mannheim Windows builds. [OCRmyPDF's Windows guidance](https://ocrmypdf.readthedocs.io/en/latest/installation.html) requires 64-bit Python, Tesseract, and Ghostscript; prefer a root-local virtual environment under `${NOMETER_OCRMYPDF_ROOT}`.

`native:doctor` checks the optional engine roots above before falling back to `PATH`. Passing optional checks means the tool is discoverable on the developer machine. The UI marks Ghostscript, Rat-Trap, Tesseract, and OCRmyPDF as `Optional` because their adapters are wired but their third-party runtimes are not bundled.

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

The current Ghostscript adapter accepts a PDF `File`, writes it to the configured work folder, runs a locally installed Ghostscript executable, and copies outputs to the configured save folder. It supports controlled `pdfwrite` compression and PNG or JPEG page rasterization packaged as a ZIP. It does not bundle Ghostscript.

The current Rat-Trap adapter accepts queued NoMeter files, writes them to a configured work folder, runs a locally installed Rat-Trap CLI or Python package entry point, and copies the `.gmw` output to the configured save folder. It can also accept a `.gmw` archive, save a metadata report from `rat-trap info`, extract it into the configured save folder, or export it to a standard ZIP. It does not bundle Rat-Trap or copy private engine source into this public repository.

The current Tesseract adapter accepts image files, writes them to the configured work folder, runs a locally installed Tesseract executable with the selected installed language data, and copies the plain-text OCR output to the configured save folder. It does not upload images or bundle Tesseract.

The current OCRmyPDF adapter accepts PDF files, writes them to the configured work folder, runs a locally installed OCRmyPDF executable with the selected language and keep-text or redo-OCR mode, and copies the searchable PDF output to the configured save folder. It does not upload PDFs or bundle OCRmyPDF.

Generated `job-*` directories are eligible for automatic cleanup after 24 hours. Each new work directory carries a `.nometer-job` ownership marker; cleanup refuses to remove directories without it. The cleanup command only inspects direct generated job directories under the configured non-system Work folder, skips symbolic links, and never touches the Save folder. `Clean now` uses the same guard with a zero-hour threshold.

## Optional Engine Promotion Rules

Before Ghostscript, Tesseract, or OCRmyPDF is promoted from optional-local to bundled:

- Add a dedicated Tauri command with structured arguments.
- Add sidecar or local-tool discovery rules.
- Keep work and save folders explicit and off the system drive.
- Pass `native:ocr-preflight -- --strict` on the local OCR machine.
- Add a deterministic sample or fixture path where practical.
- Update `native:doctor`, the UI engine status, and release notes together.
