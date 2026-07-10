import type { NativeFolders } from './nativeEngines'

export function validateNativeFolders(folders: NativeFolders) {
  const workDir = folders.workDir.trim()
  const outputDir = folders.outputDir.trim()

  if (!isAbsoluteFolderPath(workDir)) return 'Use an absolute work folder path.'
  if (!isAbsoluteFolderPath(outputDir)) return 'Use an absolute save folder path.'
  if (isCDrivePath(workDir) || isCDrivePath(outputDir)) {
    return 'Choose non-system folders; this NoMeter workspace stays off C:.'
  }

  return null
}

export function isAbsoluteFolderPath(value: string) {
  return /^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\') || value.startsWith('/')
}

export function isCDrivePath(value: string) {
  return /^c:[\\/]/i.test(value.trim())
}
