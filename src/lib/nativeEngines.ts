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

export const nativeEngineCatalog: NativeEngine[] = [
  {
    id: 'ffmpeg',
    name: 'FFmpeg',
    role: 'audio and video transcode',
    command: 'ffmpeg',
    sidecarName: 'ffmpeg',
    status: 'planned',
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
    await import('@tauri-apps/plugin-shell')
    return {
      available: true,
      label: 'Desktop bridge',
      detail: 'Tauri shell plugin is loaded; sidecar execution can be wired next.',
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
