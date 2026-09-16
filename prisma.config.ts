import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7 keeps the connection URL out of schema.prisma. The CLI (db push,
// migrate, studio) reads it from here; the runtime client uses the mssql
// driver adapter in src/lib/db.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'node --experimental-strip-types prisma/seed.ts',
  },
})
