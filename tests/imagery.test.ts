import { describe, expect, it } from 'vitest'
import { IMAGERY_OPTIONS } from '../src/globe/imagery'
import { en, fr } from '../src/i18n/dict'

// Every imagery choice must be legally usable with visible attribution.
// Display labels live in the i18n dictionaries (both languages).
describe('imagery options', () => {
  it('exposes unique ids with attribution and a label in both languages', () => {
    const ids = IMAGERY_OPTIONS.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    const labelKey = {
      auto: 'imageryAuto',
      'esri-satellite': 'imageryEsriSatellite',
      'esri-labels': 'imageryEsriLabels',
      'osm-roads': 'imageryOsmRoads',
      off: 'imageryOff',
    } as const
    for (const o of IMAGERY_OPTIONS) {
      expect(o.attribution.length).toBeGreaterThan(0)
      expect(en[labelKey[o.id]].length).toBeGreaterThan(0)
      expect(fr[labelKey[o.id]].length).toBeGreaterThan(0)
    }
  })

  it('includes an imagery-off mode proving vectors are texture-independent', () => {
    expect(IMAGERY_OPTIONS.some((o) => o.id === 'off')).toBe(true)
  })

  it('uses no proprietary Google/Bing/Apple sources', () => {
    const dump = (JSON.stringify(IMAGERY_OPTIONS) + JSON.stringify(en) + JSON.stringify(fr)).toLowerCase()
    expect(dump).not.toContain('google')
    expect(dump).not.toContain('bing')
  })
})
