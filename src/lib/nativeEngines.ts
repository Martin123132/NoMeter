export type NativeEngineId = 'ffmpeg' | 'pandoc' | 'qpdf' | 'ghostscript' | 'rattrap' | 'ocrmypdf' | 'tesseract'

export type NativeEngine = {
  id: NativeEngineId
  name: string
  role: string
  command: string
  sidecarName: string
  status: 'planned' | 'wired' | 'optional'
}

export type NativeRuntimeStatus = {
  available: boolean
  label: string
  detail: string
}

export type NativeFolders = {
  workDir: string
  outputDir: string
}

export type DocumentOutputFormat = 'html' | 'docx' | 'markdown' | 'epub'

export type NativeTranscodeResult = {
  name: string
  blob: Blob
  log: string
  savedPath?: string
}

export const nativeEngineCatalog: NativeEngine[] = [
  {
    id: 'ffmpeg',
    name: 'FFmpeg',
    role: 'audio and video transcode',
    command: 'ffmpeg',
    sidecarName: 'ffmpeg',
    status: 'wired',
  },
  {
    id: 'pandoc',
    name: 'Pandoc',
    role: 'document format bridge',
    command: 'pandoc',
    sidecarName: 'pandoc',
    status: 'wired',
  },
  {
    id: 'qpdf',
    name: 'qpdf',
    role: 'PDF repair and structural operations',
    command: 'qpdf',
    sidecarName: 'qpdf',
    status: 'wired',
  },
  {
    id: 'ghostscript',
    name: 'Ghostscript',
    role: 'optional local PDF compression',
    command: 'gswin64c',
    sidecarName: 'local Ghostscript',
    status: 'optional',
  },
  {
    id: 'rattrap',
    name: 'Rat-Trap',
    role: 'optional local GMW archive compression',
    command: 'rat-trap',
    sidecarName: 'local Rat-Trap',
    status: 'optional',
  },
  {
    id: 'ocrmypdf',
    name: 'OCRmyPDF',
    role: 'planned searchable scanned PDFs',
    command: 'ocrmypdf',
    sidecarName: 'ocrmypdf',
    status: 'planned',
  },
  {
    id: 'tesseract',
    name: 'Tesseract',
    role: 'planned offline OCR recognition',
    command: 'tesseract',
    sidecarName: 'tesseract',
    status: 'planned',
  },
]

export function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in globalThis || '__TAURI__' in globalThis
}

export async function getNativeRuntimeStatus(): Promise<NativeRuntimeStatus> {
  if (!isTauriRuntime()) {
    return {
      available: false,
      label: 'Web preview',
      detail: 'Browser-local jobs are active. Native engines need the Tauri desktop runtime.',
    }
  }

  try {
    await import('@tauri-apps/api/core')
    return {
      available: true,
      label: 'Desktop bridge',
      detail: 'Tauri bridge loaded. FFmpeg, Pandoc, and qpdf conversion are available in the desktop app.',
    }
  } catch {
    return {
      available: false,
      label: 'Desktop bridge missing',
      detail: 'The Tauri runtime was detected, but the shell plugin did not load.',
    }
  }
}

export async function pickNativeFolder(defaultPath?: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    throw new Error('Folder picker requires the NoMeter desktop app.')
  }

  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    title: 'Choose NoMeter folder',
    directory: true,
    multiple: false,
    defaultPath: defaultPath?.trim() || undefined,
    canCreateDirectories: true,
  })

  return typeof selected === 'string' ? selected : null
}

export function getNativeCommandPreview(engine: NativeEngine) {
  if (engine.status === 'wired') return `${engine.command} via ${engine.sidecarName} sidecar`
  if (engine.status === 'optional') return `${engine.command} via ${engine.sidecarName}`
  return `${engine.command} via ${engine.sidecarName} planned sidecar`
}

