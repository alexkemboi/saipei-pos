import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'

const COOKIE = 'saipei_session'
const MAX_AGE_SECONDS = 60 * 60 * 12 // a working day

export interface SessionUser {
  id: string
  username: string
  fullName: string
  email: string
  roleId: string
  roleName: string
  permissions: string[]
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET
  if (!value) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(value)
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10)
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash)
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ user: user as unknown as Record<string, unknown> })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}

/** Returns the signed-in user, or null when there is no valid session. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret())
    return (payload.user as SessionUser) ?? null
  } catch {
    return null
  }
}

/** Use in every protected page/action - redirects to login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) redirect('/login')
  return user
}

/**
 * Gate a page or server action on a permission. Sends the user to the
 * dashboard rather than a dead end when they are signed in but not allowed.
 */
export async function requirePermission(
  required: string | string[],
): Promise<SessionUser> {
  const user = await requireUser()
  if (!hasPermission(user.permissions, required)) redirect('/dashboard?denied=1')
  return user
}

/** Authenticate credentials and return the session payload. */
export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await db.user.findFirst({
    where: {
      isActive: true,
      OR: [{ username }, { email: username }],
    },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  })

  if (!user || !verifyPassword(password, user.passwordHash)) return null

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions: user.role.permissions.map((rp) => rp.permission.code),
  }
}

/** Append an entry to the audit trail. Never throws into the caller's flow. */
export async function audit(entry: {
  userId?: string | null
  action: string
  entity: string
  entityId?: string | null
  summary?: string
  metadata?: unknown
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    })
  } catch (error) {
    console.error('audit log failed', error)
  }
}
