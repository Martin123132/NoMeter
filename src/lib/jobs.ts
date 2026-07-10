export type ToolId =
  | 'image-convert'
  | 'archive-zip'
  | 'rat-trap-archive'
  | 'rat-trap-inspect'
  | 'rat-trap-extract'
  | 'rat-trap-export-zip'
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-optimize'
  | 'pdf-compress'
  | 'pdf-rasterize'
  | 'ocr-image-text'
  | 'ocr-searchable-pdf'
  | 'document-convert'
  | 'native-engine'

export type FileKind = 'image' | 'pdf' | 'media' | 'document' | 'archive' | 'unknown'
export type JobStatus = 'ready' | 'running' | 'done' | 'blocked' | 'error'

export type QueueJob = {
  id: string
  file: File
  name: string
  size: number
  type: string
  kind: FileKind
  status: JobStatus
  progress: number
  message: string
  outputName?: string
}

export type ExportArtifact = {
  id: string
  name: string
  url: string
  size: number
  action: string
  sourceCount: number
  createdAt: string
  savedPath?: string
}

export type ConversionHistoryEntry = {
  id: string
  name: string
  size: number
  action: string
  sourceCount: number
  createdAt: string
  tool: ToolId
  savedPath?: string
}

export const conversionHistoryStorageKey = 'nometer.conversionHistory.v1'
export const conversionHistoryLimit = 100
const toolIds: ToolId[] = [
  'image-convert',
  'archive-zip',
  'rat-trap-archive',
  'rat-trap-inspect',
  'rat-trap-extract',
  'rat-trap-export-zip',
  'pdf-merge',
  'pdf-split',
  'pdf-optimize',
  'pdf-compress',
  'pdf-rasterize',
  'ocr-image-text',
  'ocr-searchable-pdf',
  'document-convert',
  'native-engine',
]

export function historyEntryFromArtifact(
  artifact: ExportArtifact,
  tool: ToolId,
): ConversionHistoryEntry {
  return {
    id: artifact.id,
    name: artifact.name,
    size: artifact.size,
    action: artifact.action,
    sourceCount: artifact.sourceCount,
    createdAt: artifact.createdAt,
    tool,
    savedPath: artifact.savedPath,
  }
}

export function appendConversionHistory(
  current: ConversionHistoryEntry[],
  entry: ConversionHistoryEntry,
  limit = conversionHistoryLimit,
) {
  return [entry, ...current.filter((candidate) => candidate.id !== entry.id)].slice(0, limit)
}

export function parseConversionHistory(raw: string | null): ConversionHistoryEntry[] {
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isConversionHistoryEntry).slice(0, conversionHistoryLimit)
  } catch {
    return []
  }
}

export function resetJobForRetry(job: QueueJob): QueueJob {
  return {
    ...job,
    status: 'ready',
    progress: 0,
    message: 'Ready to retry with the selected recipe',
    outputName: undefined,
  }
}

function isConversionHistoryEntry(value: unknown): value is ConversionHistoryEntry {
  if (!value || typeof value !== 'object') return false

  const entry = value as Partial<ConversionHistoryEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.size === 'number' &&
    Number.isFinite(entry.size) &&
    typeof entry.action === 'string' &&
    typeof entry.sourceCount === 'number' &&
    Number.isInteger(entry.sourceCount) &&
    entry.sourceCount > 0 &&
    typeof entry.createdAt === 'string' &&
    typeof entry.tool === 'string' &&
    toolIds.includes(entry.tool as ToolId) &&
    (entry.savedPath === undefined || typeof entry.savedPath === 'string')
  )
}
