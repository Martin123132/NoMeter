import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  Archive,
  AudioWaveform,
  Captions,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  FolderOutput,
  HardDrive,
  History,
  Image,
  LockKeyhole,
  Play,
  RotateCcw,
  Scissors,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import {
  archiveOutputName,
  convertImageFile,
  fileStem,
  formatBytes,
  imageOutputName,
  mergePdfFiles,
  splitPdfFilesToZip,
  zipFiles,
  type ImageFormat,
} from './lib/converters'
import {
  convertDocumentFile,
  getNativeCommandPreview,
  getNativeRuntimeStatus,
  nativeEngineCatalog,
  optimizePdfFile,
  pickNativeFolder,
  transcodeMediaFile,
  type DocumentOutputFormat,
  type NativeFolders,
  type NativeRuntimeStatus,
  type NativeTranscodeResult,
} from './lib/nativeEngines'
import './App.css'

type NavId = 'convert' | 'pdf' | 'documents' | 'images' | 'archive' | 'media' | 'ocr' | 'recipes' | 'history'
type ToolId =
  | 'image-convert'
  | 'archive-zip'
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-optimize'
  | 'document-convert'
  | 'native-engine'
type FileKind = 'image' | 'pdf' | 'media' | 'document' | 'archive' | 'unknown'
type JobStatus = 'ready' | 'running' | 'done' | 'blocked' | 'error'
type BannerTone = 'success' | 'warning' | 'danger'
type GuidanceMode = 'guided' | 'explorer'
type AtlasTone = 'focus' | 'active' | 'idle' | 'warning' | 'done'
type MissionRailState = 'active' | 'done' | 'warning' | 'locked'

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

type AtlasNode = {
  id: string
  title: string
  detail: string
  tone: AtlasTone
  icon: LucideIcon
  cta: string
  action: () => void
  badge?: string
}

type MissionRailStep = {
  id: string
  label: string
  detail: string
  tone: MissionRailState
  icon: LucideIcon
  cta: string
  action: () => void
  disabled?: boolean
}

type MissionWaypoint = {
  title: string
  hint: string
  ctaLabel: string
  ctaAction: () => void
  tone: 'success' | 'info' | 'warning'
  disabled?: boolean
}

