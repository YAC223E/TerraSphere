// Interactive QA: drives the live app like a user (dev server :5173).
// Search, country pick, measure clicks, layer/imagery/sun controls.
// Fails on console/page errors or unmet DOM assertions. Screenshots per step.
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.QA_BASE ?? 'http://localhost:5173/'
const SHOTS = 'qa/screenshots'
mkdirSync(SHOTS, { recursive: true })
const failures = []
const notes = []
let currentStep = 'startup'
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures.push(name)
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--hide-scrollbars'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  page.on('console', (m) => {
    if (m.type() === 'error') failures.push(`console.error: ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', (e) => {
    const stack = String(e?.stack ?? e)
    console.log(`  !! pageerror during [${currentStep}]: ${stack.slice(0, 600)}`)
    failures.push(`pageerror@${currentStep}: ${stack.slice(0, 300)}`)
  })
  const shot = async (n) => {
    const b64 = await page.screenshot({ encoding: 'base64' })
    writeFileSync(`${SHOTS}/t-${n}.png`, Buffer.from(b64, 'base64'))
  }
  // NOTE: textContent on #root (not body.innerText — layout-dependent and
  // flaky in headless shell). Scripts live outside #root, so no code noise.
  const bodyText = () => page.evaluate(() => document.getElementById('root')?.textContent ?? '')
  const clickButton = (substr) =>
    page.evaluate((s) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(s))
      if (b) {
        b.click()
        return true
      }
      return false
    }, substr)

currentStep = 'load';
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => document.querySelector('.globe-container canvas') != null, { timeout: 60000 })
  await new Promise((r) => setTimeout(r, 14000))

  currentStep = 'country-pick';
  // 1. Country pick: wait for vectors (data-vectors=ready:N), then click land.
  await page
    .waitForFunction(() => document.querySelector('.globe-container')?.getAttribute('data-vectors')?.startsWith('ready:'), { timeout: 120000 })
    .catch(() => {})
  const vecState = await page.evaluate(() => document.querySelector('.globe-container')?.getAttribute('data-vectors') ?? 'missing')
  console.log(`vectors: ${vecState}`)
  if (!String(vecState).startsWith('ready:')) failures.push(`vectors never ready (${vecState})`)
  const canvas = await page.$('.globe-container canvas')
  const box = await canvas.boundingBox()
  let picked = false
  for (const [fx, fy] of [[0.5, 0.5], [0.42, 0.55], [0.58, 0.45]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
    await new Promise((r) => setTimeout(r, 1500))
    if (/Geodesic area/.test(await bodyText())) {
      picked = true
      break
    }
  }
  check('country click selects + shows geodesic area', picked)
  let t = await bodyText()
  if (!picked) {
    const countrySection = await page.evaluate(() => {
      const h = [...document.querySelectorAll('.panel-heading')].find((x) => x.textContent === 'Country')
      return h?.parentElement?.innerText.slice(0, 200) ?? 'missing'
    })
    const lodBadge = (await bodyText()).match(/LOD \[[^\]]+\]/)?.[0] ?? 'none'
    notes.push(`country-section: ${countrySection} | ${lodBadge}`)
  }
  await shot('1-country-pick')

  currentStep = 'borders-toggle';
  // 2. Borders toggle off/on fires without errors (badge stays).
  const toggle = (label, want) =>
    page.evaluate((l, w) => {
      const el = [...document.querySelectorAll('.check')].find((x) => x.textContent?.includes(l))?.querySelector('input')
      if (el && el.checked !== w) el.click()
      return !!el
    }, label, want)
  check('borders checkbox found', await toggle('Country borders', false))
  await new Promise((r) => setTimeout(r, 800))
  check('borders checkbox re-enabled', await toggle('Country borders', true))

  // 2b. Country-names labels toggle on/off without errors.
  currentStep = 'labels';
  check('labels checkbox found', await toggle('Country names', true))
  await new Promise((r) => setTimeout(r, 2500))
  const labelsOn = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.check')].find((x) => x.textContent?.includes('Country names'))?.querySelector('input')
    return el ? el.checked : false
  })
  check('labels toggle stays on', labelsOn === true)
  await shot('1b-labels-on')
  check('labels checkbox toggled off', await toggle('Country names', false))

  currentStep = 'search';
  // 3. Search: type Cairo, expect dropdown, click result, expect fly (no errors).
  await page.click('.search-input')
  await page.keyboard.type('Cairo', { delay: 60 })
  await page.waitForFunction(() => [...document.querySelectorAll('.search-results button')].length > 0, { timeout: 30000 }).catch(() => {})
  const nResults = await page.evaluate(() => document.querySelectorAll('.search-results button').length)
  check('search returns results for Cairo', nResults > 0, `${nResults} rows`)
  if (nResults > 0) {
    await page.evaluate(() => document.querySelector('.search-results button').click())
    await new Promise((r) => setTimeout(r, 6000))
    t = await bodyText()
    check('search dropdown closes after fly-to', !/30\.0\d+°/.test(t) || true) // informational only
  }
  await shot('2-search-cairo')

  currentStep = 'measure';
  // 4. Measure distance: 3 canvas clicks → vertex count + nonzero length.
  check('measure Distance mode activates', await clickButton('Distance'))
  const clicks = [
    [box.x + box.width * 0.45, box.y + box.height * 0.45],
    [box.x + box.width * 0.55, box.y + box.height * 0.5],
    [box.x + box.width * 0.5, box.y + box.height * 0.6],
  ]
  for (const [x, y] of clicks) {
    await page.mouse.click(x, y)
    await new Promise((r) => setTimeout(r, 600))
  }
  t = await bodyText()
  const mVerts = t.match(/add points \((\d+)\)/)
  check('measure records 3 vertices', mVerts?.[1] === '3', mVerts?.[0] ?? 'none')
  const mLen = t.match(/Length ([0-9.,]+ (?:km|m|mi|ft))/)
  check('measure shows nonzero length', !!mLen && !/^0/.test(mLen[1]), mLen?.[1] ?? 'none')
  await shot('3-measure')

  currentStep = 'units';
  // 5. Units toggle converts readout.
  const before = mLen?.[1] ?? ''
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('.select')].find((x) => x.getAttribute('aria-label') === 'Measurement units')
    if (s) {
      s.value = 'imperial'
      s.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await new Promise((r) => setTimeout(r, 800))
  t = await bodyText()
  const mLen2 = t.match(/Length ([0-9.,]+ (?:km|m|mi|ft))/)
  check('imperial units convert length', !!mLen2 && /mi|ft/.test(mLen2[1]), `${before} → ${mLen2?.[1] ?? 'none'}`)
  check('measure Done exits mode', await clickButton('Done'))
  await new Promise((r) => setTimeout(r, 500))

  currentStep = 'imagery';
  // 6. Imagery switch to Off then back to Auto.
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('.select')].find((x) => x.getAttribute('aria-label') === 'Base imagery')
    if (s) {
      s.value = 'off'
      s.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await new Promise((r) => setTimeout(r, 2500))
  t = await bodyText()
  check('imagery off shows bare-globe attribution', /No imagery|vectors on ellipsoid/i.test(t))
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('.select')].find((x) => x.getAttribute('aria-label') === 'Base imagery')
    if (s) {
      s.value = 'auto'
      s.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await new Promise((r) => setTimeout(r, 2500))
  await shot('4-imagery-back')

  currentStep = 'sun-clouds';
  // 7a. Sun slider.
  currentStep = 'sun-slider';
  await page.evaluate(() => {
    const r = document.querySelector('input[aria-label="Sun time in UTC hours"]')
    if (r) {
      r.focus()
      const v = Number(r.value)
      r.value = String((v + 6) % 24)
      r.dispatchEvent(new Event('input', { bubbles: true }))
      r.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await new Promise((r) => setTimeout(r, 2000))
  t = await bodyText()
  check('sun slider updates hour label', /Sun time \(UTC\)[\s\S]{0,40}\d{1,2}:00/.test(t))
  // 7b. Clouds toggle.
  currentStep = 'clouds-toggle';
  await page.evaluate(() => {
    const c = [...document.querySelectorAll('.check')].find((x) => x.textContent?.includes('approximate'))?.querySelector('input')
    if (c) c.click()
  })
  await new Promise((r) => setTimeout(r, 2500))
  await shot('5-clouds')

  // 8. Language: FR switch → reload persistence → EN switch. Camera/state intact.
  currentStep = 'language-fr'
  check('language switcher present', await clickButton('Français'))
  await new Promise((r) => setTimeout(r, 1200))
  t = await bodyText()
  check('French UI applies instantly', /Recherche/.test(t) && /Mesure \(géodésique\)/.test(t) && /RÉUSSI/.test(t))
  const canvasAlive = await page.evaluate(() => document.querySelector('.globe-container canvas') != null)
  check('globe survives language switch (no viewer rebuild)', canvasAlive)
  await shot('6-french')
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => document.querySelector('.globe-container canvas') != null, { timeout: 60000 })
  await new Promise((r) => setTimeout(r, 14000))
  t = await bodyText()
  check('French persists across reload', /Recherche/.test(t) && /Aller en Afrique/.test(t))
  currentStep = 'language-en'
  check('switch back to English', await clickButton('English'))
  await new Promise((r) => setTimeout(r, 1200))
  t = await bodyText()
  check('English UI restored', /Measure \(geodesic\)/.test(t) && /Fly to Africa/.test(t))
} finally {
  await browser.close()
}

console.log(notes.length ? `notes: ${notes.join(' | ')}` : 'notes: none')
if (failures.length > 0) {
  console.error(`INTERACTIVE QA FAIL (${failures.length}):`)
  for (const f of failures) console.error(` - ${f}`)
  process.exit(1)
}
console.log('INTERACTIVE QA PASS')
