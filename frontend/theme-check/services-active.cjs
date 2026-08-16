// Scrolls the home page through the services section and reports which
// bottom-nav tabs are active at each position.
// Usage: node services-active.cjs <port> <scheme> <width> <height>
const { spawn } = require('child_process')
const http = require('http')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = process.argv[2]
const scheme = process.argv[3] || 'light'
const width = Number(process.argv[4])
const height = Number(process.argv[5])

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
    `--remote-debugging-port=${port}`, '--user-data-dir=C:\\tmp\\services-active-profile', 'about:blank',
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

  const report = async (label) => {
    const r = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const items = [...document.querySelectorAll('.bottom-nav-item')]
        const active = items.filter((el) => el.classList.contains('active')).map((el) => el.querySelector('.bottom-nav-label').textContent)
        const sec = document.getElementById('services')
        const sr = sec ? sec.getBoundingClientRect() : null
        return { label: ${JSON.stringify(label)}, active, scrollY: Math.round(scrollY), servicesTop: sr ? Math.round(sr.top) : null, servicesBottom: sr ? Math.round(sr.bottom) : null }
      })()`,
    })
    console.log(JSON.stringify(r.result.value))
  }

  // top of page
  await report('top')
  // scroll into services (its top ~25% down the viewport)
  await send('Runtime.evaluate', { expression: `document.getElementById('services').scrollIntoView({ block: 'start' }); undefined` })
  await new Promise((r) => setTimeout(r, 1200))
  await report('services start (scrolled)')
  // scroll further into the middle of the section
  await send('Runtime.evaluate', { expression: `window.scrollBy(0, 600); undefined` })
  await new Promise((r) => setTimeout(r, 800))
  await report('services middle')
  // scroll to the bottom of the page (past services)
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, document.body.scrollHeight); undefined` })
  await new Promise((r) => setTimeout(r, 800))
  await report('page bottom')
  // back to top
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, 0); undefined` })
  await new Promise((r) => setTimeout(r, 800))
  await report('back to top')

  ws.close()
  chrome.kill()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
