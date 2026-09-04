import { describe, expect, it } from 'vitest'
import { clampExaggeration, QUALITY_SETTINGS } from '../src/globe/terrain'

// Quality/exaggeration affect RENDERING ONLY — geometry and geodesy are untouched.
describe('terrain rendering settings', () => {
  it('orders detail performance < balanced < high (finer = smaller MSSE)', () => {
    expect(QUALITY_SETTINGS.performance.msse).toBeGreaterThan(QUALITY_SETTINGS.balanced.msse)
    expect(QUALITY_SETTINGS.balanced.msse).toBeGreaterThan(QUALITY_SETTINGS.high.msse)
  })

  it('clamps exaggeration to visual-only 1–3×', () => {
    expect(clampExaggeration(1)).toBe(1)
    expect(clampExaggeration(2.5)).toBe(2.5)
    expect(clampExaggeration(0.2)).toBe(1)
    expect(clampExaggeration(99)).toBe(3)
    expect(clampExaggeration(NaN)).toBe(1)
  })
})
