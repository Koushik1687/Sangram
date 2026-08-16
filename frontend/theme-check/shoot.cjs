// Drives headless Chrome over CDP: forces prefers-color-scheme:light,
// navigates each route, waits for render, saves a PNG screenshot.
// Usage: node shoot.js <port> <outdir> <url1> <name1> [<url2> <name2> ...]
const { spawn } = require('child_process')
const fs = require('fs')
const http = require('http')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const port = process.argv[2]
const outdir = process.argv[3]
const width = Number(process.argv[4] || 1440)
const height = Number(process.argv[5] || 900)
const scheme = process.argv[6] || 'light'
const targets = []
for (let i = 7; i < process.argv.length; i += 2) targets.push({ url: process.argv[i], name: process.argv[i + 1] })

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
    `--remote-debugging-port=${port}`, '--user-data-dir=C:\\tmp\\shoot-profile', 'about:blank',
  ], { stdio: 'ignore' })

  // wait for the debugger endpoint
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
    width, height, deviceScaleFactor: 1, mobile: width < 600,
  })
  await send('Page.enable')

  for (const t of targets) {
    await send('Page.navigate', { url: t.url })
    // wait for load event + render settle
    await new Promise((r) => setTimeout(r, 6000))
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(`${outdir}/${t.name}.png`, Buffer.from(shot.data, 'base64'))
    console.log(`${t.name}: ${Buffer.from(shot.data, 'base64').length} bytes`)
  }
  ws.close()
  chrome.kill()
}

main().catch((e) => { console.error(e.message); process.exit(1) })
