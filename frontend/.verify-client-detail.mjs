import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9226
const URL = 'http://localhost:5174/admin/login'
const PROFILE = 'C:\\Temp\\chrome-admin-detail-profile'

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1400,900', URL,
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getPage() {
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page' && t.url.includes('localhost:5174'))
      if (page) return page
    } catch { /* retry */ }
    await sleep(500)
  }
  throw new Error('Chrome DevTools not reachable')
}

const page = await getPage()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
}
function send(method, params = {}) {
  return new Promise((resolve) => {
    const mid = ++id
    pending.set(mid, resolve)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return r.result?.result?.value
}

await send('Runtime.enable')
await send('Page.enable')
await sleep(3500)

await evalJs(`document.querySelector('#user').value = 'admin'; document.querySelector('#pass').value = 'admin123'; document.querySelector('#loginForm').requestSubmit(); true`)
await sleep(2500)
await evalJs(`document.querySelector('[data-view="clients"]').click(); true`)
await sleep(1500)

// Expand the row for the test client
const expanded = await evalJs(`(() => {
  const rows = [...document.querySelectorAll('#view-clients tbody tr')]
  const row = rows.find(r => r.textContent.includes('Detail Test Client'))
  if (!row) return 'CLIENT ROW NOT FOUND'
  row.querySelector('.client-toggle').click()
  return 'clicked'
})()`)
await sleep(800)

const result = await evalJs(`JSON.stringify((() => {
  const detail = document.querySelector('.client-detail-row')
  if (!detail) return { error: 'no detail row' }
  return {
    headings: [...detail.querySelectorAll('.client-detail-col h4')].map(h => h.textContent),
    appointments: [...detail.querySelectorAll('.client-detail-col:first-child .client-detail-list li')].map(li => li.textContent.replace(/\\s+/g, ' ').trim()),
    orders: [...detail.querySelectorAll('.client-detail-col:last-child .client-detail-list li')].map(li => li.textContent.replace(/\\s+/g, ' ').trim()),
  }
})())`)
console.log('expanded:', expanded)
console.log('detail:', result)

ws.close()
chrome.kill()
process.exit(0)
