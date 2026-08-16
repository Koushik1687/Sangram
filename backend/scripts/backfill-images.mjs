#!/usr/bin/env node
/* ==========================================================================
   scripts/backfill-images.mjs — import image files from the old local
   uploads/ folder into the database (BYTEA), matching sanitised filenames
   against product names.

   Usage (from the backend/ directory):  node scripts/backfill-images.mjs
   ========================================================================== */
import 'dotenv/config'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { initDb, query, run } from '../db/database.js'
import { guessMime } from '../services/images.js'

await initDb() // applies the BYTEA column migrations first

const uploadsDir = path.join(import.meta.dirname, '..', 'uploads')
const normalize = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

const files = readdirSync(uploadsDir).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
const products = await query('SELECT id, name FROM products')

let stored = 0
const skipped = []
for (const file of files) {
  const key = normalize(file.replace(/^\d+-/, '').replace(/\.[^.]+$/, ''))
  const product = products.find((p) => normalize(p.name) === key)
  if (!product) {
    skipped.push(file)
    continue
  }
  const buffer = readFileSync(path.join(uploadsDir, file))
  const url = `/api/images/products/${product.id}?v=${Date.now()}`
  await run(
    'UPDATE products SET image_url = ?, image_data = ?, image_mime = ? WHERE id = ?',
    [url, buffer, guessMime(file), product.id],
  )
  stored += 1
  console.log(`✓  ${product.name}  ←  ${file}`)
}

console.log('')
console.log(`Stored ${stored} product image(s) in the database.`)
if (skipped.length) console.log(`Skipped (no matching product): ${skipped.join(', ')}`)
process.exit(0)
