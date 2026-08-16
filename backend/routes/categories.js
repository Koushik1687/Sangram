/* ==========================================================================
   routes/categories.js — shop category management.
   Categories are a flat table with parent_id for sub-categories; products
   reference a category by NAME (product.category stays a plain string).
   ========================================================================== */
import { createRoute, z } from '@hono/zod-openapi'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { createApp, ErrorSchema, SuccessSchema } from './schemas.js'

const router = createApp()

const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  parent_id: z.number().nullable().optional(),
  product_count: z.number().optional(),
  created_at: z.string().optional(),
}).passthrough().openapi('Category')

const CategoryInput = z.object({
  name: z.string().min(1).max(60).openapi({ example: 'Healing Crystals' }),
  parent_id: z.number().nullable().optional().openapi({ example: 1 }),
}).openapi('CategoryInput')

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Categories'],
  summary: 'List all categories with product counts',
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: z.array(CategorySchema) } } },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Categories'],
  summary: 'Create a category or sub-category (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: { body: { content: { 'application/json': { schema: CategoryInput } } } },
  responses: {
    200: { description: 'Created', content: { 'application/json': { schema: CategorySchema } } },
    400: { description: 'Name taken or bad parent', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Categories'],
  summary: 'Delete a category and its sub-categories (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Missing category', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(listRoute, (c) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT c.id, c.name, c.parent_id, c.created_at,
      (SELECT COUNT(*) FROM products p WHERE p.category = c.name) AS product_count
    FROM categories c
    ORDER BY (c.parent_id IS NOT NULL), c.name COLLATE NOCASE
  `).all()
  return c.json(rows)
})

router.openapi(createRouteDef, (c) => {
  const v = c.req.valid('json')
  const db = getDb()
  const name = v.name.trim()
  if (!name) return c.json({ error: 'Category name is required' }, 400)
  if (db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE').get(name)) {
    return c.json({ error: `A category named "${name}" already exists` }, 400)
  }
  if (v.parent_id) {
    const parent = db.prepare('SELECT id FROM categories WHERE id = ?').get(v.parent_id)
    if (!parent) return c.json({ error: 'Parent category not found' }, 400)
  }
  const r = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(name, v.parent_id || null)
  return c.json(db.prepare('SELECT id, name, parent_id, created_at FROM categories WHERE id = ?').get(r.lastInsertRowid))
})

router.openapi(deleteRouteDef, (c) => {
  const db = getDb()
  const id = Number(c.req.param('id'))
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(id)) {
    return c.json({ error: 'Category not found' }, 400)
  }
  // Remove sub-categories first (products keep their category label string).
  db.prepare('DELETE FROM categories WHERE parent_id = ?').run(id)
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  return c.json({ success: true })
})

export default router
