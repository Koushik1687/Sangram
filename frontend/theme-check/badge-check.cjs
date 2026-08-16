// Seeds the cart via localStorage, reloads, verifies the Shop-tab badge,
// and saves a screenshot. Usage: node badge-check.cjs <port> <outdir> <scheme> <width> <height>
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = process.argv[2]
const outdir = process.argv[3]
const scheme = process.argv[4] || 'light'
const width = Number(process.argv[5])
const height = Number(process.argv[6])

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
    `--remote-debugging-port=${port}`, '--user-data-dir=C:\\tmp\\badge-check-profile', 'about:blank',
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
  await send('Page.navigate', { url: 'http://localhost:5173/' })
  await new Promise((r) => setTimeout(r, 5000))

  // seed the cart (2 distinct items, qty 3 + 1)
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('ss_cart', JSON.stringify([
      { product: { id: 1, name: 'Test Item', price: 299, img: '' }, quantity: 3 },
      { product: { id: 2, name: 'Another', price: 199, img: '' }, quantity: 1 }
    ]))`,
  })
  await send('Page.reload')
  await new Promise((r) => setTimeout(r, 5000))

  const evalJs = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const badge = document.querySelector('.bottom-nav-item .bottom-nav-badge')
      const shop = [...document.querySelectorAll('.bottom-nav-item')].find((el) => el.querySelector('.bottom-nav-label')?.textContent === 'Shop')
      const br = badge ? badge.getBoundingClientRect() : null
      const ir = shop ? shop.querySelector('.bottom-nav-icon').getBoundingClientRect() : null
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        badgeExists: !!badge,
        badgeText: badge ? badge.textContent : null,
        badgeBox: br ? br.width.toFixed(1) + 'x' + br.height.toFixed(1) : null,
        badgePos: br && ir ? { dx: Math.round(br.left - ir.left), dy: Math.round(br.top - ir.top) } : null,
      }
    })()`,
  })
  if (evalJs.exceptionDetails) console.log('EXC:', JSON.stringify(evalJs.exceptionDetails))
  else console.log(JSON.stringify(evalJs.result.value, null, 2))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const buf = Buffer.from(shot.data, 'base64')
  fs.writeFileSync(`${outdir}/badge-${scheme}-${width}.png`, buf)
  console.log(`screenshot: ${buf.length} bytes`)

  ws.close()
  chrome.kill()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
