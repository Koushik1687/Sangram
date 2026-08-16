/* ==========================================================================
   scripts/generate-openapi.mjs
   Regenerates the committed openapi.yaml from the live @hono/zod-openapi
   route definitions. Run with:  npm run generate:openapi
   ========================================================================== */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dump } from 'js-yaml'
import { app } from '../server.js'

const res = await app.request('/api/spec')
const spec = await res.json()

const outPath = fileURLToPath(new URL('../openapi.yaml', import.meta.url))
writeFileSync(outPath, dump(spec, { lineWidth: 120 }))

const pathCount = Object.keys(spec.paths || {}).length
console.log(`✅  openapi.yaml written (${pathCount} paths) → ${outPath}`)
