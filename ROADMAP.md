# Roadmap

## Phase 1: Browser MVP

- [x] Local image conversion.
- [x] PDF merge.
- [x] PDF split-to-ZIP.
- [x] Static deploy bundle.
- [x] Responsive workbench.

## Phase 2: Desktop Native Pack

- [x] Tauri v2 scaffold.
- [x] Native engine catalog and readiness checks.
- [ ] Install Rust/Cargo on the build machine.
- [ ] Compile desktop dev build.
- [ ] Add FFmpeg sidecar adapter.
- [ ] Add Pandoc sidecar adapter.
- [ ] Add qpdf/Ghostscript PDF compression adapter.
- [ ] Add OCRmyPDF/Tesseract OCR adapter.
- [ ] Add configurable working directory defaults.

## Phase 3: Job Engine

- [ ] Common job schema for browser and native tasks.
- [ ] Cancel/retry.
- [ ] Progress events.
- [ ] Persistent history.
- [ ] Output directory picker.
- [ ] Automatic temp cleanup.

## Phase 4: Release

- [ ] Windows portable build.
- [ ] Windows installer.
- [ ] GitHub Actions release pipeline.
- [ ] macOS build.
- [ ] Linux build.
