// Reviews the bottom nav at real mobile widths over CDP:
//   - forces prefers-color-scheme (light/dark)
//   - sets device metrics (mobile:true)
//   - measures nav bar + item + icon + label geometry and computed styles
//   - saves a screenshot per width
// Usage: node nav-review.cjs <debugPort> <outdir> <scheme> <width> <height> <url>
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = process.argv[2]
const outdir = process.argv[3]
const scheme = process.argv[4] || 'light'
const width = Number(process.argv[5])
const height = Number(process.argv[6])
const url = process.argv[7]

function getJson(path) {
  return new Promise((res, rej) => {
    http.get({ host: 'localhost', port, path }, (r) => {
      let b = ''
      r.on('data', (c) => (b += c))
      r.on('end', () => res(JSON.parse(b)))
    }).on('error', rej)
  })
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, '--user-data-dir=C:\\tmp\\nav-review-profile', 'about:blank',
  ], { stdio: 'ignore' })

  let list = []
  for (let i = 0; i < 40; i++) {
    try { list = await getJson('/json'); if (list.length) break } catch (e) {}
    await new Promise((r) => setTimeout(r, 250))
  }
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++id
      pending.set(mid, { res, rej })
      ws.send(JSON.stringify({ id: mid, method, params }))
    })

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.rej(new Error(msg.error.message))
      else p.res(msg.result)
    }
  }
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  await send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'prefers-color-scheme', value: scheme }],
  })
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: true,
  })
  await send('Page.enable')
  await send('Page.navigate', { url })
  await new Promise((r) => setTimeout(r, 6500))

  const evalJs = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const nav = document.querySelector('.bottom-nav')
      if (!nav) return { error: 'no .bottom-nav' }
      const nr = nav.getBoundingClientRect()
      const items = [...nav.querySelectorAll('.bottom-nav-item')].map((el) => {
        const r = el.getBoundingClientRect()
        const icon = el.querySelector('.bottom-nav-icon')
        const label = el.querySelector('.bottom-nav-label')
        const ir = icon.getBoundingClientRect()
        const lr = label.getBoundingClientRect()
        const cs = getComputedStyle(el)
        const lcs = getComputedStyle(label)
        return {
          label: label.textContent,
          x: Math.round(r.x), w: Math.round(r.width),
          iconBox: ir.width.toFixed(1) + 'x' + ir.height.toFixed(1),
          labelFont: lcs.fontSize,
          labelW: Math.round(lr.width),
          labelOverflow: label.scrollWidth > label.clientWidth,
          gap: (lr.top - ir.bottom).toFixed(1),
          labelBottom: Math.round(${height} - lr.bottom),
          active: el.classList.contains('active'),
        }
      })
      const ind = nav.querySelector('.bottom-nav-indicator').getBoundingClientRect()
      const indCS = getComputedStyle(nav.querySelector('.bottom-nav-indicator'))
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        barH: Math.round(nr.height),
        items,
        indicator: { w: Math.round(ind.width), bottom: Math.round(${height} - ind.bottom), top: Math.round(${height} - ind.top) },
        indicatorColor: indCS.backgroundColor,
      }
    })()`,
  })
  if (evalJs.exceptionDetails) {
    console.log('EVAL EXCEPTION:', JSON.stringify(evalJs.exceptionDetails, null, 2))
  } else {
    console.log(JSON.stringify(evalJs.result.value, null, 2))
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const buf = Buffer.from(shot.data, 'base64')
  fs.writeFileSync(`${outdir}/nav-${scheme}-${width}.png`, buf)
  console.log(`screenshot: ${buf.length} bytes`)

  ws.close()
  chrome.kill()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
