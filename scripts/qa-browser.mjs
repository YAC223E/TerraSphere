// Headless render QA (Phase 11 seed): loads the production build in system
// Chrome (SwiftShader WebGL), fails on console errors / page errors, captures
// screenshots + DOM assertions (LOD badge, Africa PASS, canvas non-black).
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = 5199
const SHOTS = 'qa/screenshots'
mkdirSync(SHOTS, { recursive: true })

function startPreview() {
  const child = spawn('npm', ['run', 'preview', '--', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return child
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/`)
      if (r.ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('preview server never came up')
}

const failures = []
const preview = startPreview()
try {
  await waitForServer()
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--window-size=1440,900',
      '--hide-scrollbars',
    ],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    page.on('console', (m) => {
      if (m.type() === 'error') failures.push(`console.error: ${m.text().slice(0, 300)}`)
    })
    page.on('pageerror', (e) => failures.push(`pageerror: ${String(e?.stack ?? e).slice(0, 500)}`))
    page.on('requestfailed', (r) => {
      failures.push(`requestfailed: ${r.url().slice(0, 200)} :: ${r.failure()?.errorText ?? ''}`)
    })
    page.on('response', (r) => {
      if (r.status() >= 400) failures.push(`http-${r.status()}: ${r.url().slice(0, 200)}`)
    })

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2', timeout: 90000 })
    // Cesium + vectors need time under software GL.
    await page.waitForFunction(() => document.querySelector('.globe-container canvas') != null, {
      timeout: 60000,
    })
    const hasCanvas = await page.evaluate(() => document.querySelector('.globe-container canvas') != null)
    if (!hasCanvas) failures.push('no globe canvas rendered')
    await new Promise((r) => setTimeout(r, 15000))

    // NOTE: WebGL canvas readback via drawImage is blank without
    // preserveDrawingBuffer (not an app bug) — analyze the compositor
    // screenshot instead.
    const shot = await page.screenshot({ encoding: 'base64' })
    writeFileSync(`${SHOTS}/global.png`, Buffer.from(shot, 'base64'))
    console.log(`screenshot: ${SHOTS}/global.png`)
    const shotInfo = await page.evaluate(async (b64) => {
      const img = new Image()
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
        img.src = `data:image/png;base64,${b64}`
      })
      const c = document.createElement('canvas')
      c.width = 96
      c.height = 60
      const ctx = c.getContext('2d')
      if (!ctx) return { sample: false }
      ctx.drawImage(img, 0, 0, 96, 60)
      const d = ctx.getImageData(0, 0, 96, 60).data
      let lit = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] + d[i + 1] + d[i + 2] > 30) lit++
      }
      return { sample: true, litFraction: lit / (96 * 60) }
    }, shot)
    console.log('screenshot:', JSON.stringify(shotInfo))
    if (!shotInfo.sample) failures.push('screenshot analysis failed')
    if ((shotInfo.litFraction ?? 0) < 0.1) {
      failures.push(`render effectively dark (lit=${shotInfo.litFraction})`)
    }

    const dom = await page.evaluate(() => {
      const txt = document.getElementById('root')?.textContent ?? ''
      return {
        lod: txt.match(/vectors: Natural Earth LOD \[[^\]]+\]/)?.[0] ?? null,
        africaPass: /PASS/.test(txt),
        africaNumbers: txt.match(/Dataset [\d,]+ km²/)?.[0] ?? null,
        webgl2: (() => {
          try {
            return !!document.createElement('canvas').getContext('webgl2')
          } catch {
            return false
          }
        })(),
      }
    })
    console.log('dom:', JSON.stringify(dom))
    if (!dom.lod) failures.push('LOD badge missing from HUD')
    if (!dom.africaPass) failures.push('Africa PASS verdict missing')
    if (!dom.webgl2) failures.push('WebGL2 unavailable in headless Chrome')

    // Acceptance §37: fly to Africa, confirm LOD refines and capture close-up.
    const flyClicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Fly to Africa'),
      )
      if (btn) {
        btn.click()
        return true
      }
      return false
    })
    if (!flyClicked) failures.push('Fly to Africa button missing')
    await new Promise((r) => setTimeout(r, 9000))
    const africaShot = await page.screenshot({ encoding: 'base64' })
    writeFileSync(`${SHOTS}/africa.png`, Buffer.from(africaShot, 'base64'))
    console.log(`screenshot: ${SHOTS}/africa.png`)
    const africaLod = await page.evaluate(
      () => document.getElementById('root')?.textContent?.match(/LOD \[([^\]]+)\]/)?.[1] ?? null,
    )
    console.log('africa lod:', africaLod)
    if (africaLod !== '50m') failures.push(`Africa LOD did not refine to 50m (got ${africaLod})`)
    const africaLit = await page.evaluate(async (b64) => {
      const img = new Image()
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
        img.src = `data:image/png;base64,${b64}`
      })
      const c = document.createElement('canvas')
      c.width = 96
      c.height = 60
      const ctx = c.getContext('2d')
      if (!ctx) return 0
      ctx.drawImage(img, 0, 0, 96, 60)
      const d = ctx.getImageData(0, 0, 96, 60).data
      let lit = 0
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] + d[i + 1] + d[i + 2] > 30) lit++
      }
      return lit / (96 * 60)
    }, africaShot)
    console.log('africa lit:', africaLit.toFixed(3))
    if (africaLit < 0.1) failures.push('Africa close-up effectively dark')
  } finally {
    await browser.close()
  }
} finally {
  preview.kill('SIGKILL')
}

if (failures.length > 0) {
  console.error(`QA FAIL (${failures.length}):`)
  for (const f of failures) console.error(` - ${f}`)
  process.exit(1)
}
console.log('QA PASS: render + DOM + no local errors')
