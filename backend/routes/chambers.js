/* routes/chambers.js */
import { createRoute, z } from '@hono/zod-openapi'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { ChamberInput, ChamberSchema, createApp, ErrorSchema, SuccessSchema } from './schemas.js'

const router = createApp()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Chambers'],
  summary: 'List consultation chambers',
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: z.array(ChamberSchema) } } },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Chambers'],
  summary: 'Create a chamber (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    body: { content: { 'application/json': { schema: ChamberInput } } },
  },
  responses: {
    200: { description: 'Created chamber', content: { 'application/json': { schema: ChamberSchema } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const updateRouteDef = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Chambers'],
  summary: 'Update a chamber (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ChamberInput } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Chambers'],
  summary: 'Delete a chamber (admin)',
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

router.openapi(listRoute, (c) => {
  return c.json(getDb().prepare('SELECT * FROM chambers ORDER BY id').all())
})

router.openapi(createRouteDef, (c) => {
  const { name, address, consultation_days, timing, phone, map_url } = c.req.valid('json')
  const db = getDb()
  const r = db.prepare('INSERT INTO chambers (name,address,consultation_days,timing,phone,map_url) VALUES (?,?,?,?,?,?)')
    .run(name, address, consultation_days, timing, phone, map_url || '')
  return c.json({ id: r.lastInsertRowid, name, address, consultation_days, timing, phone })
})

router.openapi(updateRouteDef, (c) => {
  const { name, address, consultation_days, timing, phone, map_url } = c.req.valid('json')
  getDb().prepare('UPDATE chambers SET name=?,address=?,consultation_days=?,timing=?,phone=?,map_url=? WHERE id=?')
    .run(name, address, consultation_days, timing, phone, map_url || '', c.req.param('id'))
  return c.json({ success: true })
})

router.openapi(deleteRouteDef, (c) => {
  getDb().prepare('DELETE FROM chambers WHERE id=?').run(c.req.param('id'))
  return c.json({ success: true })
})

export default router
