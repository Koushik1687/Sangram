/* routes/testimonials.js */
import { createRoute, z } from '@hono/zod-openapi'
import { query, run } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { createApp, ErrorSchema, SuccessSchema, TestimonialInput, TestimonialSchema } from './schemas.js'

const router = createApp()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Testimonials'],
  summary: 'List approved testimonials',
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.array(TestimonialSchema) } },
    },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Testimonials'],
  summary: 'Add a testimonial (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    body: { content: { 'application/json': { schema: TestimonialInput } } },
  },
  responses: {
    200: { description: 'Created testimonial', content: { 'application/json': { schema: TestimonialSchema } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Testimonials'],
  summary: 'Unapprove a testimonial (admin)',
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
  return c.json(await query('SELECT * FROM testimonials WHERE is_approved=1 ORDER BY id'))
})

router.openapi(createRouteDef, async (c) => {
  const { client_name, role_location, rating, message } = c.req.valid('json')
  const r = await run('INSERT INTO testimonials (client_name,role_location,rating,message) VALUES (?,?,?,?)',
    [client_name, role_location, rating, message])
  return c.json({ id: r.lastInsertRowid, client_name, role_location, rating, message })
})

router.openapi(deleteRouteDef, async (c) => {
  await run('UPDATE testimonials SET is_approved=0 WHERE id=?', [c.req.param('id')])
  return c.json({ success: true })
})

export default router
