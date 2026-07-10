import { describe, expect, it } from 'vitest'
import {
  appendConversionHistory,
  historyEntryFromArtifact,
  parseConversionHistory,
  resetJobForRetry,
  type ConversionHistoryEntry,
  type ExportArtifact,
  type QueueJob,
} from './jobs'

const artifact: ExportArtifact = {
  id: 'artifact-1',
  name: 'scan-searchable.pdf',
  url: 'blob:local',
  size: 2048,
  action: 'OCRmyPDF searchable PDF',
  sourceCount: 1,
  createdAt: '2026-07-10T10:00:00.000Z',
  savedPath: 'D:\\NoMeter\\outputs\\scan-searchable.pdf',
}

describe('conversion history', () => {
  it('stores serializable artifact metadata without the object URL', () => {
    expect(historyEntryFromArtifact(artifact, 'ocr-searchable-pdf')).toEqual({
      id: artifact.id,
      name: artifact.name,
      size: artifact.size,
      action: artifact.action,
      sourceCount: artifact.sourceCount,
      createdAt: artifact.createdAt,
      tool: 'ocr-searchable-pdf',
      savedPath: artifact.savedPath,
    })
  })

  it('keeps newest entries first, removes duplicates, and enforces the limit', () => {
    const first = historyEntryFromArtifact(artifact, 'ocr-searchable-pdf')
    const second: ConversionHistoryEntry = { ...first, id: 'artifact-2', name: 'second.pdf' }

    expect(appendConversionHistory([first], second, 2)).toEqual([second, first])
    expect(appendConversionHistory([first, second], first, 2)).toEqual([first, second])
  })

  it('drops malformed or unknown history records', () => {
    const valid = historyEntryFromArtifact(artifact, 'ocr-searchable-pdf')
    const raw = JSON.stringify([valid, { ...valid, id: 'bad', tool: 'remote-upload' }, null])

    expect(parseConversionHistory(raw)).toEqual([valid])
    expect(parseConversionHistory('{broken')).toEqual([])
  })
})

describe('job retry', () => {
  it('resets a failed job while retaining its local File reference', () => {
    const file = {} as File
    const job: QueueJob = {
      id: 'job-1',
      file,
      name: 'scan.png',
      size: 100,
      type: 'image/png',
      kind: 'image',
      status: 'error',
      progress: 0,
      message: 'OCR failed',
      outputName: 'old.txt',
    }

    expect(resetJobForRetry(job)).toMatchObject({
      file,
      status: 'ready',
      progress: 0,
      message: 'Ready to retry with the selected recipe',
      outputName: undefined,
    })
  })
})
