/* routes/blogs.js */
import { createRoute, z } from '@hono/zod-openapi'
import { getDb } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { BlogInput, BlogSchema, createApp, ErrorSchema, SuccessSchema } from './schemas.js'

const router = createApp()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Blogs'],
  summary: 'List blog posts',
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: z.array(BlogSchema) } } },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Blogs'],
  summary: 'Create a blog post (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    body: { content: { 'application/json': { schema: BlogInput } } },
  },
  responses: {
    200: { description: 'Created post', content: { 'application/json': { schema: BlogSchema } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const updateRouteDef = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Blogs'],
  summary: 'Update a blog post (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: BlogInput } } },
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
  tags: ['Blogs'],
  summary: 'Delete a blog post (admin)',
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
  return c.json(getDb().prepare('SELECT * FROM blogs ORDER BY published_at DESC').all())
})

router.openapi(createRouteDef, (c) => {
  const { title, category, excerpt, content, featured_image, published_at } = c.req.valid('json')
  const db = getDb()
  const r = db.prepare('INSERT INTO blogs (title,category,excerpt,content,featured_image,published_at) VALUES (?,?,?,?,?,?)')
    .run(title, category, excerpt, content || '', featured_image || '', published_at || new Date().toISOString().slice(0, 10))
  return c.json({ id: r.lastInsertRowid, title, category, excerpt })
})

router.openapi(updateRouteDef, (c) => {
  const { title, category, excerpt, content, featured_image, published_at } = c.req.valid('json')
  getDb().prepare('UPDATE blogs SET title=?,category=?,excerpt=?,content=?,featured_image=?,published_at=? WHERE id=?')
    .run(title, category, excerpt, content || '', featured_image || '', published_at, c.req.param('id'))
  return c.json({ success: true })
})

router.openapi(deleteRouteDef, (c) => {
  getDb().prepare('DELETE FROM blogs WHERE id=?').run(c.req.param('id'))
  return c.json({ success: true })
})

export default router
