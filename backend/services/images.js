/* ==========================================================================
   services/images.js — image bytes are stored in the database (BYTEA) and
   served back through GET /api/images/:table/:id, because serverless
   filesystems (Vercel) are ephemeral. image_url / photo_url columns keep a
   short URL like /api/images/products/5?v=... for backward compatibility
   with external URLs (https://... stays untouched).
   ========================================================================== */
import { get, run } from '../db/database.js'

/* Table → column mapping. Keys are the only tables that can be addressed
   through the public image route (whitelist — no dynamic SQL from clients). */
export const IMAGE_TABLES = {
  products: { urlCol: 'image_url', dataCol: 'image_data', mimeCol: 'image_mime' },
  gallery: { urlCol: 'image_url', dataCol: 'image_data', mimeCol: 'image_mime' },
  users: { urlCol: 'photo_url', dataCol: 'photo_data', mimeCol: 'photo_mime' },
}

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
}

export function guessMime(filename = '') {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

/**
 * Persist an uploaded image (File from a multipart request) into the given
 * table row and return the public URL. A previous /uploads/… URL is cleared
 * so rows never point at the ephemeral filesystem again.
 */
export async function storeImage({ table, id, file }) {
  const cfg = IMAGE_TABLES[table]
  if (!cfg) throw new Error(`Unknown image table: ${table}`)

  const buffer = Buffer.from(await file.arrayBuffer())
  const mime = file.type || guessMime(file.name)
  const url = `/api/images/${table}/${id}?v=${Date.now()}`

  await run(
    `UPDATE ${table} SET ${cfg.urlCol} = ?, ${cfg.dataCol} = ?, ${cfg.mimeCol} = ? WHERE id = ?`,
    [url, buffer, mime, id],
  )
  return url
}

/** Load the stored bytes + mime for a row, or null. */
export async function loadImage({ table, id }) {
  const cfg = IMAGE_TABLES[table]
  if (!cfg) return null
  const row = await get(
    `SELECT ${cfg.dataCol} AS data, ${cfg.mimeCol} AS mime FROM ${table} WHERE id = ?`,
    [id],
  )
  if (!row || !row.data) return null
  return { data: row.data, mime: row.mime || 'application/octet-stream' }
}
