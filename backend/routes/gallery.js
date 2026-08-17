/* routes/gallery.js */
import { createRoute, z } from '@hono/zod-openapi'
import { query, run } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { storeImage } from '../services/images.js'
import { createApp, ErrorSchema, GalleryInput, GalleryItemSchema, SuccessSchema } from './schemas.js'

const router = createApp()

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
  // image_data (BYTEA) is served on demand via /api/images/gallery/:id
  return c.json(await query('SELECT id, label, image_url, category, uploaded_at FROM gallery ORDER BY uploaded_at DESC'))
})

router.openapi(createRouteDef, async (c) => {
  const { label, category, image } = c.req.valid('form')

  const r = await run('INSERT INTO gallery (label,image_url,category) VALUES (?,?,?)', [label, '', category || ''])
  const id = r.lastInsertRowid

  let imageUrl = ''
  if (image && typeof image !== 'string' && image.name) {
    imageUrl = await storeImage({ table: 'gallery', id, file: image })
  }

  return c.json({ id, label, image_url: imageUrl, category })
})

router.openapi(deleteRouteDef, async (c) => {
  await run('DELETE FROM gallery WHERE id=?', [c.req.param('id')])
  return c.json({ success: true })
})

export default router
