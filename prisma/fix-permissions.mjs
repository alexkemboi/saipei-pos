// One-off fix for "permission denied for schema public" (PostgreSQL 15+).
// Connects as the postgres superuser and hands the app database + public
// schema to the app user from DATABASE_URL. No psql needed.
//
//   PowerShell:  $env:PGADMIN_PASSWORD="your-postgres-password"; node prisma/fix-permissions.mjs
import 'dotenv/config'
import pg from 'pg'

const app = new URL(process.env.DATABASE_URL)
const dbName = app.pathname.slice(1)
const appUser = decodeURIComponent(app.username)
const appPass = decodeURIComponent(app.password)
const superUser = process.env.PGADMIN_USER || 'postgres'
const superPass = process.env.PGADMIN_PASSWORD
if (!superPass) {
  console.error('Set PGADMIN_PASSWORD to the postgres superuser password first.')
  process.exit(1)
}
const ident = (s) => '"' + s.replace(/"/g, '""') + '"'
const lit = (s) => "'" + s.replace(/'/g, "''") + "'"
const conn = (database) => new pg.Client({ host: app.hostname, port: Number(app.port || 5432), user: superUser, password: superPass, database })

// 1. Make sure the app role and database exist.
const admin = conn('postgres')
await admin.connect()
const role = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser])
if (!role.rowCount) {
  await admin.query(`CREATE ROLE ${ident(appUser)} LOGIN PASSWORD ${lit(appPass)}`)
  console.log(`Created role ${appUser}`)
}
const db = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
if (!db.rowCount) {
  await admin.query(`CREATE DATABASE ${ident(dbName)} OWNER ${ident(appUser)}`)
  console.log(`Created database ${dbName}`)
} else {
  await admin.query(`ALTER DATABASE ${ident(dbName)} OWNER TO ${ident(appUser)}`)
}
await admin.end()

// 2. Give the app user the public schema inside that database.
const target = conn(dbName)
await target.connect()
await target.query(`ALTER SCHEMA public OWNER TO ${ident(appUser)}`)
await target.query(`GRANT ALL ON SCHEMA public TO ${ident(appUser)}`)
await target.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
await target.end()
console.log(`Done: ${appUser} now owns database ${dbName} and schema public.`)
