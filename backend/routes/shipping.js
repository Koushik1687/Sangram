/* ==========================================================================
   routes/shipping.js — public shipping config so the checkout can display
   the shipping fee and free-shipping threshold before creating an order.
   The server re-computes and enforces the fee at order creation.
   ========================================================================== */
import { createRoute } from '@hono/zod-openapi'
import { getShippingConfig } from '../services/shipping.js'
import { createApp, ShippingConfigResponse } from './schemas.js'

const router = createApp()

const getShippingRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Shipping'],
  summary: 'Get the current shipping config (flat fee + free-shipping threshold)',
  responses: {
    200: { description: 'Shipping config', content: { 'application/json': { schema: ShippingConfigResponse } } },
  },
})

router.openapi(getShippingRoute, (c) => c.json(getShippingConfig()))

export default router