type ExportArtifact = {
  id: string
  name: string
  url: string
  size: number
  action: string
  sourceCount: number
  createdAt: string
  savedPath?: string
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
  { id: 'archive', label: 'Archive', icon: Archive, tool: 'archive-zip' },
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
    id: 'archive-zip',
    label: 'Make ZIP',
    detail: 'Bundle any files',
    icon: Archive,
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

const quickStartHints: Record<ToolId, { source: string; output: string; focus: string }> = {
  'image-convert': {
    source: 'PNG/JPG/WebP/etc.',
    output: 'Image formats like WebP, PNG, JPEG',
    focus: 'Drop files, choose quality/format, then Run.',
  },
  'archive-zip': {
    source: 'Any local files',
    output: 'Compressed ZIP archive',
    focus: 'Bundle mixed files into one browser-local ZIP without uploading.',
  },
  'pdf-merge': {
    source: 'Two or more PDFs',
    output: 'A single combined PDF',
    focus: 'Add PDFs, run merge, then download the merged file.',
  },
  'pdf-split': {
    source: 'One PDF',
    output: 'A ZIP of numbered pages',
    focus: 'Add one PDF and run split to inspect each page package.',
  },
  'pdf-optimize': {
    source: 'PDFs that need repair or compression',
    output: 'Optimized PDF',
    focus: 'Use the native qpdf path in desktop mode for reliable results.',
  },
  'document-convert': {
    source: 'Markdown, HTML, DOCX, ODT, RTF, or text',
    output: 'HTML, DOCX, Markdown, EPUB',
    focus: 'Drop a document, choose format, then Run with Pandoc.',
  },
  'native-engine': {
    source: 'Audio or video files',
    output: 'MP4 H.264',
    focus: 'Set your save folder (D: preferred), then run FFmpeg transcode.',
  },
}

const missionStateCopy = {
  source: 'Load source files',
  options: 'Choose recipe + options',
  run: 'Run conversion',
  export: 'Collect exports',
}

const defaultNativeFolders: NativeFolders = {
  workDir: 'D:\\Codex\\OpenForge\\work',
  outputDir: 'D:\\Codex\\OpenForge\\outputs\\converted',
}

const nativeFolderStorageKey = 'nometer.nativeFolders.v1'
const quickStartStorageKey = 'nometer.quickStart.v1'
const guidanceModeStorageKey = 'nometer.guidanceMode.v1'
const firstRunGuideStorageKey = 'nometer.firstRunGuide.v1'
const guidedRouteNudgeStorageKey = 'nometer.guidedRouteNudge.v1'

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
  const [nativeFolders, setNativeFolders] = useState<NativeFolders>(loadNativeFolders)
  const [quality, setQuality] = useState(82)
  const [preserveNames, setPreserveNames] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [banner, setBanner] = useState<{ tone: BannerTone; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sourceSectionRef = useRef<HTMLDivElement>(null)
  const optionsSectionRef = useRef<HTMLDivElement>(null)
  const exportsSectionRef = useRef<HTMLDivElement>(null)
  const missionRailSectionRef = useRef<HTMLDivElement>(null)
  const guidanceModeTransitionRef = useRef<GuidanceMode>('guided')
  const runJobsRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const [showQuickStart, setShowQuickStart] = useState(() => {
    try {
      return localStorage.getItem(quickStartStorageKey) !== '1'
    } catch {
      return true
    }
  })
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(() => {
    try {
      return localStorage.getItem(firstRunGuideStorageKey) !== '1'
    } catch {
      return true
    }
  })
  const [guidanceMode, setGuidanceMode] = useState<GuidanceMode>(() => {
    try {
      const savedMode = localStorage.getItem(guidanceModeStorageKey)
      return savedMode === 'guided' || savedMode === 'explorer' ? savedMode : 'guided'
    } catch {
      return 'guided'
    }
  })
  const [nativeStatus, setNativeStatus] = useState<NativeRuntimeStatus>({
    available: false,
    label: 'Checking native bridge',
    detail: 'Inspecting the current runtime.',
  })
  const [showShortcutHints, setShowShortcutHints] = useState(false)
  const [showGuidancePulse, setShowGuidancePulse] = useState(false)
  const [demoMissionActive, setDemoMissionActive] = useState(false)
  const [showGuidedRouteNudge, setShowGuidedRouteNudge] = useState(() => {
    try {
      return localStorage.getItem(guidedRouteNudgeStorageKey) !== '1'
    } catch {
      return true
    }
  })

  const setGuidanceModePreserve = useCallback((nextMode: GuidanceMode) => {
    setGuidanceMode((previousMode) => (previousMode === nextMode ? previousMode : nextMode))
  }, [])

  const compatibleJobs = useMemo(() => jobs.filter((job) => isCompatibleForTool(job, activeTool)), [jobs, activeTool])
  const runnableJobs = useMemo(
    () => compatibleJobs.filter((job) => isRunnableForTool(job, activeTool)),
    [activeTool, compatibleJobs],
  )

  const queueStats = useMemo(() => {
    const ready = jobs.filter((job) => job.status === 'ready').length
    const done = jobs.filter((job) => job.status === 'done').length
    const blocked = jobs.filter((job) => job.status === 'blocked').length

    return { ready, done, blocked, total: jobs.length }
  }, [jobs])

  const nativeFolderIssue = useMemo(() => validateNativeFolders(nativeFolders), [nativeFolders])
  const quickStartHint = quickStartHints[activeTool]
  const shouldShowQuickStart = showQuickStart && jobs.length === 0 && exports.length === 0
  const isGuidedMode = guidanceMode === 'guided'
  const missionCanRun = runnableJobs.length > 0
  const missionCompletedCount = jobs.filter((job) => job.status === 'done').length
  const missionHasExports = exports.length > 0
  const missionHasBlocked = jobs.some((job) => job.status === 'blocked' && !isRunnableForTool(job, activeTool))
  const missionHasErrors = jobs.some((job) => job.status === 'error')
  const missionErrorCount = jobs.filter((job) => job.status === 'error').length
  const missionHasReadyJobs = jobs.some((job) => job.status === 'ready')
  const missionHasRunningJobs = jobs.some((job) => job.status === 'running')
  const missionRoundCompleted = jobs.length > 0 && !missionHasReadyJobs && !missionHasRunningJobs
  const missionNativeUnavailable =
    (activeTool === 'native-engine' || activeTool === 'document-convert' || activeTool === 'pdf-optimize') &&
    !nativeStatus.available
  const missionFolderWarning = requiresDesktopTool(activeTool) ? nativeFolderIssue : null

  const missionNotice = missionHasBlocked
    ? 'Some queued files need a native path in desktop mode for this tool.'
    : missionNativeUnavailable
      ? 'Enable the desktop bridge or switch to a browser-ready recipe first.'
      : missionFolderWarning
        ? nativeFolderIssue
        : null

  const missionHasPendingCompatible = runnableJobs.length > 0
  const latestExport = exports[0]
  const missionCanReviewExport = missionHasExports && latestExport !== undefined
  const canRunMission = missionHasPendingCompatible && !isRunning && !missionNativeUnavailable && !missionFolderWarning && !missionHasBlocked
  const missionProgress = [jobs.length > 0, compatibleJobs.length > 0, missionCompletedCount > 0, missionHasExports].filter(Boolean).length

  const jumpToSource = useCallback(() => {
    sourceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const jumpToOptions = useCallback(() => {
    optionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const jumpToExports = useCallback(() => {
    exportsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const suggestedTool = useMemo(() => inferMissionTool(jobs), [jobs])
  const suggestedToolLabel = suggestedTool ? toolOptions.find((tool) => tool.id === suggestedTool)?.label : null

  const applySuggestedTool = useCallback(
    (toolId: ToolId) => {
      setActiveTool(toolId)
      setBanner({
        tone: 'success',
        text: `Switched to ${toolOptions.find((tool) => tool.id === toolId)?.label ?? 'the matching recipe'} for queued files.`,
      })
      jumpToOptions()
    },
    [jumpToOptions],
  )

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const chooseNativeFolder = useCallback(
    async (field: keyof NativeFolders) => {
      if (!nativeStatus.available) {
        setBanner({
          tone: 'warning',
          text: 'Folder picker is available in the NoMeter desktop app. You can still type an absolute D: path here.',
        })
        return
      }

      try {
        const selected = await pickNativeFolder(nativeFolders[field])
        if (!selected) return

        setNativeFolders((current) => ({ ...current, [field]: selected }))
        setBanner({
          tone: 'success',
          text: `${field === 'workDir' ? 'Work' : 'Save'} folder updated.`,
        })
      } catch (error) {
        setBanner({
          tone: 'danger',
          text: error instanceof Error ? error.message : 'Could not open the folder picker.',
        })
      }
    },
    [nativeFolders, nativeStatus.available],
  )

  const shouldFollowSuggestedTool =
    suggestedTool !== null &&
    suggestedTool !== activeTool &&
    !missionHasBlocked &&
    !missionNativeUnavailable &&
    !missionFolderWarning &&
    !isRunning
  const canAutoRun = canRunMission || shouldFollowSuggestedTool || missionCanReviewExport
  const canAutoRunOrSwitch = jobs.length > 0 && canAutoRun
  const runOrFollowAction = canRunMission
    ? runJobs
    : shouldFollowSuggestedTool && suggestedTool
      ? () => applySuggestedTool(suggestedTool)
      : missionCanReviewExport
        ? openLatestExport
      : jobs.length > 0
        ? jumpToSource
        : openFilePicker
  const runActionLabel = canRunMission
    ? 'Run conversion'
    : shouldFollowSuggestedTool && suggestedToolLabel
      ? `Switch to ${suggestedToolLabel}`
      : missionCanReviewExport
        ? 'Open latest export'
        : missionNotice
          ? 'Fix requirements'
          : missionCanRun
            ? 'Review native readiness'
            : 'Fix source/recipe'

  const runButtonLabel = jobs.length === 0 ? 'Add files' : runActionLabel

  const clearQueue = useCallback(() => {
    setJobs([])
    setDemoMissionActive(false)
    setBanner(null)
  }, [])

  function openLatestExport() {
    if (!latestExport) return

    if (typeof window !== 'undefined' && latestExport.url) {
      window.open(latestExport.url, '_blank', 'noopener,noreferrer')
    }
  }

  const missionActionHint = !canRunMission
    ? missionCanReviewExport
      ? null
      : missionHasBlocked
      ? 'Resolve blocked items with a native desktop recipe.'
      : missionNativeUnavailable
        ? 'Enable native runtime to continue with this recipe.'
        : missionFolderWarning
          ? missionFolderWarning
          : jobs.length > 0
            ? missionCanRun
              ? 'Run conversion is blocked. Wait or check queue state.'
              : suggestedToolLabel
                ? `Try ${suggestedToolLabel} to match this file mix.`
                : 'This queue has files that do not match the selected recipe.'
      : null
    : null
  const runNodeDetail =
    jobs.length === 0
      ? 'Add files or samples'
      : missionNotice
        ? missionNotice
        : missionHasBlocked
          ? 'Native-only files in queue'
          : missionCanReviewExport
            ? `${exports.length} export${exports.length === 1 ? '' : 's'} ready`
          : missionCanRun
            ? missionHasRunningJobs
              ? 'Conversion is running'
              : 'Ready to run'
            : 'Recipe mismatch'

  const missionProgressPercent = Math.round((missionProgress / 4) * 100)
  const missionObjectiveLabel = `Mission progress ${missionProgress}/4`

  const worldAtlasNodes: AtlasNode[] = (() => {
    const activeToolLabel = toolOptions.find((tool) => tool.id === activeTool)?.label ?? 'Recipe'
    const sourceNodeDetail = jobs.length > 0 ? `${jobs.length} file${jobs.length === 1 ? '' : 's'} in queue` : 'No files yet'
    const sourceTone: AtlasTone = jobs.length > 0 ? 'done' : 'focus'
    const optionsTone: AtlasTone = jobs.length > 0 ? 'active' : 'idle'
    const routeTone: AtlasTone = missionCanReviewExport ? 'done' : canRunMission ? 'focus' : jobs.length > 0 ? 'warning' : 'idle'
    const exportTone: AtlasTone = missionHasExports ? 'done' : missionCompletedCount > 0 ? 'active' : 'idle'
    const routeCta = runActionLabel
    const routeAction = runOrFollowAction

    return [
      {
        id: 'source',
        title: 'Source dock',
        detail: sourceNodeDetail,
        tone: sourceTone,
        icon: UploadCloud,
        cta: jobs.length > 0 ? 'Open queue' : 'Add files',
        action: jobs.length > 0 ? jumpToSource : openFilePicker,
      },
      {
        id: 'recipe',
        title: 'Recipe deck',
        detail: `Current recipe: ${activeToolLabel}`,
        tone: optionsTone,
        icon: Settings2,
        cta: compatibleJobs.length > 0 ? 'Tweak options' : 'Switch recipe',
        action: jumpToOptions,
      },
      {
        id: 'route',
        title: 'Conversion runway',
        detail: runNodeDetail,
        tone: routeTone,
        icon: Play,
        cta: routeCta,
        action: routeAction,
        badge: !canRunMission && jobs.length > 0 && !missionCanReviewExport ? 'Blocked' : undefined,
      },
      {
        id: 'exports',
        title: 'Exports bay',
        detail: missionHasExports
          ? `${exports.length} artifact${exports.length === 1 ? '' : 's'} ready`
          : missionCompletedCount > 0
            ? 'Review successful outputs'
            : 'Run conversion',
        tone: exportTone,
        icon: Download,
        cta: missionHasExports ? 'Open latest' : 'Collect outputs',
        action: missionHasExports && latestExport ? openLatestExport : jumpToExports,
      },
    ]
  })()

  const missionRailSteps: MissionRailStep[] = (() => {
    const activeToolLabel = toolOptions.find((tool) => tool.id === activeTool)?.label ?? 'Recipe'

    const sourceDetail = jobs.length > 0 ? `${jobs.length} file${jobs.length === 1 ? '' : 's'} in queue` : 'No files yet'
    const sourceTone: MissionRailState = jobs.length > 0 ? 'done' : 'active'
    const sourceCta = jobs.length > 0 ? 'Go to source' : 'Add source now'
    const recipeDetail =
      jobs.length > 0 ? `Current recipe: ${activeToolLabel}` : 'Choose recipe after adding source'
    const recipeTone: MissionRailState =
      jobs.length === 0 ? 'locked' : missionHasErrors || missionHasBlocked || missionFolderWarning || missionNativeUnavailable ? 'warning' : 'done'
    const recipeCta = jobs.length > 0
      ? suggestedToolLabel && missionHasErrors === false && missionHasBlocked === false && !missionFolderWarning && !missionNativeUnavailable
        ? `Try ${suggestedToolLabel}`
        : 'Tune recipe'
      : 'Add source to unlock'
    const runTone: MissionRailState = missionCompletedCount > 0
      ? 'done'
      : canRunMission
      ? missionHasRunningJobs
        ? 'done'
        : 'active'
      : jobs.length > 0
        ? missionNotice
          ? 'warning'
          : 'locked'
        : 'locked'
    const runCta = missionCompletedCount > 0 ? (missionCanReviewExport ? 'Open latest' : 'Run complete') : canRunMission ? 'Run mission' : runActionLabel
    const exportTone: MissionRailState = missionHasExports
      ? 'done'
      : missionCompletedCount > 0
        ? 'active'
        : missionHasErrors
          ? 'warning'
          : 'locked'
    const exportCta = missionHasExports ? 'Open latest' : missionCompletedCount > 0 ? 'Collect outputs' : 'Finish run first'

    return [
      {
        id: 'source',
        label: 'Source',
        detail: sourceDetail,
        tone: sourceTone,
        icon: UploadCloud,
        cta: sourceCta,
        action: jobs.length > 0 ? jumpToSource : openFilePicker,
      },
      {
        id: 'recipe',
        label: 'Recipe',
        detail: recipeDetail,
        tone: recipeTone,
        icon: Settings2,
        cta: recipeCta,
        action: jobs.length > 0 ? jumpToOptions : openFilePicker,
        disabled: jobs.length === 0,
      },
      {
        id: 'run',
        label: 'Runway',
        detail: runNodeDetail,
        tone: runTone,
        icon: Play,
        cta: runCta,
        action: runOrFollowAction,
        disabled: !canAutoRunOrSwitch,
      },
      {
        id: 'exports',
        label: 'Exports',
        detail: missionHasExports
          ? `${exports.length} artifact${exports.length === 1 ? '' : 's'} ready`
          : missionCompletedCount > 0
            ? 'Review successful outputs'
            : 'Run conversion',
        tone: exportTone,
        icon: Download,
        cta: exportCta,
        action: missionHasExports && latestExport ? openLatestExport : jumpToExports,
        disabled: jobs.length > 0 && !missionHasExports && missionCompletedCount === 0,
      },
    ]
  })()

  const explorerModeHint = !isGuidedMode
    ? jobs.length === 0
      ? 'Drop files to begin, then use the workspace freely. Guided mode gives a mission checklist whenever you want it.'
      : missionHasBlocked
        ? 'You have native-only files queued. Guided mode can show the exact remediation path.'
        : missionHasErrors
          ? 'Some files failed. Stay in Explorer to regroup, or switch to Guided for cleanup prompts.'
          : compatibleJobs.length === 0
            ? 'Current files do not match this recipe. Guided mode can show the quickest alignment path.'
            : jobs.some((job) => job.status === 'running')
              ? 'Your conversion is in progress. Keep an eye on queue states, and open Guided mode for next-step coaching after it finishes.'
              : 'Explorer mode is active: you are fully in control. Guided mode can add a guided checklist if you want.'
    : null

  const missionCompletion = !missionRoundCompleted || missionCompletedCount === 0 || !missionHasExports
    ? null
    : missionHasErrors
      ? {
          tone: 'warning' as const,
          title: 'Mission completed with fixes',
          message: `You finished ${missionCompletedCount} job${missionCompletedCount === 1 ? '' : 's'}, with ${missionErrorCount} error${
            missionErrorCount === 1 ? '' : 's'
          }. Open exports for successful outputs, then use a quick cleanup pass for the rest.`,
          ctaLabel: 'Review outputs',
          ctaAction: jumpToExports,
        }
      : {
          tone: 'success' as const,
          title: 'Mission complete',
          message: `Great run. You finished ${missionCompletedCount} job${missionCompletedCount === 1 ? '' : 's'} and reached the end of this mission.`,
          ctaLabel: 'Open latest export',
          ctaAction: jumpToExports,
        }

  const missionCoach = (() => {
    if (missionCompletion) {
      return missionCompletion
    }

    if (missionHasBlocked) {
      return {
        tone: 'warning' as const,
        title: 'Mission is blocked',
        message: 'Some queued files are native-only for this path. Use a compatible browser recipe first, or enable the native bridge for a desktop-enabled pass.',
        ctaLabel: 'Go to source',
        ctaAction: jumpToSource,
      }
    }

    if (missionNativeUnavailable) {
      return {
        tone: 'warning' as const,
        title: 'Native path needed',
        message:
          'This recipe needs native engines (FFmpeg, Pandoc, or qpdf). Open the Options panel to confirm your native mode and paths.',
        ctaLabel: 'Review native settings',
        ctaAction: jumpToOptions,
      }
    }

    if (missionFolderWarning) {
      return {
        tone: 'warning' as const,
        title: 'Native folders need review',
        message: missionFolderWarning,
        ctaLabel: 'Open native settings',
        ctaAction: jumpToOptions,
      }
    }

    if (!jobs.length) {
      return {
        tone: 'info' as const,
        title: 'Start your mission',
        message: `Pick source files for ${toolOptions.find((tool) => tool.id === activeTool)?.label ?? 'this recipe'} and follow the steps above.`,
        ctaLabel: 'Pick files',
        ctaAction: openFilePicker,
      }
    }

    if (compatibleJobs.length === 0 && jobs.length > 0) {
      return {
        tone: 'warning' as const,
        title: 'Recipe mismatch',
        message:
          suggestedToolLabel && suggestedTool
            ? `This queue is a ${suggestedToolLabel.toLowerCase()} collection. Switch recipe to continue.`
            : 'Your queued files do not match this recipe. Remove mismatch items or switch recipe.',
        ctaLabel: suggestedTool ? `Switch to ${suggestedToolLabel}` : 'Open source queue',
        ctaAction: suggestedTool ? () => applySuggestedTool(suggestedTool) : jumpToSource,
      }
    }

    if (missionCompletedCount > 0 && missionHasExports) {
      return {
        tone: 'success' as const,
        title: 'Output ready',
        message: `You finished ${missionCompletedCount} job${missionCompletedCount === 1 ? '' : 's'}. Open exports now, or keep the remaining queue for another recipe.`,
        ctaLabel: 'Open exports',
        ctaAction: jumpToExports,
      }
    }

    if (canRunMission) {
      return {
        tone: 'info' as const,
        title: 'Ready to run',
        message: `You're in range. Review settings, then run the conversion.`,
        ctaLabel: 'Run conversion',
        ctaAction: runJobs,
      }
    }

    return {
      tone: 'info' as const,
      title: 'Mission in progress',
      message: 'Need a small adjustment; follow the hint above and keep working through the four steps.',
      ctaLabel: 'Review steps',
      ctaAction: jumpToSource,
    }
  })()

  const missionWaypoint: MissionWaypoint = (() => {
    if (missionCompletion) {
      return {
        tone: 'success' as const,
        title: 'All set',
        hint: 'Your current mission is complete. Open the latest export or start a fresh round.',
        ctaLabel: 'Open latest export',
        ctaAction: latestExport ? openLatestExport : jumpToExports,
      }
    }

    if (missionHasBlocked) {
      return {
        tone: 'warning' as const,
        title: 'Blocked',
        hint: 'Some queue items need desktop-only processing. Resolve with the native path or remove blockers first.',
        ctaLabel: 'Review source queue',
        ctaAction: jumpToSource,
      }
    }

    if (missionNativeUnavailable) {
      return {
        tone: 'warning' as const,
        title: 'Enable native mode',
        hint: 'This path needs FFmpeg/Pandoc/qpdf. Enable or switch to a browser-ready recipe.',
        ctaLabel: 'Open options',
        ctaAction: jumpToOptions,
      }
    }

    if (missionFolderWarning) {
      return {
        tone: 'warning' as const,
        title: 'Path check',
        hint: missionFolderWarning,
        ctaLabel: 'Open native settings',
        ctaAction: jumpToOptions,
      }
    }

    if (jobs.length === 0) {
      return {
        tone: 'info' as const,
        title: 'Start',
        hint: 'Drop local files first, then choose a recipe that matches what you picked.',
        ctaLabel: 'Add files now',
        ctaAction: openFilePicker,
      }
    }

    if (missionHasRunningJobs) {
      return {
        tone: 'info' as const,
        title: 'Running',
        hint: 'Your mission is in progress. Watch queue status and review outputs when done.',
        ctaLabel: 'Jump to queue',
        ctaAction: jumpToSource,
      }
    }

    if (compatibleJobs.length === 0) {
      return {
        tone: 'warning' as const,
        title: 'Recipe mismatch',
        hint: 'Current files do not match this recipe. Switch tool or remove unsupported files.',
        ctaLabel: suggestedTool ? `Switch to ${suggestedToolLabel}` : 'Fix source recipe',
        ctaAction: suggestedTool ? () => applySuggestedTool(suggestedTool) : jumpToSource,
      }
    }

    if (canRunMission) {
      return {
        tone: 'info' as const,
        title: 'Ready',
        hint: `You can run ${missionCanRun ? 'your selected recipe' : 'the mission flow'} now.`,
        ctaLabel: 'Run conversion',
        ctaAction: runJobs,
      }
    }

    if (missionCompletedCount > 0 && missionHasExports) {
      return {
        tone: 'success' as const,
        title: 'Review mission rewards',
        hint: 'You have successful outputs. Open the latest export and continue with follow-up conversions if needed.',
        ctaLabel: 'Open latest export',
        ctaAction: latestExport ? openLatestExport : jumpToExports,
      }
    }

    return {
      tone: 'warning' as const,
      title: 'Next step',
      hint: 'One more adjustment is needed; open options, then run or collect exports.',
      ctaLabel: 'Follow guided path',
      ctaAction: () => setGuidanceModePreserve('guided'),
    }
  })()
  const missionStatusTone: 'success' | 'info' | 'warning' = missionWaypoint.tone
  const missionStatusCopy = missionNotice ?? missionWaypoint.hint

  const missionLane = (() => {
    const firstPendingIndex = missionRailSteps.findIndex((step) => step.tone !== 'done')
    const activeIndex = firstPendingIndex === -1 ? missionRailSteps.length - 1 : firstPendingIndex

    return {
      activeIndex,
      steps: missionRailSteps,
      nextTitle: missionWaypoint.title,
      nextHint: missionWaypoint.hint,
      nextActionLabel: missionWaypoint.ctaLabel,
      nextAction: missionWaypoint.ctaAction,
      tone: missionWaypoint.tone,
    }
  })()
  const missionCurrentStep = missionLane.steps[missionLane.activeIndex] ?? {
    id: 'source',
    label: 'Source',
    detail: missionNotice ?? 'Ready to begin',
    tone: 'active',
    icon: UploadCloud,
    cta: 'Add files',
    action: openFilePicker,
  }
  const missionRouteSummary = `${missionCurrentStep.label} ${missionLane.activeIndex + 1}/4`
  const missionCurrentStepStatusLabel = (() => {
    switch (missionCurrentStep.tone) {
      case 'done':
        return 'Complete'
      case 'warning':
        return 'Caution'
      case 'locked':
        return 'Locked'
      case 'active':
      default:
        return 'Current'
    }
  })()
  const shouldShowFirstRunGuide = showFirstRunGuide && jobs.length === 0 && exports.length === 0
  const shouldShowGuidedRouteNudge =
    isGuidedMode && showGuidedRouteNudge && !shouldShowFirstRunGuide && jobs.length === 0 && exports.length === 0
  const missionMapActiveIndex = missionLane.activeIndex
  const demoMissionComplete = demoMissionActive && missionHasExports
  const demoMissionSteps = [
    {
      label: 'Load samples',
      detail: jobs.length > 0 ? `${jobs.length} sample file${jobs.length === 1 ? '' : 's'} in queue` : 'Use Try sample files',
      done: demoMissionActive && jobs.length > 0,
    },
    {
      label: 'Follow route',
      detail: missionRouteSummary,
      done: demoMissionActive && jobs.length > 0,
    },
    {
      label: 'Run locally',
      detail: missionCompletedCount > 0 ? `${missionCompletedCount} job${missionCompletedCount === 1 ? '' : 's'} converted` : runActionLabel,
      done: demoMissionActive && missionCompletedCount > 0,
    },
    {
      label: 'Export ready',
      detail: missionHasExports ? `${exports.length} export${exports.length === 1 ? '' : 's'} ready` : 'Collect the output',
      done: demoMissionComplete,
    },
  ]
  const demoMissionActiveStepIndex = demoMissionSteps.findIndex((step) => !step.done)
  const demoMissionCurrentIndex = demoMissionActiveStepIndex === -1 ? demoMissionSteps.length - 1 : demoMissionActiveStepIndex

  useEffect(() => {
    const isFormTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false
      }

      if (target.isContentEditable) {
        return true
      }

      const tag = target.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select'
    }

    const handleGlobalKeydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isFormTarget(event.target)) {
        return
      }

      if (event.key === 'F1' || event.key === '?') {
        event.preventDefault()
        setShowShortcutHints((current) => !current)
        return
      }

      const hasPlatformModifier = event.metaKey || event.ctrlKey
      if (!hasPlatformModifier) return

      const key = event.key.toLowerCase()
      if (key === 'o' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        openFilePicker()
        return
      }

      if (key === '1' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        jumpToSource()
        return
      }

      if (key === '2' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        jumpToOptions()
        return
      }

      if (key === '3' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        if (jobs.length > 0) {
          if (canRunMission) {
            runJobsRef.current?.()
          } else if (shouldFollowSuggestedTool && suggestedTool) {
            applySuggestedTool(suggestedTool)
          } else {
            jumpToSource()
          }
        } else {
          openFilePicker()
        }
        return
      }

      if (key === '4' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        jumpToExports()
        return
      }

      if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        if (jobs.length > 0) {
          if (canRunMission) {
            runJobsRef.current?.()
          } else if (shouldFollowSuggestedTool && suggestedTool) {
            applySuggestedTool(suggestedTool)
          } else {
            jumpToSource()
          }
        } else {
          openFilePicker()
        }
        return
      }

      if (key === 'g' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        setGuidanceModePreserve('guided')
        return
      }

      if (key === 'e' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        setGuidanceModePreserve('explorer')
        return
      }

      if (key === 'k' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        setShowShortcutHints((current) => !current)
        return
      }

      if (key === 'l' && !event.shiftKey && !event.altKey) {
        event.preventDefault()
        if (!isRunning && jobs.length > 0) {
          clearQueue()
          setBanner({ tone: 'success', text: 'Queue cleared.' })
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown)
    }
  }, [
    clearQueue,
    openFilePicker,
    jumpToSource,
    jumpToOptions,
    jumpToExports,
    applySuggestedTool,
    setGuidanceModePreserve,
    jobs.length,
    isRunning,
    canRunMission,
    shouldFollowSuggestedTool,
    suggestedTool,
    setBanner,
  ])

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

  useEffect(() => {
    try {
      localStorage.setItem(nativeFolderStorageKey, JSON.stringify(nativeFolders))
    } catch {
      // Local storage is a convenience for the desktop UI; conversion should keep working without it.
    }
  }, [nativeFolders])

  useEffect(() => {
    try {
      localStorage.setItem(guidanceModeStorageKey, guidanceMode)
    } catch {
      // Optional local storage only.
    }
  }, [guidanceMode])

  useEffect(() => {
    const previousGuidanceMode = guidanceModeTransitionRef.current
    let pulseTimer: number | null = null

    if (
      guidanceMode === 'guided' &&
      previousGuidanceMode === 'explorer' &&
      missionRailSectionRef.current
    ) {
      missionRailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setShowGuidancePulse(true)
      pulseTimer = window.setTimeout(() => {
        setShowGuidancePulse(false)
      }, 900)
    }

    guidanceModeTransitionRef.current = guidanceMode

    return () => {
      if (pulseTimer !== null) {
        window.clearTimeout(pulseTimer)
      }
    }
  }, [guidanceMode])

  useEffect(() => {
    try {
      localStorage.setItem(firstRunGuideStorageKey, showFirstRunGuide ? '0' : '1')
    } catch {
      // Optional local storage only.
    }
  }, [showFirstRunGuide])

  useEffect(() => {
    try {
      localStorage.setItem(guidedRouteNudgeStorageKey, showGuidedRouteNudge ? '0' : '1')
    } catch {
      // Optional local storage only.
    }
  }, [showGuidedRouteNudge])

  const hideQuickStart = useCallback(() => {
    try {
      localStorage.setItem(quickStartStorageKey, '1')
    } catch {
      // Optional local storage only.
    }
    setShowQuickStart(false)
  }, [])

  const hideFirstRunGuide = useCallback(() => {
    setShowFirstRunGuide(false)
  }, [])

  const hideGuidedRouteNudge = useCallback(() => {
    try {
      localStorage.setItem(guidedRouteNudgeStorageKey, '1')
    } catch {
      // Optional local storage only.
    }
    setShowGuidedRouteNudge(false)
  }, [])

  const enableGuidedPath = useCallback(() => {
    setGuidanceModePreserve('guided')
    setShowFirstRunGuide(false)
    setShowQuickStart(true)
    setShowGuidedRouteNudge(false)
  }, [setGuidanceModePreserve])

  const enableExplorerPath = useCallback(() => {
    setGuidanceModePreserve('explorer')
    setShowFirstRunGuide(false)
    setShowQuickStart(true)
  }, [setGuidanceModePreserve])

  const openQuickStart = useCallback(() => {
    setShowQuickStart(true)
  }, [])

  const addFiles = useCallback(
    (fileList: FileList | File[], options: { demoMission?: boolean } = {}) => {
      const incoming = Array.from(fileList)

      if (incoming.length === 0) return

      const nextJobs = incoming.map(createJob)
      setJobs((current) => [...nextJobs, ...current])
      setDemoMissionActive(Boolean(options.demoMission))
      setShowGuidedRouteNudge(false)
      setShowFirstRunGuide(false)
      setBanner({
        tone: 'success',
        text: options.demoMission
          ? `Demo mission loaded: ${incoming.length} local sample file${incoming.length === 1 ? '' : 's'} ready.`
          : `${incoming.length} file${incoming.length === 1 ? '' : 's'} added to the local queue.`,
      })
      hideQuickStart()
    },
    [hideQuickStart],
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
    setGuidanceModePreserve('guided')
    setShowGuidedRouteNudge(false)
    setShowFirstRunGuide(false)
    hideQuickStart()
    addFiles(sampleFiles, { demoMission: true })
  }, [activeTool, addFiles, hideQuickStart, setGuidanceModePreserve])

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

  const clearExports = () => {
    exports.forEach((artifact) => URL.revokeObjectURL(artifact.url))
    setExports([])
  }

  async function runJobs() {
    if (isRunning) return
    hideQuickStart()

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

    if (requiresDesktopTool(activeTool) && nativeFolderIssue) {
      setBanner({
        tone: 'warning',
        text: nativeFolderIssue,
      })
      return
    }

    if (runnableJobs.length === 0) {
      setBanner({
        tone: 'warning',
        text:
          compatibleJobs.length > 0
            ? 'All matching files already have an output or are waiting for review.'
            : activeTool === 'image-convert'
              ? 'Add PNG, JPG, WebP, GIF, BMP, or SVG files before running image conversion.'
              : activeTool === 'archive-zip'
                ? 'Add any local files before building a ZIP archive.'
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
        await runImageJobs(runnableJobs)
      }

      if (activeTool === 'archive-zip') {
        await runArchiveZip(runnableJobs)
      }

      if (activeTool === 'pdf-merge') {
        await runPdfMerge(runnableJobs)
      }

      if (activeTool === 'pdf-split') {
        await runPdfSplit(runnableJobs)
      }

      if (activeTool === 'pdf-optimize') {
        await runPdfOptimize(runnableJobs)
      }

      if (activeTool === 'native-engine') {
        await runNativeMediaJobs(runnableJobs)
      }

      if (activeTool === 'document-convert') {
        await runDocumentJobs(runnableJobs)
      }
    } finally {
      setIsRunning(false)
    }
  }

  runJobsRef.current = runJobs

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
          : imageOutputName(`nometer-image-${completed + 1}`, imageFormat)
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

  const runArchiveZip = async (compatibleJobs: QueueJob[]) => {
    compatibleJobs.forEach((job) =>
      updateJob(job.id, {
        status: 'running',
        progress: 48,
        message: 'Packing files into ZIP',
      }),
    )

    try {
      const files = compatibleJobs.map((job) => job.file)
      const blob = await zipFiles(files, preserveNames)
      const name = archiveOutputName(files, preserveNames)
      const artifact = createArtifact(blob, name, 'ZIP archive', compatibleJobs.length)
      setExports((current) => [artifact, ...current])
      compatibleJobs.forEach((job) =>
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: `Packed into ${name}`,
          outputName: name,
        }),
      )
      setBanner({
        tone: 'success',
        text: `${compatibleJobs.length} file${compatibleJobs.length === 1 ? '' : 's'} packed into ${name}.`,
      })
    } catch (error) {
      compatibleJobs.forEach((job) =>
        updateJob(job.id, {
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'ZIP creation failed.',
        }),
      )
      setBanner({ tone: 'danger', text: 'ZIP archive creation failed.' })
    }
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
      const artifact = createArtifact(blob, 'nometer-merged.pdf', 'PDF merge', compatibleJobs.length)
      setExports((current) => [artifact, ...current])
      compatibleJobs.forEach((job) =>
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: 'Merged into nometer-merged.pdf',
          outputName: 'nometer-merged.pdf',
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
          : 'nometer-split-pages.zip'
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
        const result = await optimizePdfFile(job.file, nativeFolders)
        const artifact = createArtifact(result.blob, result.name, 'qpdf optimize', 1, result.savedPath)
        setExports((current) => [artifact, ...current])
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: nativeOutputMessage(result, 'optimized PDF ready'),
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
        const result = await transcodeMediaFile(job.file, nativeFolders)
        const artifact = createArtifact(result.blob, result.name, 'FFmpeg transcode', 1, result.savedPath)
        setExports((current) => [artifact, ...current])
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: nativeOutputMessage(result, 'MP4 export ready'),
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
        const result = await convertDocumentFile(job.file, documentFormat, nativeFolders)
        const artifact = createArtifact(result.blob, result.name, 'Pandoc conversion', 1, result.savedPath)
        setExports((current) => [artifact, ...current])
        updateJob(job.id, {
          status: 'done',
          progress: 100,
          message: nativeOutputMessage(result, 'document export ready'),
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
      <aside className="sidebar" aria-label="NoMeter sections">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Archive size={22} />
          </div>
          <div>
            <strong>NoMeter</strong>
            <span>Free personal use. No uploads.</span>
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

        <section className="sidebar-map" aria-label="NoMeter mission map">
          <div className="section-header compact">
            <h2>Mission map</h2>
            <span className="sidebar-map-badge">{missionProgress}/4</span>
          </div>
          <div className={`sidebar-route-card sidebar-route-card-${missionLane.tone}`} aria-label="NoMeter current route">
            <div className="sidebar-route-card-head">
              <span className={`sidebar-route-status sidebar-route-status-${missionCurrentStep.tone}`}>
                {missionCurrentStepStatusLabel}
              </span>
              <span className="sidebar-route-progress">{missionRouteSummary}</span>
            </div>
            <strong>{missionLane.nextTitle}</strong>
            <p>{missionLane.nextHint}</p>
            <button
              type="button"
              className={`sidebar-route-action sidebar-route-action-${missionLane.tone}`}
              onClick={missionLane.nextAction}
              title={`Resume route: ${missionLane.nextTitle}`}
            >
              <Sparkles size={12} />
              {missionLane.nextActionLabel}
            </button>
          </div>
          <div className="sidebar-map-list">
            {missionRailSteps.map((step, index) => {
              const Icon = step.icon
              const isDone = step.tone === 'done'
              const isActive = missionMapActiveIndex === index
              const isLocked = step.tone === 'locked'
              return (
                <button
                  key={`sidebar-${step.id}`}
                  type="button"
                  className={`sidebar-map-node sidebar-map-node-${step.tone} ${isActive ? 'sidebar-map-node-current' : ''} ${isActive && !isDone ? 'sidebar-map-node-next' : ''}`}
                  onClick={step.action}
                  disabled={isLocked}
                  title={step.detail}
                >
                  <span className={`sidebar-map-index sidebar-map-index-${isDone ? 'done' : isActive ? 'active' : isLocked ? 'locked' : 'pending'}`}>
                    {index + 1}
                  </span>
                  <span className="sidebar-map-copy">
                    <strong>{step.label}</strong>
                    <small>{step.cta}</small>
                  </span>
                  {isActive && !isDone ? <span className="sidebar-map-next">next</span> : null}
                  <Icon size={12} />
                  {step.tone === 'done' ? <CheckCircle2 size={12} className="sidebar-map-check" /> : null}
                  {isLocked && <LockKeyhole size={12} className="sidebar-map-lock" />}
                </button>
              )
            })}
          </div>
        </section>

        <div className="privacy-panel">
          <ShieldCheck size={18} />
          <div>
            <span>Local-first</span>
            <strong>Free personal use. No uploads.</strong>
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
            <div className={`path-strip path-strip-${missionWaypoint.tone}`} title={missionWaypoint.hint}>
              <span className="path-strip-label">Next move</span>
              <button
                type="button"
                className="path-strip-cta"
                onClick={missionWaypoint.ctaAction}
                title={`${missionWaypoint.title} - ${missionWaypoint.hint}`}
              >
                <Sparkles size={12} />
                {missionWaypoint.ctaLabel}
              </button>
              <span className="path-strip-title">{missionWaypoint.title}</span>
            </div>
            <div className={`route-status route-status-${missionStatusTone}`} role="status" aria-live="polite">
              <span className={`route-status-dot route-status-dot-${missionStatusTone}`} />
              <span className="route-status-copy">{missionStatusCopy}</span>
            </div>
            <div className="mission-route-radar" aria-label="NoMeter mission route radar">
              {missionLane.steps.map((step, index) => {
                const isActive = index === missionLane.activeIndex
                const isDone = step.tone === 'done'
                const routeHint =
                  index === 0
                    ? 'Collect source files before anything else.'
                    : index === 1
                      ? 'Tune recipe and options for your source.'
                      : index === 2
                        ? runActionLabel
                        : missionHasExports
                          ? 'Export files are ready for review.'
                          : missionCompletedCount > 0
                            ? 'Collect successful outputs next.'
                            : 'Finish conversion to unlock exports.'
                return (
                  <div className="mission-route-radar-row" key={`topbar-route-${step.id}`}>
                    <button
                      type="button"
                      className={`mission-route-dot mission-route-dot-${step.tone} ${isActive ? 'mission-route-dot-active' : ''} ${
                        isActive ? 'mission-route-dot-pulse' : ''
                      }`}
                      onClick={step.action}
                      disabled={step.disabled}
                      title={`${step.label}: ${step.cta} - ${routeHint}`}
                    >
                      <span className="sr-only">{step.label}: {step.cta}</span>
                      <span aria-hidden="true">{step.label.substring(0, 1)}</span>
                    </button>
                    {index < missionLane.steps.length - 1 ? (
                      <span
                        className={`mission-route-link mission-route-link-${isDone ? 'done' : isActive ? 'active' : 'pending'}`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                )
              })}
            </div>
            <div className={`mission-location-strip mission-location-strip-${missionWaypoint.tone}`} title={missionCurrentStep.detail}>
              <span className="mission-location-label">You are here</span>
              <div className="mission-location-copy">
                <strong>{missionCurrentStep.label}</strong>
                <small>{missionRouteSummary}</small>
              </div>
              <span className={`mission-location-mini mission-location-mini-${missionCurrentStep.tone}`}>
                {missionCurrentStepStatusLabel}
              </span>
              <button
                type="button"
                className={`mission-location-cta mission-location-cta-${missionWaypoint.tone} ghost-button`}
                onClick={missionLane.nextAction}
                title={`Follow route: ${missionLane.nextTitle}`}
              >
                <Sparkles size={12} />
                {missionLane.nextActionLabel}
              </button>
            </div>
            <div className={`mission-beacon mission-beacon-${missionLane.tone}`} title={missionLane.nextHint}>
              <span className="mission-beacon-label">Next stop</span>
              <button
                type="button"
                className="mission-beacon-action"
                onClick={missionLane.nextAction}
                title={`${missionLane.nextTitle} - ${missionLane.nextHint}`}
              >
                <Sparkles size={12} />
                <span>{missionLane.nextActionLabel}</span>
              </button>
            </div>
            <button
              type="button"
              className="ghost-button shortcut-toggle"
              onClick={() => setShowShortcutHints((current) => !current)}
              title="Open shortcut map (Ctrl/Cmd + K)"
            >
              <Sparkles size={14} />
              Shortcuts
            </button>
            <div className={`mode-control ${showGuidancePulse ? 'mode-control-flash' : ''}`} role="tablist" aria-label="NoMeter guidance mode">
              <span className="mode-control-label">Guidance</span>
              <div className="segmented-control mode-toggle">
                <button
                  type="button"
                  className={isGuidedMode ? 'active' : ''}
                  onClick={() => setGuidanceModePreserve('guided')}
                  aria-label="Guided mode"
                  role="tab"
                  aria-selected={isGuidedMode}
                >
                  Guided
                </button>
                <button
                  type="button"
                  className={isGuidedMode ? '' : 'active'}
                  onClick={() => setGuidanceModePreserve('explorer')}
                  aria-label="Explorer mode"
                  role="tab"
                  aria-selected={!isGuidedMode}
                >
                  Explorer
                </button>
              </div>
            </div>
          </div>
          <span className="local-pill">
            <LockKeyhole size={15} />
            Files stay local
          </span>
          <button type="button" className="ghost-button" onClick={clearQueue} disabled={jobs.length === 0}>
            <Trash2 size={16} />
            Clear
          </button>
        </header>

        {showShortcutHints ? (
          <section className="shortcut-hud" aria-label="NoMeter command map">
            <div className="shortcut-hud-head">
              <div>
                <h2>NoMeter command map</h2>
                <p>Use these for fast mission control.</p>
              </div>
              <button
                type="button"
                className="ghost-button mission-coach-cta"
                onClick={() => setShowShortcutHints(false)}
              >
                Hide
              </button>
            </div>
            <div className="shortcut-hud-grid">
              <div className="shortcut-chip">
                <div>
                  <strong>Add files</strong>
                  <small>Open queue</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>O</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Mission route: source</strong>
                  <small>Open source step</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>1</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Mission route: recipe</strong>
                  <small>Open recipe step</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>2</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Run mission</strong>
                  <small>Run or follow suggested tool</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Mission route: run</strong>
                  <small>Jump to mission action</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>3</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Mission route: exports</strong>
                  <small>Open exports panel</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>4</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Guided mode</strong>
                  <small>Turn guidance on</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>G</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Explorer mode</strong>
                  <small>Turn guidance off</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>E</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Clear queue</strong>
                  <small>Drop queued files</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>L</kbd>
                </span>
              </div>
              <div className="shortcut-chip">
                <div>
                  <strong>Show shortcuts</strong>
                  <small>Open/close this panel</small>
                </div>
                <span className="shortcut-kbd">
                  <kbd>?</kbd> / <kbd>F1</kbd>
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {banner ? <div className={`banner ${banner.tone}`}>{banner.text}</div> : null}

        {shouldShowFirstRunGuide ? (
          <section className="first-run-guide" aria-label="NoMeter first run guidance">
            <div className="first-run-intro">
              <h2>Welcome to NoMeter</h2>
              <p>Run the sample path first, or add your own files. Nothing uploads and desktop saves use your configured folders.</p>
            </div>
            <div className="first-run-paths">
              <button type="button" className="ghost-button" onClick={enableGuidedPath}>
                <Workflow size={14} />
                Guided route
              </button>
              <button type="button" className="ghost-button" onClick={enableExplorerPath}>
                <Sparkles size={14} />
                Simple workbench
              </button>
              <button type="button" className="ghost-button" onClick={openFilePicker}>
                <UploadCloud size={14} />
                Add files
              </button>
              <button type="button" className="ghost-button" onClick={loadSampleFiles}>
                <CheckCircle2 size={14} />
                Try sample files
              </button>
            </div>
            <button type="button" className="first-run-dismiss" onClick={hideFirstRunGuide}>
              Continue without guide
            </button>
          </section>
        ) : null}

        {shouldShowGuidedRouteNudge ? (
          <section className="route-nudge" aria-label="NoMeter guided route hint">
            <div>
              <h3>Follow the route</h3>
              <p>You are in Guided mode. The top bar and mission lane now show your live waypoint: Source &gt; Recipe &gt; Run &gt; Export.</p>
            </div>
            <div className="route-nudge-actions">
              <button type="button" className="ghost-button" onClick={() => jumpToSource()}>
                <Sparkles size={14} />
                Open mission rail
              </button>
              <button type="button" className="ghost-button" onClick={hideGuidedRouteNudge}>
                <Workflow size={14} />
                Got it
              </button>
            </div>
          </section>
        ) : null}

        <section ref={missionRailSectionRef} className="mission-rail" aria-label="NoMeter mission rail">
          <div className="mission-rail-head">
            <h2>Mission rail</h2>
            <p>Open-world control: follow the path when you want guidance.</p>
          </div>
          <div className="mission-rail-progress-wrap" aria-label="NoMeter mission progress">
            <span>{missionObjectiveLabel}</span>
            <div className="mission-rail-progress-track">
              <span className="mission-rail-progress-fill" style={{ width: `${missionProgressPercent}%` }} />
            </div>
          </div>
          <div className="mission-rail-grid">
            {missionRailSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div className="mission-rail-unit" key={step.id}>
                  <button
                    type="button"
                    className={`mission-rail-node mission-rail-node-${step.tone}`}
                    onClick={step.action}
                    disabled={step.disabled}
                    title={step.detail}
                  >
                    <span className="mission-rail-icon">
                      <Icon size={14} />
                    </span>
                    <span className="mission-rail-copy">
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                      <span className="mission-rail-cta">{step.cta}</span>
                    </span>
                  </button>
                  {index < missionRailSteps.length - 1 ? <span className="mission-rail-chevron" aria-hidden="true" /> : null}
                </div>
              )
            })}
          </div>
        </section>

        <section className={`mission-lane mission-lane-${missionLane.tone}`} aria-label="NoMeter mission lane">
          <div className="mission-lane-director">
            <div className="mission-lane-director-copy">
              <span className={`mission-lane-eyebrow mission-lane-eyebrow-${missionLane.tone}`}>
                Director - {missionRouteSummary}
              </span>
              <h2>{missionLane.nextTitle}</h2>
              <p>{missionLane.nextHint}</p>
            </div>
            <button
              type="button"
              className={`ghost-button mission-lane-primary mission-lane-primary-${missionLane.tone} ${showGuidancePulse ? 'mission-cta-flash' : ''}`}
              onClick={missionLane.nextAction}
              title={`Follow route: ${missionLane.nextTitle}`}
            >
              <Sparkles size={15} />
              {missionLane.nextActionLabel}
            </button>
          </div>
          <div className="mission-lane-track">
            {missionLane.steps.map((step, index) => {
              const isActive = index === missionLane.activeIndex
              return (
                <button
                  type="button"
                  key={step.id}
                  className={`mission-lane-node mission-lane-node-${step.tone} ${isActive ? 'mission-lane-node-current' : ''}`}
                  onClick={step.action}
                  disabled={step.disabled}
                  title={step.detail}
                >
                  <span className="mission-lane-index">{index + 1}</span>
                  <span className="mission-lane-node-copy">
                    <strong>{step.label}</strong>
                    <small>{step.cta}</small>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {isGuidedMode ? (
          <section className="mission-strip" aria-label="NoMeter mission path">
          <div className="mission-head">
            <div>
              <h2>Mission path</h2>
              <p>Follow the path to get outputs into your chosen folder.</p>
            </div>
            <span className="mission-note">
              {missionNotice ?? `Mission progress ${missionProgress}/4`}
            </span>
          </div>
          <div className="mission-steps">
            <button
              type="button"
              className={`mission-step mission-step-link ${jobs.length > 0 ? 'done' : 'active'}`}
              onClick={jobs.length > 0 ? jumpToSource : openFilePicker}
            >
              <UploadCloud size={13} />
              <span>{missionStateCopy.source}</span>
              <span className="mission-step-action">{jobs.length > 0 ? 'Go to source area' : 'Pick files now'}</span>
            </button>
            <button
              type="button"
              className={`mission-step mission-step-link ${jobs.length > 0 ? 'active' : 'pending'}`}
              onClick={jobs.length > 0 ? jumpToOptions : openFilePicker}
            >
              <Settings2 size={13} />
              <span>{missionStateCopy.options}</span>
              <span className="mission-step-action">Tune settings</span>
            </button>
              <button
                type="button"
                className={`mission-step mission-step-link ${
                  missionCanRun ? (missionHasExports || missionCompletedCount > 0 ? 'done' : 'active') : jobs.length > 0 ? 'active' : 'pending'
                }`}
                onClick={jobs.length > 0 ? runOrFollowAction : openFilePicker}
                disabled={jobs.length === 0 || !canAutoRunOrSwitch}
              >
                <Play size={13} />
                <span>{missionStateCopy.run}</span>
                <span className="mission-step-action">{jobs.length > 0 ? runActionLabel : 'Add matching files first'}</span>
              </button>
            <button
              type="button"
              className={`mission-step mission-step-link ${missionHasExports ? 'done' : missionCompletedCount > 0 ? 'active' : 'pending'}`}
              onClick={missionHasExports && latestExport ? openLatestExport : jumpToExports}
              disabled={jobs.length === 0 || !missionHasExports}
            >
              <Download size={13} />
              <span>{missionStateCopy.export}</span>
              <span className="mission-step-action">
                {missionHasExports ? 'Open latest export' : 'Run conversion first'}
              </span>
            </button>
          </div>
          <div className="mission-actions">
            {jobs.length === 0 ? (
              <>
                <button type="button" className="ghost-button" onClick={openFilePicker}>
                  <UploadCloud size={16} />
                  Add files
                </button>
                <button type="button" className="ghost-button" onClick={loadSampleFiles}>
                  <CheckCircle2 size={16} />
                  Try sample files
                </button>
                {!showQuickStart ? (
                  <button type="button" className="ghost-button" onClick={openQuickStart}>
                    <Workflow size={16} />
                    Open quickstart
                  </button>
                ) : null}
                {missionActionHint ? <span className="mission-hint">{missionActionHint}</span> : null}
              </>
            ) : (
                <>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={runOrFollowAction}
                    disabled={jobs.length === 0 || !canAutoRunOrSwitch}
                  >
                    <Play size={16} />
                    {runActionLabel}
                  </button>
                  {missionActionHint ? <span className="mission-hint">{missionActionHint}</span> : null}
                  {latestExport ? (
                    <button type="button" className="ghost-button" onClick={openLatestExport}>
                      <Download size={16} />
                      Open latest export
                    </button>
                  ) : null}
                </>
              )}
          </div>

          <div className={`mission-coach mission-coach-${missionCoach.tone}`}>
            <div className="mission-coach-row">
              <div>
                <h3>{missionCoach.title}</h3>
                <p>{missionCoach.message}</p>
              </div>
              <button type="button" className="ghost-button mission-coach-cta" onClick={missionCoach.ctaAction}>
                <Workflow size={14} />
                {missionCoach.ctaLabel}
              </button>
            </div>
            {missionActionHint ? <span className="mission-hint mission-hint-inline">{missionActionHint}</span> : null}
          </div>

          {demoMissionActive ? (
            <div className={`demo-mission-card ${demoMissionComplete ? 'demo-mission-card-complete' : ''}`} aria-label="NoMeter demo mission">
              <div className="demo-mission-head">
                <div>
                  <span className="demo-mission-label">Demo mission</span>
                  <h3>{demoMissionComplete ? 'Sample route complete' : 'Sample route live'}</h3>
                  <p>
                    {demoMissionComplete
                      ? 'You just proved the local path: samples loaded, the route updated, conversion ran, and an export appeared.'
                      : 'Follow the highlighted route card to run these samples and see a real local export appear.'}
                  </p>
                </div>
                <span className="demo-mission-count">
                  {demoMissionCurrentIndex + 1}/{demoMissionSteps.length}
                </span>
              </div>
              <div className="demo-mission-steps">
                {demoMissionSteps.map((step, index) => (
                  <span
                    key={step.label}
                    className={`demo-mission-step ${step.done ? 'demo-mission-step-done' : index === demoMissionCurrentIndex ? 'demo-mission-step-current' : ''}`}
                  >
                    <span>{index + 1}</span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </span>
                ))}
              </div>
              <div className="demo-mission-actions">
                {demoMissionComplete && latestExport ? (
                  <button type="button" className="ghost-button mission-coach-cta" onClick={openLatestExport}>
                    <Download size={14} />
                    Open latest export
                  </button>
                ) : (
                  <button type="button" className="ghost-button mission-coach-cta" onClick={missionLane.nextAction}>
                    <Sparkles size={14} />
                    {missionLane.nextActionLabel}
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-button mission-coach-cta"
                  onClick={() => {
                    setJobs([])
                    setDemoMissionActive(false)
                    setShowQuickStart(true)
                    setBanner({
                      tone: 'success',
                      text: 'Demo mission reset. Add your own files or run the sample mission again.',
                    })
                  }}
                >
                  <Workflow size={14} />
                  Start another mission
                </button>
              </div>
            </div>
          ) : null}

          {missionCompletion ? (
            <div className={`mission-complete mission-complete-${missionCompletion.tone}`}>
              <div className="mission-complete-row">
                <div>
                  <h3>
                    <Sparkles size={14} />
                    {missionCompletion.title}
                  </h3>
                  <p>{missionCompletion.message}</p>
                  <p className="mission-complete-subtle">{latestExport ? 'Tip: open latest export to review final output.' : ''}</p>
                </div>
                <div className="mission-complete-actions">
                  {latestExport ? (
                    <button type="button" className="ghost-button mission-coach-cta" onClick={openLatestExport}>
                      <Download size={14} />
                      Open latest export
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost-button mission-coach-cta"
                    onClick={() => {
                      setJobs([])
                      setBanner({
                        tone: 'success',
                        text: 'Ready for a fresh mission. Add more files when you are.',
                      })
                    }}
                  >
                    <Workflow size={14} />
                    Start another mission
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          </section>
        ) : (
          <section className="mode-hint-banner" aria-label="NoMeter explorer mode">
            <div>
              <p className="mode-hint-title">Explorer mode is active.</p>
              <p className="mode-hint-copy">{explorerModeHint}</p>
            </div>
            <div className="mode-hint-actions">
              <button type="button" className="ghost-button" onClick={openFilePicker}>
                <UploadCloud size={14} />
                Add files
              </button>
              <button type="button" className="ghost-button" onClick={loadSampleFiles}>
                <CheckCircle2 size={14} />
                Samples
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setGuidanceModePreserve('guided')}
              >
                <Workflow size={14} />
                Turn on Guided mode
              </button>
            </div>
          </section>
        )}

        {!isGuidedMode ? (
          <section className={`mission-waypoint mission-waypoint-${missionWaypoint.tone}`} aria-label="NoMeter next waypoint">
            <div className="mission-waypoint-text">
              <h2>{missionWaypoint.title}</h2>
              <p>{missionWaypoint.hint}</p>
            </div>
            <button type="button" className="ghost-button mission-waypoint-cta" onClick={missionWaypoint.ctaAction}>
              <Sparkles size={14} />
              {missionWaypoint.ctaLabel}
            </button>
          </section>
        ) : null}

        {!isGuidedMode ? (
          <section className="world-atlas" aria-label="NoMeter exploration atlas">
            <div className="section-header section-header-atlas">
              <div>
                <h2>Studio atlas</h2>
                <p>Jump anywhere, keep your way in view.</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setGuidanceModePreserve('guided')}
              >
                <Workflow size={14} />
                Follow guided path
              </button>
            </div>
            <div className="world-atlas-grid">
              {worldAtlasNodes.map((node) => {
                const Icon = node.icon
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`world-atlas-node world-atlas-node-${node.tone}`}
                    onClick={node.action}
                    title={node.detail}
                  >
                    <span className="world-atlas-node-row">
                      <span className="world-atlas-node-icon">
                        <Icon size={14} />
                      </span>
                      <span>
                        <strong>{node.title}</strong>
                        <small>{node.detail}</small>
                      </span>
                    </span>
                    <span className="world-atlas-node-cta">
                      {node.badge ? <span className="world-atlas-badge">{node.badge}</span> : null}
                      {node.cta}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        {isGuidedMode && shouldShowQuickStart ? (
          <section className="quickstart-card" aria-label="NoMeter guided quickstart">
            <div className="section-header">
              <div>
                <h2>Guided quickstart</h2>
                <p>Try one round: files, then options, then run, then export, in that order.</p>
              </div>
              <button
                type="button"
                className="quickstart-dismiss icon-button"
                onClick={hideQuickStart}
                aria-label="Hide quickstart"
                title="Hide quickstart"
              >
                <XCircle size={14} />
              </button>
            </div>
            <ol className="quickstart-steps">
              <li>
                Add <span>{quickStartHint.source}</span> and make sure it matches the selected tool.
              </li>
              <li>
                Use <strong>{quickStartHint.output}</strong>. {quickStartHint.focus}
              </li>
              <li>Press Run to process the queue and generate new export rows.</li>
              <li>Open the Exports panel, download browser outputs, and check the saved path for desktop-native jobs.</li>
            </ol>
            <div className="quickstart-actions">
              <button type="button" className="ghost-button" onClick={loadSampleFiles}>
                <UploadCloud size={16} />
                Try sample files
              </button>
              <button type="button" className="ghost-button" onClick={hideQuickStart}>
                <CheckCircle2 size={16} />
                Got it
              </button>
            </div>
          </section>
        ) : null}

        <div className="workbench-grid">
          <div className="primary-column">
            <section
              ref={sourceSectionRef}
              className={isDragging ? 'drop-zone dragging' : 'drop-zone'}
              onDrop={handleDrop}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={handleDragOver}
            >
              <div className="drop-icon" aria-hidden="true">
                <UploadCloud size={28} />
              </div>
              <div>
                <h2>Drop files into NoMeter</h2>
                <p>
                  Images, PDFs, and ZIP bundles run in the browser; qpdf, Pandoc, and FFmpeg power desktop-only jobs.
                </p>
              </div>
              <div className="drop-actions">
                <label className="file-picker">
                  <UploadCloud size={17} />
                  Add files
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileInput}
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
                  <p>{runnableJobs.length} ready to run with the selected recipe</p>
                </div>
                <button
                  type="button"
                  className="run-button"
                  onClick={runOrFollowAction}
                  disabled={isRunning}
                >
                  <Play size={17} fill="currentColor" />
                  {runButtonLabel}
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

            <section ref={exportsSectionRef} className="exports-panel">
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
                        {artifact.savedPath ? <code>{artifact.savedPath}</code> : null}
                      </div>
                      <Download size={18} />
                    </a>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside ref={optionsSectionRef} className="options-panel" aria-label="Conversion options">
            <section className="option-section">
              <h2>Recipe</h2>
              <div className="tool-list">
                {toolOptions.map((tool) => {
                  const Icon = tool.icon
                  const isSuggested = suggestedTool === tool.id && activeTool !== tool.id
                  return (
                    <button
                      type="button"
                      key={tool.id}
                      className={`tool-button ${activeTool === tool.id ? 'active' : ''} ${isSuggested ? 'tool-button-suggested' : ''}`}
                      onClick={() => setActiveTool(tool.id)}
                    >
                      <Icon size={18} />
                      <span>
                        <strong>{tool.label}</strong>
                        <small>{tool.detail}</small>
                        {isSuggested ? <span className="tool-button-hint">Suggested</span> : null}
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
              ) : activeTool === 'archive-zip' ? (
                <div className="pdf-output">
                  <Archive size={18} />
                  <span>ZIP archive</span>
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
              <div className="folder-settings">
                <div className="folder-guardrail" aria-label="Native folder storage guardrail">
                  <ShieldCheck size={15} />
                  <span>D: defaults stay active until you choose another non-system folder. C: paths are blocked.</span>
                </div>
                <div className="path-field">
                  <label htmlFor="native-work-folder">
                    <HardDrive size={15} />
                    Work folder
                  </label>
                  <div className="path-input-row">
                    <input
                      id="native-work-folder"
                      type="text"
                      value={nativeFolders.workDir}
                      spellCheck={false}
                      onChange={(event) =>
                        setNativeFolders((current) => ({ ...current, workDir: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="path-picker-button"
                      onClick={() => chooseNativeFolder('workDir')}
                      disabled={!nativeStatus.available}
                      title={
                        nativeStatus.available
                          ? 'Choose native work folder'
                          : 'Folder picker is available in the desktop app'
                      }
                    >
                      <FolderOpen size={15} />
                      Choose
                    </button>
                  </div>
                </div>
                <div className="path-field">
                  <label htmlFor="native-save-folder">
                    <FolderOutput size={15} />
                    Save folder
                  </label>
                  <div className="path-input-row">
                    <input
                      id="native-save-folder"
                      type="text"
                      value={nativeFolders.outputDir}
                      spellCheck={false}
                      onChange={(event) =>
                        setNativeFolders((current) => ({ ...current, outputDir: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="path-picker-button"
                      onClick={() => chooseNativeFolder('outputDir')}
                      disabled={!nativeStatus.available}
                      title={
                        nativeStatus.available
                          ? 'Choose native save folder'
                          : 'Folder picker is available in the desktop app'
                      }
                    >
                      <FolderOpen size={15} />
                      Choose
                    </button>
                  </div>
                </div>
                <div className="folder-actions">
                  <button type="button" className="ghost-button" onClick={() => setNativeFolders(defaultNativeFolders)}>
                    <RotateCcw size={16} />
                    Defaults
                  </button>
                  <span className={nativeFolderIssue ? 'folder-warning' : 'folder-note'}>
                    {nativeFolderIssue ??
                      (nativeStatus.available
                        ? 'Desktop saves native outputs to this Save folder.'
                        : 'Stored for desktop runs; folder choices are kept local.')}
                  </span>
                </div>
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
    '<text x="146" y="118" fill="#17211c" font-family="Arial, sans-serif" font-size="34" font-weight="700">NoMeter sample image</text>',
    '</svg>',
  ].join('')
  const image = new File([new Blob([svg], { type: 'image/svg+xml' })], 'nometer-sample.svg', {
    type: 'image/svg+xml',
  })

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const headingFont = await pdf.embedFont(StandardFonts.HelveticaBold)
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('NoMeter sample PDF', {
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
  page.drawText('Free personal use. No uploads.', {
    x: 92,
    y: 620,
    size: 16,
    font: headingFont,
    color: rgb(0.11, 0.56, 0.38),
  })
  const bytes = await pdf.save({ useObjectStreams: true })
  const pdfFile = new File([bytes.slice().buffer as ArrayBuffer], 'nometer-sample.pdf', {
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
    '# NoMeter sample document',
    '',
    'This document is generated locally for Pandoc conversion testing.',
    '',
    '## Promise',
    '',
    '- Free personal use',
    '- No uploads',
    '',
    '| Engine | Status |',
    '|---|---|',
    '| Pandoc | Wired |',
    '| FFmpeg | Wired |',
    '',
  ].join('\n')

  return new File([markdown], 'nometer-sample.md', { type: 'text/markdown' })
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

  return new File([buffer], 'nometer-tone.wav', { type: 'audio/wav' })
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

function inferMissionTool(jobs: QueueJob[]): ToolId | null {
  if (jobs.length === 0) return null

  const onlyKind = jobs.every((job) => job.kind === jobs[0].kind) ? jobs[0].kind : null
  if (onlyKind === null) return 'archive-zip'

  if (onlyKind === 'image') return 'image-convert'
  if (onlyKind === 'media') return 'native-engine'
  if (onlyKind === 'document') return 'document-convert'
  if (onlyKind === 'pdf') return 'pdf-merge'
  if (onlyKind === 'archive' || onlyKind === 'unknown') return 'archive-zip'

  return null
}

function isCompatibleForTool(job: QueueJob, tool: ToolId) {
  if (tool === 'archive-zip') return true
  if (tool === 'native-engine') return job.kind === 'media'
  if (tool === 'document-convert') return job.kind === 'document'
  if (tool === 'pdf-optimize') return job.kind === 'pdf'
  if (tool === 'image-convert') return job.kind === 'image'
  if (tool === 'pdf-merge' || tool === 'pdf-split') return job.kind === 'pdf'
  return false
}

function isRunnableForTool(job: QueueJob, tool: ToolId) {
  if (job.status === 'running' || job.status === 'done') return false
  if (tool === 'archive-zip') return true
  if (requiresDesktopTool(tool)) return isCompatibleForTool(job, tool)
  if (job.status !== 'ready' && job.status !== 'error') return false
  return isCompatibleForTool(job, tool)
}

function createArtifact(
  blob: Blob,
  name: string,
  action: string,
  sourceCount: number,
  savedPath?: string,
): ExportArtifact {
  return {
    id: createId(),
    name,
    url: URL.createObjectURL(blob),
    size: blob.size,
    action,
    sourceCount,
    createdAt: new Date().toISOString(),
    savedPath,
  }
}

function loadNativeFolders(): NativeFolders {
  try {
    const stored = localStorage.getItem(nativeFolderStorageKey)
    if (!stored) return defaultNativeFolders
    const parsed = JSON.parse(stored) as Partial<NativeFolders>

    return {
      workDir: typeof parsed.workDir === 'string' && parsed.workDir.trim() ? parsed.workDir : defaultNativeFolders.workDir,
      outputDir:
        typeof parsed.outputDir === 'string' && parsed.outputDir.trim()
          ? parsed.outputDir
          : defaultNativeFolders.outputDir,
    }
  } catch {
    return defaultNativeFolders
  }
}

function validateNativeFolders(folders: NativeFolders) {
  const workDir = folders.workDir.trim()
  const outputDir = folders.outputDir.trim()

  if (!isAbsoluteFolderPath(workDir)) return 'Use an absolute work folder path.'
  if (!isAbsoluteFolderPath(outputDir)) return 'Use an absolute save folder path.'
  if (isCDrivePath(workDir) || isCDrivePath(outputDir)) {
    return 'Choose non-system folders; this NoMeter workspace stays off C:.'
  }

  return null
}

function isAbsoluteFolderPath(value: string) {
  return /^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\') || value.startsWith('/')
}

function isCDrivePath(value: string) {
  return /^c:[\\/]/i.test(value.trim())
}

function requiresDesktopTool(tool: ToolId) {
  return tool === 'native-engine' || tool === 'document-convert' || tool === 'pdf-optimize'
}

function nativeOutputMessage(result: NativeTranscodeResult, fallback: string) {
  return result.savedPath ? `Saved to ${result.savedPath}` : `${formatBytes(result.blob.size)} ${fallback}`
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
