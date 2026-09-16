import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sql from 'mssql'

const here = path.dirname(fileURLToPath(import.meta.url))

function parseUrl(url) {
  const [hostPart, ...pairs] = url.replace(/^sqlserver:\/\//, '').split(';')
  const [server, port] = hostPart.split(':')
  const params = new Map()
  for (const pair of pairs) {
    const i = pair.indexOf('=')
    if (i > 0) params.set(pair.slice(0, i).toLowerCase(), pair.slice(i + 1))
  }
  return {
    server,
    port: port ? Number(port) : 1433,
    database: params.get('database'),
    user: params.get('user'),
    password: params.get('password'),
    options: { encrypt: true, trustServerCertificate: true },
  }
}

const script = fs.readFileSync(path.join(here, 'indexes.sql'), 'utf8')
const pool = await sql.connect(parseUrl(process.env.DATABASE_URL))

// Each IF NOT EXISTS ... CREATE INDEX must be its own batch.
const batches = script
  .split(/\r?\n\r?\n/)
  .map((b) => b.trim())
  .filter((b) => b && !b.split('\n').every((line) => line.trim().startsWith('--')))

for (const batch of batches) {
  await pool.request().batch(batch)
}

await pool.close()
console.log(`Applied ${batches.length} filtered index definitions.`)
