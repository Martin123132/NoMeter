import { describe, expect, it } from 'vitest'
import { isAbsoluteFolderPath, isCDrivePath, validateNativeFolders } from './nativeFolders'

describe('native folder guardrails', () => {
  it('accepts absolute D-drive work and save folders', () => {
    expect(
      validateNativeFolders({
        workDir: 'D:\\NoMeter\\work',
        outputDir: 'D:\\NoMeter\\outputs',
      }),
    ).toBeNull()
  })

  it('blocks C-drive paths and relative folders', () => {
    expect(
      validateNativeFolders({
        workDir: 'C:\\Temp\\NoMeter',
        outputDir: 'D:\\NoMeter\\outputs',
      }),
    ).toContain('stays off C:')
    expect(
      validateNativeFolders({
        workDir: 'relative-work',
        outputDir: 'D:\\NoMeter\\outputs',
      }),
    ).toBe('Use an absolute work folder path.')
  })

  it('recognizes Windows, UNC, and POSIX absolute paths', () => {
    expect(isAbsoluteFolderPath('D:\\NoMeter')).toBe(true)
    expect(isAbsoluteFolderPath('\\\\server\\share\\NoMeter')).toBe(true)
    expect(isAbsoluteFolderPath('/var/tmp/nometer')).toBe(true)
    expect(isAbsoluteFolderPath('NoMeter/work')).toBe(false)
    expect(isCDrivePath(' c:\\NoMeter')).toBe(true)
  })
})
