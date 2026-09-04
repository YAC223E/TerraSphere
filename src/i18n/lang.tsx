import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { translate, type StringKey } from './dict'

export type Lang = 'en' | 'fr'
export const LOCALES: Record<Lang, string> = { en: 'en-US', fr: 'fr-FR' }
export const STORAGE_KEY = 'hpearth.lang.v1'

// Detection scans the FULL preferred-language list in order and takes the
// first supported base language (fr-*, en-*). Anything else → English.
// ["ja-JP", "fr-FR", "en-US"] therefore resolves to French.
// Malformed/empty values are skipped, never thrown on.
export function detectLanguage(langs: readonly unknown[] | undefined | null): Lang {
  if (!langs) return 'en'
  for (const raw of langs) {
    if (typeof raw !== 'string') continue
    const base = raw.trim().toLowerCase().split(/[-_]/)[0]
    if (!base) continue
    if (base === 'fr') return 'fr'
    if (base === 'en') return 'en'
  }
  return 'en'
}

// Priority: 1. stored explicit choice ('en'/'fr' only; anything else ignored)
// 2. browser/OS list 3. English.
export function resolveInitialLang(stored: unknown, nav: readonly unknown[] | undefined | null): Lang {
  if (stored === 'en' || stored === 'fr') return stored
  return detectLanguage(nav)
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null // private mode etc. → behave as "no choice yet"
  }
}

export function browserLanguages(): string[] {
  try {
    const nav = window.navigator
    if (Array.isArray(nav.languages) && nav.languages.length > 0) return [...nav.languages]
    if (typeof nav.language === 'string' && nav.language) return [nav.language]
  } catch {
    /* undetectable → English */
  }
  return []
}

interface LangContext {
  lang: Lang
  locale: string
  t: (key: StringKey, vars?: Record<string, string | number>) => string
  setLang: (l: Lang) => void
}

const Ctx = createContext<LangContext>({
  lang: 'en',
  locale: LOCALES.en,
  t: (key, vars) => translate('en', key, vars),
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => resolveInitialLang(readStored(), browserLanguages()))

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      window.localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // Selection still applies to this session.
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<LangContext>(
    () => ({
      lang,
      locale: LOCALES[lang],
      t: (key, vars) => translate(lang, key, vars),
      setLang,
    }),
    [lang, setLang],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLang(): LangContext {
  return useContext(Ctx)
}
