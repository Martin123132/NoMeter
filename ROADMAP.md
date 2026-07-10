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
- [x] Install Rust/Cargo on the build machine.
- [x] Compile desktop release build.
- [x] Add FFmpeg sidecar adapter.
- [x] Build Windows MSI installer.
- [x] Build Windows NSIS installer.
- [x] Add Pandoc sidecar adapter.
- [x] Add qpdf PDF repair/linearization adapter.
- [x] Add Ghostscript optional local PDF compression adapter.
- [x] Add Rat-Trap optional local GMW archive adapter.
- [x] Add Rat-Trap GMW metadata inspection action.
- [x] Add Rat-Trap GMW extraction and ZIP export actions.
- [x] Add Ghostscript PDF rasterization adapter.
- [x] Add OCR install preflight/checklist.
- [x] Add Tesseract image-to-text OCR adapter.
- [x] Add OCRmyPDF searchable-PDF OCR adapter.
- [x] Add installed OCR language selection and searchable-PDF modes.
- [x] Add D:-scoped working directory defaults for this workspace.
- [x] Add user-configurable work/save directory setting.

## Phase 3: Job Engine

- [x] Common job schema for browser and native tasks.
- [x] Retry failed jobs.
- [ ] Cancel running native jobs.
- [ ] Progress events.
- [x] Persistent local conversion history.
- [x] Output directory picker.
- [x] Guarded automatic temp cleanup.
- [ ] Persist resumable source handles where the host platform permits it.

## Phase 4: Release

- [x] Windows portable build.
- [x] Windows installer.
- [ ] GitHub Actions release pipeline.
- [ ] macOS build.
- [ ] Linux build.
