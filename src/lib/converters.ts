export type ImageFormat = 'png' | 'jpeg' | 'webp'

const imageMimeTypes: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const imageExtensions: Record<ImageFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`
}

export function fileStem(fileName: string) {
  const trimmed = fileName.trim()
  const withoutExtension = trimmed.replace(/\.[^/.]+$/, '')
  return withoutExtension || 'openforge-export'
}

export function imageOutputName(fileName: string, format: ImageFormat) {
  return `${fileStem(fileName)}.${imageExtensions[format]}`
}

export async function convertImageFile(file: File, format: ImageFormat, qualityPercent: number) {
  const bitmap = await loadImage(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas rendering is unavailable in this browser.')
  }

  canvas.width = bitmap.naturalWidth
  canvas.height = bitmap.naturalHeight

  if (format === 'jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(bitmap, 0, 0)

  const quality = Math.min(Math.max(qualityPercent / 100, 0.05), 1)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, imageMimeTypes[format], quality)
  })

  if (!blob) {
    throw new Error(`Could not encode ${format.toUpperCase()} output.`)
  }

  return blob
}

export async function mergePdfFiles(files: File[]) {
  const { PDFDocument } = await import('pdf-lib')
  const mergedPdf = await PDFDocument.create()

  for (const file of files) {
    const sourcePdf = await PDFDocument.load(await file.arrayBuffer())
    const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
    pages.forEach((page) => mergedPdf.addPage(page))
  }

  const bytes = await mergedPdf.save({ useObjectStreams: true })
  return bytesToBlob(bytes, 'application/pdf')
}

export async function splitPdfFilesToZip(files: File[]) {
  const [{ PDFDocument }, { default: JSZip }] = await Promise.all([import('pdf-lib'), import('jszip')])
  const zip = new JSZip()

  for (const file of files) {
    const sourcePdf = await PDFDocument.load(await file.arrayBuffer())
    const pageIndices = sourcePdf.getPageIndices()
    const folder = zip.folder(fileStem(file.name))

    if (!folder) {
      throw new Error(`Could not create split folder for ${file.name}.`)
    }

    for (const pageIndex of pageIndices) {
      const pagePdf = await PDFDocument.create()
      const [page] = await pagePdf.copyPages(sourcePdf, [pageIndex])
      pagePdf.addPage(page)
      const bytes = await pagePdf.save({ useObjectStreams: true })
      folder.file(`${fileStem(file.name)}-page-${pageIndex + 1}.pdf`, bytes)
    }
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not decode ${file.name}.`))
    }

    image.src = url
  })
}

function bytesToBlob(bytes: Uint8Array, type: string) {
  const buffer = bytes.slice().buffer as ArrayBuffer
  return new Blob([buffer], { type })
}
