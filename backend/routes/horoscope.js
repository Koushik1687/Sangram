/* routes/horoscope.js */
import { createRoute, z } from '@hono/zod-openapi'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { createApp, ErrorSchema, HoroscopeOverrideInput, HoroscopeOverrideSchema, SuccessSchema } from './schemas.js'

const router = createApp()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Horoscope'],
  summary: 'Get admin-set horoscope overrides for a date',
  request: {
    query: z.object({ date: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.array(HoroscopeOverrideSchema) } },
    },
  },
})

const updateRouteDef = createRoute({
  method: 'put',
  path: '/{sign}',
  tags: ['Horoscope'],
  summary: 'Set a horoscope override for a sign on a date (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ sign: z.string() }),
    body: { content: { 'application/json': { schema: HoroscopeOverrideInput } } },
  },
  responses: {
    200: { description: 'Saved', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(listRoute, (c) => {
  const { date } = c.req.valid('query')
  const d = date || new Date().toISOString().slice(0, 10)
  return c.json(getDb().prepare('SELECT * FROM horoscope_custom WHERE reading_date=?').all(d))
})

router.openapi(updateRouteDef, (c) => {
  const { reading_date, message, lucky_color, lucky_number, mood } = c.req.valid('json')
  const db = getDb()
  db.prepare(`INSERT INTO horoscope_custom (zodiac_sign,reading_date,message,lucky_color,lucky_number,mood)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(zodiac_sign,reading_date) DO UPDATE SET message=excluded.message,lucky_color=excluded.lucky_color,lucky_number=excluded.lucky_number,mood=excluded.mood`)
    .run(c.req.param('sign'), reading_date, message, lucky_color, lucky_number, mood)
  return c.json({ success: true })
})

export default router
