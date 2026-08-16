/* routes/enquiries.js */
import { createRoute, z } from '@hono/zod-openapi'
import { query, run } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { createApp, EnquiryInput, EnquirySchema, ErrorSchema, MessageSchema, SuccessSchema } from './schemas.js'

const router = createApp()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Enquiries'],
  summary: 'List customer enquiries (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.array(EnquirySchema) } },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Enquiries'],
  summary: 'Submit a customer enquiry (public)',
  request: {
    body: { content: { 'application/json': { schema: EnquiryInput } } },
  },
  responses: {
    200: { description: 'Enquiry received', content: { 'application/json': { schema: MessageSchema } } },
    400: { description: 'Name and message required', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const readRoute = createRoute({
  method: 'patch',
  path: '/{id}/read',
  tags: ['Enquiries'],
  summary: 'Mark an enquiry as read (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: 'Marked as read', content: { 'application/json': { schema: SuccessSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Enquiries'],
  summary: 'Delete an enquiry (admin)',
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
  return c.json(await query('SELECT * FROM enquiries ORDER BY created_at DESC'))
})

router.openapi(createRouteDef, async (c) => {
  const { name, phone, email, message } = c.req.valid('json')
  if (!name || !message) return c.json({ error: 'Name and message required' }, 400)
  const r = await run('INSERT INTO enquiries (name,phone,email,message) VALUES (?,?,?,?)', [name, phone || '', email || '', message])
  return c.json({ id: r.lastInsertRowid, message: 'Enquiry received' })
})

router.openapi(readRoute, async (c) => {
  await run('UPDATE enquiries SET is_read=1 WHERE id=?', [c.req.param('id')])
  return c.json({ success: true })
})

router.openapi(deleteRouteDef, async (c) => {
  await run('DELETE FROM enquiries WHERE id=?', [c.req.param('id')])
  return c.json({ success: true })
})

export default router
