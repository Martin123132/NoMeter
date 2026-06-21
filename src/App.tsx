import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  Archive,
  AudioWaveform,
  Captions,
  CheckCircle2,
  Download,
  FileText,
  History,
  Image,
  LockKeyhole,
  Play,
  Scissors,
  Settings2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Video,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import {
  convertImageFile,
  fileStem,
  formatBytes,
  imageOutputName,
  mergePdfFiles,
  splitPdfFilesToZip,
  type ImageFormat,
} from './lib/converters'
import {
  convertDocumentFile,
  getNativeCommandPreview,
  getNativeRuntimeStatus,
  nativeEngineCatalog,
  optimizePdfFile,
  transcodeMediaFile,
  type DocumentOutputFormat,
  type NativeRuntimeStatus,
} from './lib/nativeEngines'
import './App.css'

type NavId = 'convert' | 'pdf' | 'documents' | 'images' | 'media' | 'ocr' | 'recipes' | 'history'
type ToolId = 'image-convert' | 'pdf-merge' | 'pdf-split' | 'pdf-optimize' | 'document-convert' | 'native-engine'
type FileKind = 'image' | 'pdf' | 'media' | 'document' | 'archive' | 'unknown'
type JobStatus = 'ready' | 'running' | 'done' | 'blocked' | 'error'
type BannerTone = 'success' | 'warning' | 'danger'

type QueueJob = {
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

type ExportArtifact = {
  id: string
  name: string
  url: string
  size: number
  action: string
  sourceCount: number
  createdAt: string
}

type NavItem = {
  id: NavId
  label: string
  icon: LucideIcon
  tool: ToolId
}

type ToolOption = {
  id: ToolId
  label: string
  detail: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: 'convert', label: 'Convert', icon: Workflow, tool: 'image-convert' },
  { id: 'pdf', label: 'PDF Tools', icon: FileText, tool: 'pdf-merge' },
  { id: 'documents', label: 'Documents', icon: FileText, tool: 'document-convert' },
  { id: 'images', label: 'Images', icon: Image, tool: 'image-convert' },
  { id: 'media', label: 'Audio/Video', icon: Video, tool: 'native-engine' },
  { id: 'ocr', label: 'OCR', icon: Captions, tool: 'native-engine' },
  { id: 'recipes', label: 'Recipes', icon: Settings2, tool: 'image-convert' },
  { id: 'history', label: 'History', icon: History, tool: 'image-convert' },
]

const toolOptions: ToolOption[] = [
  {
    id: 'image-convert',
    label: 'Image batch',
    detail: 'PNG, JPG, WebP',
    icon: Image,
  },
  {
    id: 'pdf-merge',
    label: 'Merge PDFs',
    detail: 'One local PDF',
    icon: FileText,
  },
  {
    id: 'pdf-split',
    label: 'Split PDFs',
    detail: 'ZIP of pages',
    icon: Scissors,
  },
  {
    id: 'pdf-optimize',
    label: 'Optimize PDFs',
    detail: 'Repair, compress, linearize',
    icon: FileText,
  },
  {
    id: 'document-convert',
    label: 'Documents',
    detail: 'MD, HTML, DOCX, EPUB',
    icon: FileText,
  },
  {
    id: 'native-engine',
    label: 'Native pack',
    detail: 'FFmpeg, Pandoc, qpdf',
    icon: Archive,
  },
]

const browserImageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'])

const statusLabels: Record<JobStatus, string> = {
  ready: 'Ready',
  running: 'Running',
  done: 'Done',
  blocked: 'Native',
  error: 'Error',
}

