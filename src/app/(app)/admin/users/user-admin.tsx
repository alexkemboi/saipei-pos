'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Pencil, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input, Select } from '@/components/ui/form'
import { createUser, updateUser, type FormState } from '../actions'

const EMPTY: FormState = {}

export interface AdminUser {
  id: string
  fullName: string
  username: string
  email: string
  phone: string | null
  isActive: boolean
  roleId: string
  branchId: string | null
}

export function UserAdmin({
  roles,
  branches,
  users,
}: {
  roles: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  users: AdminUser[]
}) {
  const [editing, setEditing] = useState<AdminUser | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-saipei-gray-600">Edit an existing user:</span>
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => setEditing(editing?.id === user.id ? null : user)}
            className={
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ' +
              (editing?.id === user.id
                ? 'border-saipei-green-500 bg-saipei-green-50 text-saipei-green-800'
                : 'border-saipei-gray-300 text-saipei-gray-600 hover:border-saipei-green-400')
            }
          >
            <Pencil className="h-3 w-3" aria-hidden />
            {user.username}
          </button>
        ))}
        {editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
            Cancel edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <UserForm
          key={editing.id}
          roles={roles}
          branches={branches}
          user={editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <UserForm key="new" roles={roles} branches={branches} />
      )}
    </div>
  )
}

function UserForm({
  roles,
  branches,
  user,
  onDone,
}: {
  roles: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  user?: AdminUser
  onDone?: () => void
}) {
  const action = user ? updateUser.bind(null, user.id) : createUser
  const [state, formAction] = useActionState(action, EMPTY)
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction}>
      <Card>
        <CardHeader
          title={user ? `Edit ${user.fullName}` : 'Add a user'}
          description={
            user
              ? 'Leave the password blank to keep the current one.'
              : 'The user signs in with their username or email.'
          }
        />

        {state.error ? (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="mb-4">
            <Alert tone="success" title="Saved">
              {state.success}
            </Alert>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name" htmlFor="fullName" required error={errors.fullName}>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={user?.fullName}
              invalid={Boolean(errors.fullName)}
              required
            />
          </Field>

          <Field label="Username" htmlFor="username" required error={errors.username}>
            <Input
              id="username"
              name="username"
              defaultValue={user?.username}
              invalid={Boolean(errors.username)}
              className="tabular"
              required
            />
          </Field>

          <Field label="Email" htmlFor="email" required error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={user?.email}
              invalid={Boolean(errors.email)}
              required
            />
          </Field>

          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={user?.phone ?? ''} inputMode="tel" />
          </Field>

          <Field label="Role" htmlFor="roleId" required error={errors.roleId}>
            <Select id="roleId" name="roleId" defaultValue={user?.roleId ?? ''} required>
              <option value="">Choose a role…</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Branch" htmlFor="branchId">
            <Select id="branchId" name="branchId" defaultValue={user?.branchId ?? ''}>
              <option value="">No branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={user ? 'New password' : 'Initial password'}
            htmlFor="password"
            required={!user}
            error={errors.password}
            hint={user ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              invalid={Boolean(errors.password)}
            />
          </Field>

          <label className="flex items-center gap-2.5 self-end pb-2 text-sm text-saipei-gray-700 sm:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={user?.isActive ?? true}
              className="h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
            />
            Active — this user can sign in
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <SubmitButton isEdit={Boolean(user)} />
          {onDone ? (
            <Button variant="neutral" type="button" onClick={onDone}>
              Done
            </Button>
          ) : null}
        </div>
      </Card>
    </form>
  )
}

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} icon={<UserPlus className="h-4 w-4" aria-hidden />}>
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
    </Button>
  )
}
