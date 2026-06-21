export type NativeEngineId = 'ffmpeg' | 'pandoc' | 'qpdf' | 'ghostscript' | 'ocrmypdf' | 'tesseract'

export type NativeEngine = {
  id: NativeEngineId
  name: string
  role: string
  command: string
  sidecarName: string
  status: 'planned' | 'wired'
}

export type NativeRuntimeStatus = {
  available: boolean
  label: string
  detail: string
}

export type NativeTranscodeResult = {
  name: string
  blob: Blob
  log: string
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
    status: 'planned',
  },
  {
    id: 'qpdf',
    name: 'qpdf',
    role: 'PDF repair and structural operations',
    command: 'qpdf',
    sidecarName: 'qpdf',
    status: 'planned',
  },
  {
    id: 'ghostscript',
    name: 'Ghostscript',
    role: 'PDF compression and rasterization',
    command: 'gswin64c',
    sidecarName: 'ghostscript',
    status: 'planned',
  },
  {
    id: 'ocrmypdf',
    name: 'OCRmyPDF',
    role: 'scanned PDF text layer',
    command: 'ocrmypdf',
    sidecarName: 'ocrmypdf',
    status: 'planned',
  },
  {
    id: 'tesseract',
    name: 'Tesseract',
    role: 'offline OCR recognition',
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
      detail: 'Tauri bridge loaded. FFmpeg media conversion is available in the desktop app.',
    }
  } catch {
    return {
      available: false,
      label: 'Desktop bridge missing',
      detail: 'The Tauri runtime was detected, but the shell plugin did not load.',
    }
  }
}

export function getNativeCommandPreview(engine: NativeEngine) {
  return `${engine.command} via ${engine.sidecarName} sidecar`
}

export async function transcodeMediaFile(file: File): Promise<NativeTranscodeResult> {
  if (!isTauriRuntime()) {
    throw new Error('Native media conversion requires the OpenForge desktop app.')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const artifact = await invoke<{
    name: string
    mimeType: string
    bytesBase64: string
    log: string
  }>('transcode_media', {
    request: {
      fileName: file.name,
      bytesBase64: await fileToBase64(file),
      outputExtension: 'mp4',
    },
  })

  return {
    name: artifact.name,
    blob: base64ToBlob(artifact.bytesBase64, artifact.mimeType),
    log: artifact.log,
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
