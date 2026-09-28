import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = path.dirname(fileURLToPath(import.meta.url))
const script = fs.readFileSync(path.join(here, 'indexes.sql'), 'utf8')

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  // PostgreSQL runs a multi-statement script in one simple-query call.
  await client.query(script)
  const count = (script.match(/^\s*(CREATE|ALTER)\b/gim) || []).length
  console.log(`Applied ${count} index/constraint definitions.`)
} finally {
  await client.end()
}
