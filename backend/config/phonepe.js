/* ==========================================================================
   config/phonepe.js — PhonePe PG SDK setup using @phonepe-pg/pg-sdk-node (pg)
   ========================================================================== */
import * as pg from '@phonepe-pg/pg-sdk-node'

const CLIENT_ID = process.env.PHONEPE_CLIENT_ID || 'TEST_MERCHANT_ID'
const CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET || 'TEST_CLIENT_SECRET'
const CLIENT_VERSION = parseInt(process.env.PHONEPE_CLIENT_VERSION || '1', 10)
const ENV = process.env.PHONEPE_ENV === 'PRODUCTION' ? pg.Env.PRODUCTION : pg.Env.SANDBOX

// Initialize Standard Checkout Client singleton
const client = pg.StandardCheckoutClient.getInstance(
  CLIENT_ID,
  CLIENT_SECRET,
  CLIENT_VERSION,
  ENV,
)

export { client, pg }
