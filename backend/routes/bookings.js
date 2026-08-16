/* routes/bookings.js */
import { createRoute, z } from '@hono/zod-openapi'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  BookingInput, BookingSchema, createApp, ErrorSchema, MessageSchema,
  SlotSchema, StatusInput, SuccessSchema,
} from './schemas.js'

const router = createApp()

const slotsRoute = createRoute({
  method: 'get',
  path: '/slots',
  tags: ['Bookings'],
  summary: 'Get available time slots for a chamber and date',
  request: {
    query: z.object({ chamber_id: z.string(), date: z.string() }),
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.array(SlotSchema) } },
    },
    400: { description: 'chamber_id and date required', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Bookings'],
  summary: 'List all bookings, optionally filtered by date (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    query: z.object({ date: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.array(BookingSchema) } },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Bookings'],
  summary: 'Create a new booking (public)',
  request: {
    body: { content: { 'application/json': { schema: BookingInput } } },
  },
  responses: {
    200: { description: 'Booking confirmed', content: { 'application/json': { schema: MessageSchema } } },
    400: { description: 'Missing required fields', content: { 'application/json': { schema: ErrorSchema } } },
    409: { description: 'Slot already taken', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const statusRoute = createRoute({
  method: 'patch',
  path: '/{id}/status',
  tags: ['Bookings'],
  summary: 'Update a booking status (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: StatusInput } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Invalid status', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Bookings'],
  summary: 'Delete a booking (admin)',
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

router.openapi(slotsRoute, (c) => {
  const { chamber_id, date } = c.req.valid('query')
  const taken = getDb()
    .prepare('SELECT time_slot FROM bookings WHERE chamber_id=? AND booking_date=? AND status != ?')
    .all(chamber_id, date, 'Cancelled')
    .map((b) => b.time_slot)
  return c.json(['11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:30 PM', '4:30 PM', '5:30 PM', '6:30 PM']
    .map((s) => ({ slot: s, available: !taken.includes(s) })))
})

router.openapi(listRoute, (c) => {
  const db = getDb()
  const { date } = c.req.valid('query')
  let q = 'SELECT b.*, c.name as chamber_name FROM bookings b LEFT JOIN chambers c ON b.chamber_id=c.id'
  const params = []
  if (date) {
    q += ' WHERE b.booking_date=?'
    params.push(date)
  }
  q += ' ORDER BY b.created_at DESC'
  return c.json(db.prepare(q).all(...params))
})

router.openapi(createRouteDef, (c) => {
  const { client_name, phone, email, service, chamber_id, booking_date, time_slot, notes } = c.req.valid('json')
  if (!client_name || !phone || !service || !chamber_id || !booking_date || !time_slot) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  const db = getDb()
  const conflict = db
    .prepare('SELECT id FROM bookings WHERE chamber_id=? AND booking_date=? AND time_slot=? AND status != ?')
    .get(chamber_id, booking_date, time_slot, 'Cancelled')
  if (conflict) return c.json({ error: 'Slot already taken' }, 409)
  const r = db.prepare('INSERT INTO bookings (client_name,phone,email,service,chamber_id,booking_date,time_slot,notes) VALUES (?,?,?,?,?,?,?,?)')
    .run(client_name, phone, email || '', service, chamber_id, booking_date, time_slot, notes || '')
  return c.json({ id: r.lastInsertRowid, message: 'Booking confirmed' })
})

router.openapi(statusRoute, (c) => {
  const { status } = c.req.valid('json')
  if (!['Pending', 'Confirmed', 'Cancelled'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }
  getDb().prepare('UPDATE bookings SET status=? WHERE id=?').run(status, c.req.param('id'))
  return c.json({ success: true })
})

router.openapi(deleteRouteDef, (c) => {
  getDb().prepare('DELETE FROM bookings WHERE id=?').run(c.req.param('id'))
  return c.json({ success: true })
})

export default router
