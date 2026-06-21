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

The Tauri v2 scaffold exists in `src-tauri/`.

This machine currently does not have Rust/Cargo installed, so desktop compilation is blocked until the Rust toolchain is installed. Run:

```powershell
npm.cmd run native:doctor
```

after installing Rust to verify prerequisites.