function App() {
  const [activeNav, setActiveNav] = useState<NavId>('convert')
  const [activeTool, setActiveTool] = useState<ToolId>('image-convert')
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [exports, setExports] = useState<ExportArtifact[]>([])
  const [imageFormat, setImageFormat] = useState<ImageFormat>('webp')
  const [documentFormat, setDocumentFormat] = useState<DocumentOutputFormat>('html')
  const [quality, setQuality] = useState(82)
  const [preserveNames, setPreserveNames] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [banner, setBanner] = useState<{ tone: BannerTone; text: string } | null>(null)
  const [nativeStatus, setNativeStatus] = useState<NativeRuntimeStatus>({
    available: false,
    label: 'Checking native bridge',
    detail: 'Inspecting the current runtime.',
  })

  const runnableJobs = useMemo(
    () => jobs.filter((job) => isRunnableForTool(job, activeTool)),
    [activeTool, jobs],
  )

  const queueStats = useMemo(() => {
    const ready = jobs.filter((job) => job.status === 'ready').length
    const done = jobs.filter((job) => job.status === 'done').length
    const blocked = jobs.filter((job) => job.status === 'blocked').length

    return { ready, done, blocked, total: jobs.length }
  }, [jobs])

  useEffect(() => {
    let active = true

    getNativeRuntimeStatus().then((status) => {
      if (active) {
        setNativeStatus(status)
      }
    })

    return () => {
      active = false
    }
  }, [])

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList)

      if (incoming.length === 0) return

      const nextJobs = incoming.map(createJob)
      setJobs((current) => [...nextJobs, ...current])
      setBanner({
        tone: 'success',
        text: `${incoming.length} file${incoming.length === 1 ? '' : 's'} added to the local queue.`,
      })
    },
    [],
  )

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files)
      event.target.value = ''
    }
  }

  const loadSampleFiles = useCallback(async () => {
    const sampleFiles = await createSampleFiles({
      includeDocument: activeTool === 'document-convert',
      includeMedia: activeTool === 'native-engine',
    })
    addFiles(sampleFiles)
  }, [activeTool, addFiles])

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleNavChange = (item: NavItem) => {
    setActiveNav(item.id)
    setActiveTool(item.tool)
  }

  const removeJob = (id: string) => {
    setJobs((current) => current.filter((job) => job.id !== id))
  }

  const clearQueue = () => {
    setJobs([])
    setBanner(null)
  }

  const clearExports = () => {
    exports.forEach((artifact) => URL.revokeObjectURL(artifact.url))
    setExports([])
  }

  const runJobs = async () => {
    if (isRunning) return

    const compatibleJobs = jobs.filter((job) => isRunnableForTool(job, activeTool))

    if (activeTool === 'native-engine' && !nativeStatus.available) {
      setBanner({
        tone: 'warning',
        text: 'The FFmpeg native pack is wired, but this browser preview can only run browser-local jobs.',
      })
      return
    }

    if (activeTool === 'document-convert' && !nativeStatus.available) {
      setBanner({
        tone: 'warning',
        text: 'The Pandoc document engine is wired, but this browser preview can only run browser-local jobs.',
      })
      return
    }

    if (activeTool === 'pdf-optimize' && !nativeStatus.available) {
      setBanner({
        tone: 'warning',
        text: 'The qpdf optimizer is wired, but this browser preview can only run browser-local PDF jobs.',
      })
      return
    }

    if (compatibleJobs.length === 0) {
      setBanner({
        tone: 'warning',
        text:
          activeTool === 'image-convert'
            ? 'Add PNG, JPG, WebP, GIF, BMP, or SVG files before running image conversion.'
            : activeTool === 'native-engine'
              ? 'Add one or more audio or video files before running FFmpeg conversion.'
              : activeTool === 'document-convert'
                ? 'Add Markdown, HTML, DOCX, ODT, RTF, or text files before running Pandoc conversion.'
                : activeTool === 'pdf-optimize'
                  ? 'Add one or more PDF files before running qpdf optimization.'
                  : 'Add one or more PDF files before running this PDF job.',
      })
      return
    }

    setIsRunning(true)
    setBanner(null)

    try {
      if (activeTool === 'image-convert') {
        await runImageJobs(compatibleJobs)
      }

      if (activeTool === 'pdf-merge') {
        await runPdfMerge(compatibleJobs)
      }

      if (activeTool === 'pdf-split') {
        await runPdfSplit(compatibleJobs)
      }

      if (activeTool === 'pdf-optimize') {
        await runPdfOptimize(compatibleJobs)
      }

      if (activeTool === 'native-engine') {
        await runNativeMediaJobs(compatibleJobs)
      }

      if (activeTool === 'document-convert') {
        await runDocumentJobs(compatibleJobs)
      }
    } finally {
      setIsRunning(false)
    }
  }

  const runImageJobs = async (compatibleJobs: QueueJob[]) => {
    let completed = 0

    for (const job of compatibleJobs) {
      updateJob(job.id, {
        status: 'running',
        progress: 28,
        message: `Encoding ${imageFormat.toUpperCase()} locally`,
      })

      try {
        const blob = await convertImageFile(job.file, imageFormat, quality)
        const name = preserveNames
          ? imageOutputName(job.name, imageFormat)
          : imageOutputName(`openforge-image-${completed + 1}`, imageFormat)
        const artifact = createArtifact(blob, name, 'Image batch', 1)
        setExports((current) => [artifact, ...current])
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: `${formatBytes(blob.size)} export ready`,
          outputName: name,
        })
        completed += 1
      } catch (error) {
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Image conversion failed.',
        })
      }
    }

    setBanner({
      tone: completed > 0 ? 'success' : 'danger',
      text:
        completed > 0
          ? `${completed} image${completed === 1 ? '' : 's'} converted locally.`
          : 'No image exports were created.',
    })
  }

  const runPdfMerge = async (compatibleJobs: QueueJob[]) => {
    compatibleJobs.forEach((job) =>
      updateJob(job.id, {
        status: 'running',
        progress: 45,
        message: 'Copying pages into one PDF',
      }),
    )

    try {
      const blob = await mergePdfFiles(compatibleJobs.map((job) => job.file))
      const artifact = createArtifact(blob, 'openforge-merged.pdf', 'PDF merge', compatibleJobs.length)
      setExports((current) => [artifact, ...current])
      compatibleJobs.forEach((job) =>
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: 'Merged into openforge-merged.pdf',
          outputName: 'openforge-merged.pdf',
        }),
      )
      setBanner({
        tone: 'success',
        text: `${compatibleJobs.length} PDF${compatibleJobs.length === 1 ? '' : 's'} merged locally.`,
      })
    } catch (error) {
      compatibleJobs.forEach((job) =>
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'PDF merge failed.',
        }),
      )
      setBanner({ tone: 'danger', text: 'PDF merge failed. The source may be encrypted or malformed.' })
    }
  }

  const runPdfSplit = async (compatibleJobs: QueueJob[]) => {
    compatibleJobs.forEach((job) =>
      updateJob(job.id, {
        status: 'running',
        progress: 52,
        message: 'Splitting pages into ZIP',
      }),
    )

    try {
      const blob = await splitPdfFilesToZip(compatibleJobs.map((job) => job.file))
      const name =
        preserveNames && compatibleJobs.length === 1
          ? `${fileStem(compatibleJobs[0].name)}-pages.zip`
          : 'openforge-split-pages.zip'
      const artifact = createArtifact(blob, name, 'PDF split', compatibleJobs.length)
      setExports((current) => [artifact, ...current])
      compatibleJobs.forEach((job) =>
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: `Pages packed into ${name}`,
          outputName: name,
        }),
      )
      setBanner({
        tone: 'success',
        text: `${compatibleJobs.length} PDF${compatibleJobs.length === 1 ? '' : 's'} split into a ZIP archive.`,
      })
    } catch (error) {
      compatibleJobs.forEach((job) =>
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'PDF split failed.',
        }),
      )
      setBanner({ tone: 'danger', text: 'PDF split failed. The source may be encrypted or malformed.' })
    }
  }

  const runPdfOptimize = async (compatibleJobs: QueueJob[]) => {
    let completed = 0

    for (const job of compatibleJobs) {
      updateJob(job.id, {
        status: 'running',
        progress: 38,
        message: 'Repairing and linearizing with qpdf',
      })

      try {
        const result = await optimizePdfFile(job.file)
        const artifact = createArtifact(result.blob, result.name, 'qpdf optimize', 1)
        setExports((current) => [artifact, ...current])
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: `${formatBytes(result.blob.size)} optimized PDF ready`,
          outputName: result.name,
        })
        completed += 1
      } catch (error) {
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'qpdf optimization failed.',
        })
      }
    }

    setBanner({
      tone: completed > 0 ? 'success' : 'danger',
      text:
        completed > 0
          ? `${completed} PDF${completed === 1 ? '' : 's'} optimized with qpdf.`
          : 'No qpdf exports were created.',
    })
  }

  const runNativeMediaJobs = async (compatibleJobs: QueueJob[]) => {
    let completed = 0

    for (const job of compatibleJobs) {
      updateJob(job.id, {
        status: 'running',
        progress: 24,
        message: 'Handing media to FFmpeg sidecar',
      })

      try {
        const result = await transcodeMediaFile(job.file)
        const artifact = createArtifact(result.blob, result.name, 'FFmpeg transcode', 1)
        setExports((current) => [artifact, ...current])
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: `${formatBytes(result.blob.size)} MP4 export ready`,
          outputName: result.name,
        })
        completed += 1
      } catch (error) {
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'FFmpeg conversion failed.',
        })
      }
    }

    setBanner({
      tone: completed > 0 ? 'success' : 'danger',
      text:
        completed > 0
          ? `${completed} media file${completed === 1 ? '' : 's'} converted with FFmpeg.`
          : 'No FFmpeg exports were created.',
    })
  }

  const runDocumentJobs = async (compatibleJobs: QueueJob[]) => {
    let completed = 0

    for (const job of compatibleJobs) {
      updateJob(job.id, {
        status: 'running',
        progress: 22,
        message: `Handing document to Pandoc for ${documentFormat.toUpperCase()}`,
      })

      try {
        const result = await convertDocumentFile(job.file, documentFormat)
        const artifact = createArtifact(result.blob, result.name, 'Pandoc conversion', 1)
        setExports((current) => [artifact, ...current])
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: `${formatBytes(result.blob.size)} document export ready`,
          outputName: result.name,
        })
        completed += 1
      } catch (error) {
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Pandoc conversion failed.',
        })
      }
    }

    setBanner({
      tone: completed > 0 ? 'success' : 'danger',
      text:
        completed > 0
          ? `${completed} document${completed === 1 ? '' : 's'} converted with Pandoc.`
          : 'No Pandoc exports were created.',
    })
  }

  const updateJob = (id: string, patch: Partial<QueueJob>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="OpenForge sections">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Archive size={22} />
          </div>
          <div>
            <strong>OpenForge</strong>
            <span>local file works</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.id}
                className={activeNav === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => handleNavChange(item)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="privacy-panel">
          <ShieldCheck size={18} />
          <div>
            <span>Local-first</span>
            <strong>No account, no credits</strong>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{navItems.find((item) => item.id === activeNav)?.label ?? 'Convert'}</h1>
            <p>{toolOptions.find((tool) => tool.id === activeTool)?.detail}</p>
          </div>
          <div className="topbar-actions">
            <span className="local-pill">
              <LockKeyhole size={15} />
              Files stay in this browser
            </span>
            <button type="button" className="ghost-button" onClick={clearQueue} disabled={jobs.length === 0}>
              <Trash2 size={16} />
              Clear
            </button>
          </div>
        </header>

        {banner ? <div className={`banner ${banner.tone}`}>{banner.text}</div> : null}

        <div className="workbench-grid">
          <div className="primary-column">
            <section
              className={isDragging ? 'drop-zone dragging' : 'drop-zone'}
              onDrop={handleDrop}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={handleDragOver}
            >
              <div className="drop-icon" aria-hidden="true">
                <UploadCloud size={28} />
              </div>
              <div>
                <h2>Drop files into the forge</h2>
                <p>
                  Images and PDFs run in the browser; qpdf, Pandoc, and FFmpeg power desktop-only jobs.
                </p>
              </div>
              <div className="drop-actions">
                <label className="file-picker">
                  <UploadCloud size={17} />
                  Add files
                  <input
                    type="file"
                    multiple
                    onChange={handleFileInput}
                    accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml,application/pdf,video/*,audio/*,.doc,.docx,.odt,.rtf,.md,.markdown,.html,.htm,.txt,.epub,.zip,.7z"
                  />
                </label>
                <button type="button" className="sample-button" onClick={loadSampleFiles}>
                  Samples
                </button>
              </div>
            </section>

            <section className="stats-row" aria-label="Queue status">
              <Metric label="Queued" value={queueStats.total} />
              <Metric label="Ready" value={queueStats.ready} />
              <Metric label="Done" value={queueStats.done} />
              <Metric label="Native" value={queueStats.blocked} />
            </section>

            <section className="queue-panel">
              <div className="section-header">
                <div>
                  <h2>Job queue</h2>
                  <p>{runnableJobs.length} compatible with the selected recipe</p>
                </div>
                <button
                  type="button"
                  className="run-button"
                  onClick={runJobs}
                  disabled={isRunning || jobs.length === 0}
                >
                  <Play size={17} fill="currentColor" />
                  Run
                </button>
              </div>

              <div className="queue-table-wrap">
                <table className="queue-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Kind</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>Output</th>
                      <th aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="empty-row">No files queued yet.</div>
                        </td>
                      </tr>
                    ) : (
                      jobs.map((job) => <QueueRow key={job.id} job={job} onRemove={removeJob} />)
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="exports-panel">
              <div className="section-header">
                <div>
                  <h2>Exports</h2>
                  <p>{exports.length === 0 ? 'Finished files appear here' : `${exports.length} files ready`}</p>
                </div>
                <button type="button" className="ghost-button" onClick={clearExports} disabled={exports.length === 0}>
                  <Trash2 size={16} />
                  Clear
                </button>
              </div>

              <div className="exports-list">
                {exports.length === 0 ? (
                  <div className="empty-export">
                    <Download size={18} />
                    <span>No exports yet</span>
                  </div>
                ) : (
                  exports.map((artifact) => (
                    <a
                      className="export-row"
                      key={artifact.id}
                      href={artifact.url}
                      download={artifact.name}
                    >
                      <div>
                        <strong>{artifact.name}</strong>
                        <span>
                          {artifact.action} - {artifact.sourceCount} source
                          {artifact.sourceCount === 1 ? '' : 's'} - {formatBytes(artifact.size)}
                        </span>
                      </div>
                      <Download size={18} />
                    </a>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="options-panel" aria-label="Conversion options">
            <section className="option-section">
              <h2>Recipe</h2>
              <div className="tool-list">
                {toolOptions.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <button
                      type="button"
                      key={tool.id}
                      className={activeTool === tool.id ? 'tool-button active' : 'tool-button'}
                      onClick={() => setActiveTool(tool.id)}
                    >
                      <Icon size={18} />
                      <span>
                        <strong>{tool.label}</strong>
                        <small>{tool.detail}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="option-section">
              <h2>Output</h2>
              {activeTool === 'image-convert' ? (
                <>
                  <div className="segmented-control" aria-label="Image output format">
                    {(['webp', 'png', 'jpeg'] as ImageFormat[]).map((format) => (
                      <button
                        type="button"
                        key={format}
                        className={imageFormat === format ? 'active' : ''}
                        onClick={() => setImageFormat(format)}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <label className="range-control">
                    <span>Quality</span>
                    <strong>{quality}%</strong>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={quality}
                      onChange={(event) => setQuality(Number(event.target.value))}
                    />
                  </label>
                </>
              ) : activeTool === 'document-convert' ? (
                <div className="segmented-control" aria-label="Document output format">
                  {(['html', 'docx', 'markdown', 'epub'] as DocumentOutputFormat[]).map((format) => (
                    <button
                      type="button"
                      key={format}
                      className={documentFormat === format ? 'active' : ''}
                      onClick={() => setDocumentFormat(format)}
                    >
                      {format === 'markdown' ? 'MD' : format.toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : activeTool === 'native-engine' ? (
                <div className="pdf-output">
                  <AudioWaveform size={18} />
                  <span>MP4 H.264</span>
                </div>
              ) : activeTool === 'pdf-optimize' ? (
                <div className="pdf-output">
                  <CheckCircle2 size={18} />
                  <span>Optimized PDF</span>
                </div>
              ) : (
                <div className="pdf-output">
                  <CheckCircle2 size={18} />
                  <span>{activeTool === 'pdf-split' ? 'ZIP archive' : 'Single PDF'}</span>
                </div>
              )}

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={preserveNames}
                  onChange={(event) => setPreserveNames(event.target.checked)}
                />
                <span>Preserve base names</span>
              </label>
            </section>

            <section className="option-section">
              <h2>Native pack</h2>
              <div className={nativeStatus.available ? 'native-status ready' : 'native-status'}>
                <strong>{nativeStatus.label}</strong>
                <span>{nativeStatus.detail}</span>
              </div>
              <div className="engine-list">
                {nativeEngineCatalog.map((engine) => (
                  <div className="engine-row" key={engine.id}>
                    <AudioWaveform size={16} />
                    <span>
                      <strong>{engine.name}</strong>
                      <small>{engine.role}</small>
                      <code>{getNativeCommandPreview(engine)}</code>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function QueueRow({ job, onRemove }: { job: QueueJob; onRemove: (id: string) => void }) {
  return (
    <tr>
      <td>
        <div className="file-cell">
          <span className="file-icon">
            <KindIcon kind={job.kind} />
          </span>
          <div>
            <strong>{job.name}</strong>
            <span>{job.type || 'unknown type'}</span>
          </div>
        </div>
      </td>
      <td className="caps">{job.kind}</td>
      <td>{formatBytes(job.size)}</td>
      <td>
        <span className={`status-badge ${job.status}`}>
          {job.status === 'running' ? <span className="spinner" aria-hidden="true" /> : statusIcon(job.status)}
          {statusLabels[job.status]}
        </span>
      </td>
      <td>
        <div className="output-cell">
          <span>{job.outputName ?? job.message}</span>
          {job.status === 'running' ? <progress max="100" value={job.progress} /> : null}
        </div>
      </td>
      <td>
        <button type="button" className="icon-button" onClick={() => onRemove(job.id)} aria-label={`Remove ${job.name}`}>
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  )
}

function KindIcon({ kind }: { kind: FileKind }) {
  if (kind === 'image') return <Image size={17} />
  if (kind === 'media') return <Video size={17} />
  if (kind === 'archive') return <Archive size={17} />
  return <FileText size={17} />
}

function createJob(file: File): QueueJob {
  const kind = classifyFile(file)
  const browserReady = isBrowserReady(file, kind)

  return {
    id: createId(),
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    kind,
    status: browserReady ? 'ready' : 'blocked',
    progress: browserReady ? 0 : 100,
    message: browserReady ? 'Ready for browser-local processing' : 'Needs the native engine pack',
  }
}

async function createSampleFiles(options: { includeDocument?: boolean; includeMedia?: boolean } = {}) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">',
    '<rect width="960" height="540" rx="28" fill="#ecfbf4"/>',
    '<rect x="72" y="72" width="816" height="396" rx="22" fill="#17211c"/>',
    '<path d="M146 157h668v72H146zM204 274h552v111H204z" fill="#ffffff"/>',
    '<path d="M204 274h552v42H204z" fill="#1b8f61"/>',
    '<text x="146" y="118" fill="#17211c" font-family="Arial, sans-serif" font-size="34" font-weight="700">OpenForge sample image</text>',
    '</svg>',
  ].join('')
  const image = new File([new Blob([svg], { type: 'image/svg+xml' })], 'openforge-sample.svg', {
    type: 'image/svg+xml',
  })

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('OpenForge sample PDF', {
    x: 72,
    y: 742,
    size: 28,
    font: headingFont,
    color: rgb(0.09, 0.13, 0.11),
  })
  page.drawText('Generated locally for conversion testing.', {
    x: 72,
    y: 704,
    size: 14,
    font: bodyFont,
    color: rgb(0.32, 0.4, 0.36),
  })
  page.drawRectangle({ x: 72, y: 590, width: 451, height: 76, color: rgb(0.93, 0.98, 0.95) })
  page.drawText('No upload. No watermark. No subscription.', {
    x: 92,
    y: 620,
    size: 16,
    font: headingFont,
    color: rgb(0.11, 0.56, 0.38),
  })
  const bytes = await pdf.save({ useObjectStreams: true })
  const pdfFile = new File([bytes.slice().buffer as ArrayBuffer], 'openforge-sample.pdf', {
    type: 'application/pdf',
  })

  const files = [image, pdfFile]

  if (options.includeDocument) {
    files.unshift(createSampleMarkdownFile())
  }

  if (options.includeMedia) {
    files.unshift(createSampleAudioFile())
  }

  return files
}

function createSampleMarkdownFile() {
  const markdown = [
    '# OpenForge sample document',
    '',
    'This document is generated locally for Pandoc conversion testing.',
    '',
    '## Promise',
    '',
    '- No upload',
    '- No watermark',
    '- No subscription',
    '',
    '| Engine | Status |',
    '|---|---|',
    '| Pandoc | Wired |',
    '| FFmpeg | Wired |',
    '',
  ].join('\n')

  return new File([markdown], 'openforge-sample.md', { type: 'text/markdown' })
}

function createSampleAudioFile() {
  const sampleRate = 22_050
  const durationSeconds = 1
  const sampleCount = sampleRate * durationSeconds
  const buffer = new ArrayBuffer(44 + sampleCount * 2)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + sampleCount * 2, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, sampleCount * 2, true)

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((index / sampleRate) * 440 * Math.PI * 2)
    view.setInt16(44 + index * 2, sample * 0x3fff, true)
  }

  return new File([buffer], 'openforge-tone.wav', { type: 'audio/wav' })
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function classifyFile(file: File): FileKind {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (file.type.startsWith('image/') || browserImageExtensions.has(extension)) return 'image'
  if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return 'media'
  if (['doc', 'docx', 'odt', 'rtf', 'md', 'markdown', 'txt', 'html', 'htm', 'epub'].includes(extension)) {
    return 'document'
  }
  if (['zip', '7z', 'tar', 'gz', 'rar'].includes(extension)) return 'archive'

  return 'unknown'
}

function isBrowserReady(file: File, kind: FileKind) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (kind === 'pdf') return true
  if (kind === 'image') return browserImageExtensions.has(extension)
  return false
}

function isRunnableForTool(job: QueueJob, tool: ToolId) {
  if (job.status === 'running') return false
  if (tool === 'native-engine') return job.kind === 'media'
  if (tool === 'document-convert') return job.kind === 'document'
  if (tool === 'pdf-optimize') return job.kind === 'pdf'
  if (job.status === 'blocked') return false
  if (tool === 'image-convert') return job.kind === 'image'
  if (tool === 'pdf-merge' || tool === 'pdf-split') return job.kind === 'pdf'
  return false
}

function createArtifact(blob: Blob, name: string, action: string, sourceCount: number): ExportArtifact {
  return {
    id: createId(),
    name,
    url: URL.createObjectURL(blob),
    size: blob.size,
    action,
    sourceCount,
    createdAt: new Date().toISOString(),
  }
}

function statusIcon(status: JobStatus) {
  if (status === 'done') return <CheckCircle2 size={14} />
  if (status === 'error') return <XCircle size={14} />
  if (status === 'blocked') return <Archive size={14} />
  return <CheckCircle2 size={14} />
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export default App
