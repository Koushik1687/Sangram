/* ==========================================================================
   routes/notifications.js — on-demand daily sales digest (admin).
   The daily scheduler in server.js runs the same logic automatically;
   this endpoint lets the admin send it early or re-test a given date.
   ========================================================================== */
import { createRoute, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth.js'
import { buildDailyStats, runDailyDigest, yesterdayStr } from '../services/salesDigest.js'
import { createApp, ErrorSchema, SuccessSchema } from './schemas.js'

const router = createApp()

const digestRoute = createRoute({
  method: 'post',
  path: '/digest',
  tags: ['Notifications'],
  summary: 'Send the daily sales digest email for a date (admin) — defaults to yesterday',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            date: z.string().optional().openapi({ example: '2026-08-13' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Digest sent or skipped',
      content: { 'application/json': { schema: z.object({ success: z.boolean(), sent: z.boolean(), stats: z.any() }) } },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(digestRoute, async (c) => {
  const { date } = c.req.valid('json')
  const target = date || yesterdayStr()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    return c.json({ error: 'Invalid date — expected YYYY-MM-DD' }, 400)
  }
  const { sent, stats } = await runDailyDigest(target)
  return c.json({ success: true, sent, stats })
})

export default router
