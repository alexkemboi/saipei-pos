import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'
import type { config as MssqlConfig } from 'mssql'

/**
 * Prisma 7 connects through a driver adapter rather than a URL in the schema.
 * DATABASE_URL stays the single source of truth, so we parse the Prisma
 * sqlserver:// form into the mssql config the adapter expects.
 *
 *   sqlserver://HOST:PORT;database=DB;user=U;password=P;encrypt=true
 */
function parseSqlServerUrl(url: string): MssqlConfig {
  const withoutScheme = url.replace(/^sqlserver:\/\//, '')
  const [hostPart, ...pairs] = withoutScheme.split(';')
  const [server, port] = hostPart.split(':')

  const params = new Map<string, string>()
  for (const pair of pairs) {
    if (!pair) continue
    const index = pair.indexOf('=')
    if (index === -1) continue
    params.set(pair.slice(0, index).toLowerCase(), pair.slice(index + 1))
  }

  const isTrue = (key: string, fallback: boolean) => {
    const value = params.get(key)
    return value === undefined ? fallback : value.toLowerCase() === 'true'
  }

  return {
    server,
    port: port ? Number(port) : 1433,
    database: params.get('database'),
    user: params.get('user'),
    password: params.get('password'),
    options: {
      encrypt: isTrue('encrypt', true),
      trustServerCertificate: isTrue('trustservercertificate', true),
    },
    pool: { max: 20, min: 0, idleTimeoutMillis: 30_000 },
  }
}

function createClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  return new PrismaClient({
    adapter: new PrismaMssql(parseSqlServerUrl(url)),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

// Next.js dev server re-evaluates modules on every hot reload; reuse one client
// so SQL Server does not accumulate abandoned connection pools.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
