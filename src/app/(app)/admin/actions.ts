'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { audit, hashPassword, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

export interface FormState {
  error?: string
  success?: string
  fieldErrors?: Record<string, string>
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !result[key]) result[key] = issue.message
  }
  return result
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const userSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the full name'),
  username: z
    .string()
    .trim()
    .min(3, 'Usernames are at least 3 characters')
    .regex(/^[a-z0-9._-]+$/i, 'Use letters, numbers, dots, dashes or underscores only'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().max(30).optional(),
  roleId: z.string().min(1, 'Choose a role'),
  branchId: z.string().trim().optional(),
  isActive: z.boolean(),
  password: z
    .string()
    .min(8, 'Passwords are at least 8 characters')
    .optional()
    .or(z.literal('')),
})

function parseUser(formData: FormData) {
  return userSchema.safeParse({
    fullName: formData.get('fullName'),
    username: formData.get('username'),
    email: formData.get('email'),
    phone: formData.get('phone') ?? undefined,
    roleId: formData.get('roleId'),
    branchId: formData.get('branchId') ?? undefined,
    isActive: formData.get('isActive') !== null,
    password: formData.get('password') ?? '',
  })
}

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('admin.users')
  const parsed = parseUser(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  if (!data.password) {
    return { fieldErrors: { password: 'Set an initial password' } }
  }

  try {
    const clash = await db.user.findFirst({
      where: { OR: [{ username: data.username }, { email: data.email }] },
      select: { username: true, email: true },
    })
    if (clash) {
      return {
        fieldErrors:
          clash.username === data.username
            ? { username: 'That username is already taken.' }
            : { email: 'That email is already registered.' },
      }
    }

    const user = await db.user.create({
      data: {
        fullName: data.fullName,
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        roleId: data.roleId,
        branchId: data.branchId || null,
        isActive: data.isActive,
        passwordHash: hashPassword(data.password),
      },
      select: { id: true, username: true },
    })

    await audit({
      userId: actor.id,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      summary: `User ${user.username} created`,
    })
  } catch (error) {
    console.error('createUser failed', error)
    return { error: 'The user could not be saved. Please try again.' }
  }

  revalidatePath('/admin/users')
  return { success: `User ${data.username} created.` }
}

export async function updateUser(
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('admin.users')
  const parsed = parseUser(formData)
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  try {
    const clash = await db.user.findFirst({
      where: {
        id: { not: userId },
        OR: [{ username: data.username }, { email: data.email }],
      },
      select: { username: true },
    })
    if (clash) {
      return {
        fieldErrors:
          clash.username === data.username
            ? { username: 'That username is already taken.' }
            : { email: 'That email is already registered.' },
      }
    }

    await db.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        username: data.username.toLowerCase(),
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        roleId: data.roleId,
        branchId: data.branchId || null,
        isActive: data.isActive,
        // An empty password box means "leave the password alone".
        ...(data.password ? { passwordHash: hashPassword(data.password) } : {}),
      },
    })

    await audit({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'User',
      entityId: userId,
      summary: `User ${data.username} updated${data.password ? ' (password reset)' : ''}`,
    })
  } catch (error) {
    console.error('updateUser failed', error)
    return { error: 'The user could not be saved. Please try again.' }
  }

  revalidatePath('/admin/users')
  return { success: `User ${data.username} updated.` }
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export async function updateRolePermissions(input: {
  roleId: string
  permissionCodes: string[]
}): Promise<FormState> {
  const actor = await requirePermission('admin.roles')

  try {
    const role = await db.role.findUnique({
      where: { id: input.roleId },
      select: { name: true },
    })
    if (!role) return { error: 'That role no longer exists.' }

    const permissions = await db.permission.findMany({
      where: { code: { in: input.permissionCodes } },
      select: { id: true },
    })

    await db.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: input.roleId } })
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: input.roleId,
            permissionId: permission.id,
          })),
        })
      }
    })

    await audit({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'Role',
      entityId: input.roleId,
      summary: `Role ${role.name} now has ${permissions.length} permissions`,
    })

    revalidatePath('/admin/roles')
    return { success: `${role.name} updated with ${permissions.length} permissions.` }
  } catch (error) {
    console.error('updateRolePermissions failed', error)
    return { error: 'The permissions could not be saved. Please try again.' }
  }
}

export async function createRole(input: {
  name: string
  description?: string
}): Promise<FormState> {
  const actor = await requirePermission('admin.roles')
  const name = input.name.trim()
  if (name.length < 2) return { error: 'Enter a role name.' }

  try {
    const role = await db.role.create({
      data: { name, description: input.description?.trim() || null, isSystem: false },
      select: { id: true },
    })

    await audit({
      userId: actor.id,
      action: 'CREATE',
      entity: 'Role',
      entityId: role.id,
      summary: `Role ${name} created`,
    })
  } catch {
    return { error: 'A role with that name already exists.' }
  }

  revalidatePath('/admin/roles')
  return { success: `Role ${name} created.` }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('admin.settings')

  const entries: { key: string; value: string; group: string }[] = []
  for (const [field, value] of formData.entries()) {
    // Fields are named "group.key" to match the Setting table.
    if (typeof value !== 'string') continue
    const group = field.split('.')[0]
    if (!group) continue
    entries.push({ key: field, value, group })
  }

  if (entries.length === 0) return { error: 'Nothing to save.' }

  try {
    await db.$transaction(
      entries.map((entry) =>
        db.setting.upsert({
          where: { key: entry.key },
          update: { value: entry.value, group: entry.group },
          create: entry,
        }),
      ),
    )

    await audit({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'Setting',
      summary: `${entries.length} settings updated`,
    })
  } catch (error) {
    console.error('updateSettings failed', error)
    return { error: 'The settings could not be saved. Please try again.' }
  }

  revalidatePath('/admin/settings')
  return { success: 'Settings saved.' }
}
