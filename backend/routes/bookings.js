/* routes/bookings.js */
import { createRoute, z } from '@hono/zod-openapi'
import { get, query, run } from '../db/database.js'
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

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null
  const m = timeStr.trim().match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/i)
  if (!m) return null
  let hours = parseInt(m[1], 10)
  const minutes = m[2] ? parseInt(m[2], 10) : 0
  const meridian = m[3] ? m[3].toUpperCase() : (hours < 8 ? 'PM' : 'AM')

  if (meridian === 'PM' && hours < 12) hours += 12
  if (meridian === 'AM' && hours === 12) hours = 0

  return hours * 60 + minutes
}

function minutesToTimeString(totalMinutes) {
  let hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const meridian = hours >= 12 ? 'PM' : 'AM'

  hours = hours % 12
  if (hours === 0) hours = 12

  const minStr = minutes === 0 ? '00' : String(minutes).padStart(2, '0')
  return `${hours}:${minStr} ${meridian}`
}

function generateSlotsFromTiming(timingStr, stepMinutes = 60) {
  const DEFAULT_SLOTS = ['11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:30 PM', '4:30 PM', '5:30 PM', '6:30 PM']
  if (!timingStr) return DEFAULT_SLOTS

  const parts = timingStr.split(/[–\-—]| to /i).map((s) => s.trim()).filter(Boolean)
  if (parts.length < 2) return DEFAULT_SLOTS

  let startMin = parseTimeToMinutes(parts[0])
  let endMin = parseTimeToMinutes(parts[1])
  if (startMin == null || endMin == null) return DEFAULT_SLOTS

  if (endMin < startMin) endMin += 12 * 60

  const slots = []
  for (let m = startMin; m <= endMin; m += stepMinutes) {
    slots.push(minutesToTimeString(m))
  }

  return slots.length > 0 ? slots : DEFAULT_SLOTS
}

router.openapi(slotsRoute, async (c) => {
  const { chamber_id, date } = c.req.valid('query')
  let chamber = null
  if (chamber_id) {
    chamber = await get('SELECT id, name, timing, consultation_days FROM chambers WHERE id = ?', [chamber_id])
  }
  const allSlots = generateSlotsFromTiming(chamber?.timing)
  const taken = (await query('SELECT time_slot FROM bookings WHERE chamber_id=? AND booking_date=? AND status != ?', [chamber_id, date, 'Cancelled']))
    .map((b) => b.time_slot)
  return c.json(allSlots.map((s) => ({ slot: s, available: !taken.includes(s) })))
})

router.openapi(listRoute, async (c) => {
  const { date } = c.req.valid('query')
  let q = 'SELECT b.*, c.name as chamber_name FROM bookings b LEFT JOIN chambers c ON b.chamber_id=c.id'
  const params = []
  if (date) {
    q += ' WHERE b.booking_date=?'
    params.push(date)
  }
  q += ' ORDER BY b.created_at DESC'
  return c.json(await query(q, params))
})

router.openapi(createRouteDef, async (c) => {
  const { client_name, phone, email, service, chamber_id, booking_date, time_slot, notes } = c.req.valid('json')
  if (!client_name || !phone || !service || !chamber_id || !booking_date || !time_slot) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  const conflict = await get('SELECT id FROM bookings WHERE chamber_id=? AND booking_date=? AND time_slot=? AND status != ?',
    [chamber_id, booking_date, time_slot, 'Cancelled'])
  if (conflict) return c.json({ error: 'Slot already taken' }, 409)
  const r = await run('INSERT INTO bookings (client_name,phone,email,service,chamber_id,booking_date,time_slot,notes) VALUES (?,?,?,?,?,?,?,?)',
    [client_name, phone, email || '', service, chamber_id, booking_date, time_slot, notes || ''])
  return c.json({ id: r.lastInsertRowid, message: 'Booking confirmed' })
})

router.openapi(statusRoute, async (c) => {
  const { status } = c.req.valid('json')
  if (!['Pending', 'Confirmed', 'Cancelled'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }
  await run('UPDATE bookings SET status=? WHERE id=?', [status, c.req.param('id')])
  return c.json({ success: true })
})

router.openapi(deleteRouteDef, async (c) => {
  await run('DELETE FROM bookings WHERE id=?', [c.req.param('id')])
  return c.json({ success: true })
})

export default router
