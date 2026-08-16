// Verifies the admin bottom nav: tabs on /admin/login, view switching on
// /admin via a real login. Usage: node admin-nav-check.cjs <port> <scheme> <width> <height>
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = process.argv[2]
const scheme = process.argv[3] || 'light'
const width = Number(process.argv[4])
const height = Number(process.argv[5])
const outdir = __dirname

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
    `--remote-debugging-port=${port}`, '--user-data-dir=C:\\tmp\\admin-nav-profile', 'about:blank',
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

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { returnByValue: true, expression })
    if (r.exceptionDetails) return { exception: r.exceptionDetails.exception?.description }
    return r.result.value
  }
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(`${outdir}/${name}.png`, Buffer.from(s.data, 'base64'))
    console.log(`  shot ${name}.png`)
  }
  const navState = () => evalJs(`(() => {
    const items = [...document.querySelectorAll('.bottom-nav-item')]
    return {
      labels: items.map((el) => el.querySelector('.bottom-nav-label').textContent),
      active: items.filter((el) => el.classList.contains('active')).map((el) => el.querySelector('.bottom-nav-label').textContent),
      path: location.pathname,
      topbar: document.querySelector('.admin-topbar h1')?.textContent || null,
    }
  })()`)

  await send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'prefers-color-scheme', value: scheme }],
  })
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: true,
  })
  await send('Page.enable')

  // --- 1. Admin login page ---
  await send('Page.navigate', { url: 'http://localhost:5173/admin/login' })
  await new Promise((r) => setTimeout(r, 5000))
  console.log('== /admin/login ==')
  console.log(JSON.stringify(await navState()))
  await shot(`admin-nav-login-${scheme}`)

  // --- 2. Real login ---
  await evalJs(`document.getElementById('user').value = 'admin'; document.getElementById('pass').value = 'admin123'; document.getElementById('loginForm').requestSubmit(); undefined`)
  await new Promise((r) => setTimeout(r, 6000))
  console.log('== after login (dashboard) ==')
  console.log(JSON.stringify(await navState()))
  await shot(`admin-nav-dash-${scheme}`)

  // --- 3. Switch to Orders via bottom nav ---
  await evalJs(`[...document.querySelectorAll('.bottom-nav-item')].find((el) => el.querySelector('.bottom-nav-label').textContent === 'Orders').click(); undefined`)
  await new Promise((r) => setTimeout(r, 1500))
  console.log('== clicked Orders tab ==')
  console.log(JSON.stringify(await navState()))

  // --- 4. Switch to Products ---
  await evalJs(`[...document.querySelectorAll('.bottom-nav-item')].find((el) => el.querySelector('.bottom-nav-label').textContent === 'Products').click(); undefined`)
  await new Promise((r) => setTimeout(r, 1500))
  console.log('== clicked Products tab ==')
  console.log(JSON.stringify(await navState()))
  await shot(`admin-nav-products-${scheme}`)

  // --- 5. View Site link ---
  await evalJs(`[...document.querySelectorAll('.bottom-nav-item')].find((el) => el.querySelector('.bottom-nav-label').textContent === 'View Site').click(); undefined`)
  await new Promise((r) => setTimeout(r, 3000))
  console.log('== clicked View Site ==')
  console.log(JSON.stringify(await navState()))

  ws.close()
  chrome.kill()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
