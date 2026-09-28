import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Prisma 7 connects through a driver adapter rather than a URL in the schema.
 * DATABASE_URL (a standard postgresql:// connection string) stays the single
 * source of truth for both the CLI (prisma.config.ts) and the runtime client.
 *
 *   postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public
 */
function createClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      max: 20,
      idleTimeoutMillis: 30_000,
    }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

// Next.js dev server re-evaluates modules on every hot reload; reuse one client
// so PostgreSQL does not accumulate abandoned connection pools.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
