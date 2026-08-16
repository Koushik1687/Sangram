/* ==========================================================================
   routes/images.js — serves image bytes stored in the database.
   GET /api/images/:table/:id  → the image with its stored Content-Type.
   Table names are whitelisted in services/images.js (IMAGE_TABLES), so the
   SQL columns used here can never come from client input.
   ========================================================================== */
import { createRoute, z } from '@hono/zod-openapi'
import { loadImage } from '../services/images.js'
import { createApp, ErrorSchema } from './schemas.js'

const router = createApp()

const imageRoute = createRoute({
  method: 'get',
  path: '/{table}/{id}',
  tags: ['Images'],
  summary: 'Serve an image stored in the database',
  request: {
    params: z.object({ table: z.string(), id: z.string() }),
  },
  responses: {
    200: { description: 'Image bytes', content: { 'image/*': { schema: { type: 'string', format: 'binary' } } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(imageRoute, async (c) => {
  const { table, id } = c.req.valid('param')
  const img = await loadImage({ table, id })
  if (!img) return c.json({ error: 'Image not found' }, 404)
  return c.body(img.data, 200, {
    'Content-Type': img.mime,
    'Content-Length': String(img.data.length),
    'Cache-Control': 'public, max-age=86400',
  })
})

export default router