export async function transcodeMediaFile(file: File, folders?: NativeFolders): Promise<NativeTranscodeResult> {
  if (!isTauriRuntime()) {
    throw new Error('Native media conversion requires the NoMeter desktop app.')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const artifact = await invoke<{
    name: string
    mimeType: string
    bytesBase64: string
    log: string
    savedPath?: string
  }>('transcode_media', {
    request: {
      fileName: file.name,
      bytesBase64: await fileToBase64(file),
      outputExtension: 'mp4',
      folders: normalizeNativeFolders(folders),
    },
  })

  return {
    name: artifact.name,
    blob: base64ToBlob(artifact.bytesBase64, artifact.mimeType),
    log: artifact.log,
    savedPath: artifact.savedPath,
  }
}

export async function convertDocumentFile(
  file: File,
  outputFormat: DocumentOutputFormat,
  folders?: NativeFolders,
): Promise<NativeTranscodeResult> {
  if (!isTauriRuntime()) {
    throw new Error('Native document conversion requires the NoMeter desktop app.')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const artifact = await invoke<{
    name: string
    mimeType: string
    bytesBase64: string
    log: string
    savedPath?: string
  }>('convert_document', {
    request: {
      fileName: file.name,
      bytesBase64: await fileToBase64(file),
      outputFormat,
      folders: normalizeNativeFolders(folders),
    },
  })

  return {
    name: artifact.name,
    blob: base64ToBlob(artifact.bytesBase64, artifact.mimeType),
    log: artifact.log,
    savedPath: artifact.savedPath,
  }
}

export async function optimizePdfFile(file: File, folders?: NativeFolders): Promise<NativeTranscodeResult> {
  if (!isTauriRuntime()) {
    throw new Error('Native PDF optimization requires the NoMeter desktop app.')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const artifact = await invoke<{
    name: string
    mimeType: string
    bytesBase64: string
    log: string
    savedPath?: string
  }>('optimize_pdf', {
    request: {
      fileName: file.name,
      bytesBase64: await fileToBase64(file),
      folders: normalizeNativeFolders(folders),
    },
  })

  return {
    name: artifact.name,
    blob: base64ToBlob(artifact.bytesBase64, artifact.mimeType),
    log: artifact.log,
    savedPath: artifact.savedPath,
  }
}

export async function compressPdfFile(file: File, folders?: NativeFolders): Promise<NativeTranscodeResult> {
  if (!isTauriRuntime()) {
    throw new Error('Ghostscript PDF compression requires the NoMeter desktop app.')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const artifact = await invoke<{
    name: string
    mimeType: string
    bytesBase64: string
    log: string
    savedPath?: string
  }>('compress_pdf_with_ghostscript', {
    request: {
      fileName: file.name,
      bytesBase64: await fileToBase64(file),
      preset: 'ebook',
      folders: normalizeNativeFolders(folders),
    },
  })

  return {
    name: artifact.name,
    blob: base64ToBlob(artifact.bytesBase64, artifact.mimeType),
    log: artifact.log,
    savedPath: artifact.savedPath,
  }
}

export async function compressFilesWithRatTrap(files: File[], folders?: NativeFolders): Promise<NativeTranscodeResult> {
  if (!isTauriRuntime()) {
    throw new Error('Rat-Trap archive compression requires the NoMeter desktop app.')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const artifact = await invoke<{
    name: string
    mimeType: string
    bytesBase64: string
    log: string
    savedPath?: string
  }>('compress_files_with_rat_trap', {
    request: {
      files: await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          bytesBase64: await fileToBase64(file),
        })),
      ),
      folders: normalizeNativeFolders(folders),
    },
  })

  return {
    name: artifact.name,
    blob: base64ToBlob(artifact.bytesBase64, artifact.mimeType),
    log: artifact.log,
    savedPath: artifact.savedPath,
  }
}

function normalizeNativeFolders(folders?: NativeFolders) {
  if (!folders) return undefined

  return {
    workDir: folders.workDir.trim(),
    outputDir: folders.outputDir.trim(),
  }
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function base64ToBlob(base64: string, type: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type })
}
