#!/usr/bin/env node
/* ==========================================================================
   scripts/create-admin.mjs — create or reset an admin account with a strong
   random password that is printed exactly once.

   Usage (from the backend/ directory):
     node scripts/create-admin.mjs [username] [email?]
     npm run create:admin            # same thing, defaults to "admin"

   Reads DATABASE_URL from backend/.env (dotenv is loaded by database.js).
   ========================================================================== */
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { get, run } from '../db/database.js'

const username = (process.argv[2] || 'admin').trim()
const email = (process.argv[3] || '').trim()

if (!username) {
  console.error('❌  A username is required, e.g.  node scripts/create-admin.mjs admin')
  process.exit(1)
}

const password = crypto.randomBytes(18).toString('base64url') // 24 chars, mixed case + digits

try {
  const existing = await get('SELECT id FROM admins WHERE username = ?', [username])
  const hash = bcrypt.hashSync(password, 10)
  if (existing) {
    await run('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, existing.id])
    console.log(`✅  Updated admin "${username}"`)
  } else {
    await run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash])
    console.log(`✅  Created admin "${username}"`)
  }
} catch (err) {
  console.error('❌  Failed to update the database:', err.message || err)
  process.exit(1)
}

console.log('')
console.log('  ┌───────────────────────────────────────────┐')
console.log('  │  Username : ' + username.padEnd(28) + ' │')
console.log('  │  Password : ' + password.padEnd(28) + ' │')
console.log('  └───────────────────────────────────────────┘')
console.log('')
console.log('⚠️   Save this password now — it is shown only once.')
console.log('    Sign in at /admin/login. Rotate it any time by re-running this script.')
if (email) {
  console.log(`    (Note: ${email} was received but admins do not use email — ignored.)`)
}
process.exit(0)
