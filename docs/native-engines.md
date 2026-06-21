# Native Engine Pack

OpenForge's browser MVP already handles image conversion, PDF merge, and PDF split locally. The native engine pack adds the formats that need real system binaries.

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

- Rust/Cargo: `D:\Codex\Toolchains\rust`
- FFmpeg tools: `D:\Codex\OpenForge\tools\ffmpeg`
- Pandoc tools: `D:\Codex\OpenForge\tools\pandoc`
- FFmpeg sidecars: `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` and `ffprobe-x86_64-pc-windows-msvc.exe`
- Pandoc sidecar: `src-tauri/binaries/pandoc-x86_64-pc-windows-msvc.exe`
- Work directory: `D:\Codex\OpenForge\work`
- Bundler cache moved to: `D:\Codex\OpenForge\tools\local-appdata\tauri`

Run:

```powershell
npm.cmd run native:doctor
```

to verify prerequisites. qpdf, Ghostscript, Tesseract, and OCRmyPDF are expected warnings until their adapters are added.

Build installers with:

```powershell
npm.cmd run desktop:build
```

The current FFmpeg adapter accepts an audio/video `File`, writes it to the D:-scoped work folder, runs the bundled FFmpeg sidecar, and returns a downloadable MP4 blob to the React job queue.

The current Pandoc adapter accepts a document `File`, writes it to the D:-scoped work folder, runs the bundled Pandoc sidecar, and returns downloadable HTML, DOCX, Markdown, or EPUB.
