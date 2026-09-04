import { describe, expect, it } from 'vitest'
import { en, fr, translate, type StringKey } from '../src/i18n/dict'
import { detectLanguage, resolveInitialLang } from '../src/i18n/lang'
import { formatArea, formatDistance } from '../src/geodesy/geodesic'

describe('language detection (browser/OS → en/fr only)', () => {
  const cases: Array<[unknown, 'en' | 'fr']> = [
    ['fr-FR', 'fr'],
    ['fr-CA', 'fr'],
    ['fr', 'fr'],
    ['FR-fr', 'fr'],
    ['fr_CA', 'fr'],
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['en', 'en'],
    ['ja-JP', 'en'],
    ['es-ES', 'en'],
    ['de-DE', 'en'],
    ['zh-CN', 'en'],
    ['ar-SA', 'en'],
    ['pt-BR', 'en'],
    ['', 'en'],
    ['xx', 'en'],
    [null, 'en'],
    [undefined, 'en'],
    [42, 'en'],
  ]
  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${expected}`, () => {
      expect(detectLanguage([input as string])).toBe(expected)
      expect(detectLanguage(undefined)).toBe('en')
      expect(detectLanguage(null)).toBe('en')
      expect(detectLanguage([])).toBe('en')
    })
  }

  it('scans the full preferred-language list in order', () => {
    expect(detectLanguage(['ja-JP', 'fr-FR', 'en-US'])).toBe('fr')
    expect(detectLanguage(['de-DE', 'es-ES', 'en-GB'])).toBe('en')
    expect(detectLanguage(['en-US', 'fr-FR'])).toBe('en')
    expect(detectLanguage(['pt-BR', 'zh-CN'])).toBe('en')
  })
})

describe('language priority (stored > browser > English)', () => {
  it('explicit choice wins over browser language', () => {
    expect(resolveInitialLang('en', ['fr-FR'])).toBe('en')
    expect(resolveInitialLang('fr', ['en-US'])).toBe('fr')
  })

  it('ignores malformed stored values, falls back to detection', () => {
    expect(resolveInitialLang('de', ['fr-FR'])).toBe('fr')
    expect(resolveInitialLang('', ['fr-FR'])).toBe('fr')
    expect(resolveInitialLang(null, ['ja-JP'])).toBe('en')
    expect(resolveInitialLang(null, null)).toBe('en')
  })
})

describe('translation fallback safety', () => {
  it('fr covers every en key (compile-time + runtime double-check)', () => {
    expect(new Set(Object.keys(fr))).toEqual(new Set(Object.keys(en)))
  })

  it('missing keys fall back to English, never undefined/key/empty', () => {
    const partial = { ...fr }
    delete (partial as Partial<typeof fr>).measureOff
    delete (partial as Partial<typeof fr>).passText
    for (const key of ['measureOff', 'passText'] as StringKey[]) {
      const s = translate('fr', key, undefined, partial)
      expect(s).toBe(en[key])
      expect(s.length).toBeGreaterThan(0)
    }
  })

  it('interpolates {vars} in both languages', () => {
    expect(translate('en', 'vectorsLod', { lod: '50m' })).toContain('[50m]')
    expect(translate('fr', 'vectorsLod', { lod: '50m' })).toContain('[50m]')
    expect(translate('fr', 'africaNote', { n: 55 })).toContain('55')
  })

  it('labels clouds approximate in both languages, never live/real-time', () => {
    expect(en.cloudsLabel.toLowerCase()).toContain('approximate')
    expect(fr.cloudsLabel.toLowerCase()).toContain('approximatif')
    for (const s of [en.cloudsLabel, fr.cloudsLabel]) {
      const low = s.toLowerCase()
      expect(low).not.toContain('live')
      expect(low).not.toContain('real-time')
      expect(low).not.toContain('temps réel')
    }
  })
})

describe('locale-aware formatting (calculations untouched)', () => {
  it('formats US-style by default (backwards compatible)', () => {
    expect(formatDistance(1500)).toBe('1.50 km')
    expect(formatArea(1e6)).toBe('1 km²')
  })

  it('formats French decimals with comma', () => {
    expect(formatDistance(1500, 'metric', 'fr-FR')).toBe('1,50 km')
    expect(formatDistance(500, 'metric', 'fr-FR')).toBe('500,0 m')
    expect(formatArea(1e6, 'metric', 'fr-FR')).toBe('1 km²')
  })
})
