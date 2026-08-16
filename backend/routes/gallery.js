/* routes/gallery.js */
import { createRoute, z } from '@hono/zod-openapi'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { query, run } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { createApp, ErrorSchema, GalleryInput, GalleryItemSchema, SuccessSchema } from './schemas.js'

const router = createApp()

const uploadDir = path.join(import.meta.dirname, '..', 'uploads')
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true })

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Gallery'],
  summary: 'List gallery items',
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.array(GalleryItemSchema) } },
    },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Gallery'],
  summary: 'Add a gallery item with an optional image upload (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    body: {
      content: { 'multipart/form-data': { schema: GalleryInput } },
    },
  },
  responses: {
    200: { description: 'Created gallery item', content: { 'application/json': { schema: GalleryItemSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Gallery'],
  summary: 'Delete a gallery item (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(listRoute, async (c) => {
  return c.json(await query('SELECT * FROM gallery ORDER BY uploaded_at DESC'))
})

router.openapi(createRouteDef, async (c) => {
  const { label, category, image } = c.req.valid('form')

  let imageUrl = ''
  if (image && typeof image !== 'string' && image.name) {
    const filename = `${Date.now()}-${image.name.replace(/\s+/g, '_')}`
    writeFileSync(path.join(uploadDir, filename), Buffer.from(await image.arrayBuffer()))
    imageUrl = `/uploads/${filename}`
  }

  const r = await run('INSERT INTO gallery (label,image_url,category) VALUES (?,?,?)', [label, imageUrl, category || ''])
  return c.json({ id: r.lastInsertRowid, label, image_url: imageUrl, category })
})

router.openapi(deleteRouteDef, async (c) => {
  await run('DELETE FROM gallery WHERE id=?', [c.req.param('id')])
  return c.json({ success: true })
})

export default router
