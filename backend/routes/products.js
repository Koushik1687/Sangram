/* routes/products.js */
import { createRoute, z } from '@hono/zod-openapi'
import { get, query, run } from '../db/database.js'
import { authMiddleware } from '../middleware/auth.js'
import { storeImage } from '../services/images.js'
import { createApp, ErrorSchema, ProductImageInput, ProductInput, ProductSchema, SuccessSchema } from './schemas.js'

const router = createApp()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Products'],
  summary: 'List active products',
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: z.array(ProductSchema) } },
    },
  },
})

const createRouteDef = createRoute({
  method: 'post',
  path: '/',
  tags: ['Products'],
  summary: 'Create a product (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    body: { content: { 'application/json': { schema: ProductInput } } },
  },
  responses: {
    200: { description: 'Created product', content: { 'application/json': { schema: ProductSchema } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

const updateRouteDef = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Products'],
  summary: 'Update a product (admin)',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: ProductInput } } },
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
  tags: ['Products'],
  summary: 'Soft-delete a product (admin)',
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

const uploadImageRouteDef = createRoute({
  method: 'post',
  path: '/{id}/image',
  tags: ['Products'],
  summary: 'Upload a product photo (admin) — sets image_url',
  security: [{ bearerAuth: [] }],
  middleware: [authMiddleware],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'multipart/form-data': { schema: ProductImageInput } } },
  },
  responses: {
    200: { description: 'Image uploaded', content: { 'application/json': { schema: ProductSchema } } },
    400: { description: 'No file provided', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'Product not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

router.openapi(listRoute, async (c) => {
  return c.json(await query('SELECT * FROM products WHERE is_active=1 ORDER BY id DESC'))
})

router.openapi(createRouteDef, async (c) => {
  const { name, category, price, description, image_url, stock, low_stock_threshold } = c.req.valid('json')
  const r = await run('INSERT INTO products (name,category,price,description,image_url,stock,low_stock_threshold) VALUES (?,?,?,?,?,?,?)',
    [name, category, price, description, image_url || '', stock ?? null, low_stock_threshold ?? null])
  return c.json({
    id: r.lastInsertRowid, name, category, price, description, image_url,
    stock: stock ?? null, low_stock_threshold: low_stock_threshold ?? null,
  })
})

router.openapi(updateRouteDef, async (c) => {
  const { name, category, price, description, image_url, stock, low_stock_threshold } = c.req.valid('json')
  await run('UPDATE products SET name=?,category=?,price=?,description=?,image_url=?,stock=?,low_stock_threshold=? WHERE id=?',
    [name, category, price, description, image_url || '', stock ?? null, low_stock_threshold ?? null, c.req.param('id')])
  return c.json({ success: true })
})

router.openapi(deleteRouteDef, async (c) => {
  await run('UPDATE products SET is_active=0 WHERE id=?', [c.req.param('id')])
  return c.json({ success: true })
})

router.openapi(uploadImageRouteDef, async (c) => {
  const { image } = c.req.valid('form')
  if (!image || typeof image === 'string' || !image.name) {
    return c.json({ error: 'No image file provided' }, 400)
  }

  const product = await get('SELECT id FROM products WHERE id = ?', [c.req.param('id')])
  if (!product) return c.json({ error: 'Product not found' }, 404)

  await storeImage({ table: 'products', id: product.id, file: image })
  return c.json(await get('SELECT * FROM products WHERE id = ?', [product.id]))
})

export default router
