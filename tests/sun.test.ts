import { describe, expect, it } from 'vitest'
import { dayUtcHour } from '../src/globe/sun'

describe('sun & sky controls', () => {
  it('maps slider hours to the same UTC day at HH:00', () => {
    const now = new Date(Date.UTC(2026, 5, 15, 12, 30, 0))
    expect(dayUtcHour(now, 0).toISOString()).toBe('2026-06-15T00:00:00.000Z')
    expect(dayUtcHour(now, 23).toISOString()).toBe('2026-06-15T23:00:00.000Z')
  })

  it('clamps out-of-range hours instead of rolling the date', () => {
    const now = new Date(Date.UTC(2026, 5, 15, 12, 0, 0))
    expect(dayUtcHour(now, -5).getUTCHours()).toBe(0)
    expect(dayUtcHour(now, 99).getUTCHours()).toBe(23)
    expect(dayUtcHour(now, 99).getUTCDate()).toBe(15)
  })
})
