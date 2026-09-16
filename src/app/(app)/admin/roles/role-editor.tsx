'use client'

import { useState, useTransition } from 'react'
import { Plus, Save, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Alert, Field, Input } from '@/components/ui/form'
import { cn, formatNumber } from '@/lib/utils'
import { createRole, updateRolePermissions } from '../actions'

export interface EditableRole {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissionCodes: string[]
}

export interface PermissionModule {
  module: string
  permissions: { code: string; label: string }[]
}

export function RoleEditor({
  roles,
  modules,
}: {
  roles: EditableRole[]
  modules: PermissionModule[]
}) {
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? '')
  const [granted, setGranted] = useState<Set<string>>(
    new Set(roles[0]?.permissionCodes ?? []),
  )
  const [state, setState] = useState<{ error?: string; success?: string }>({})
  const [isPending, startTransition] = useTransition()
  const [newRoleName, setNewRoleName] = useState('')
  const [showNewRole, setShowNewRole] = useState(false)

  const selected = roles.find((role) => role.id === selectedId) ?? null

  function selectRole(role: EditableRole) {
    setSelectedId(role.id)
    setGranted(new Set(role.permissionCodes))
    setState({})
  }

  function toggle(code: string) {
    setGranted((current) => {
      const next = new Set(current)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function toggleModule(module: PermissionModule) {
    const codes = module.permissions.map((p) => p.code)
    const allGranted = codes.every((code) => granted.has(code))
    setGranted((current) => {
      const next = new Set(current)
      for (const code of codes) {
        if (allGranted) next.delete(code)
        else next.add(code)
      }
      return next
    })
  }

  function save() {
    if (!selected) return
    setState({})
    startTransition(async () => {
      const result = await updateRolePermissions({
        roleId: selected.id,
        permissionCodes: [...granted],
      })
      setState(result)
    })
  }

  // Unsaved changes: compare against what the server last sent us.
  const dirty =
    selected !== null &&
    (granted.size !== selected.permissionCodes.length ||
      selected.permissionCodes.some((code) => !granted.has(code)))

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[18rem_1fr]">
      {/* --- Role list --- */}
      <Card padded={false} className="self-start">
        <div className="px-5 pt-5">
          <CardHeader
            title="Roles"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewRole((v) => !v)}
                icon={<Plus className="h-4 w-4" aria-hidden />}
              >
                New
              </Button>
            }
          />
        </div>

        {showNewRole ? (
          <div className="space-y-2 border-y border-saipei-gray-200 bg-saipei-gray-50 px-5 py-4">
            <Field label="Role name" htmlFor="newRoleName">
              <Input
                id="newRoleName"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Warehouse Supervisor"
              />
            </Field>
            <Button
              size="sm"
              disabled={isPending || newRoleName.trim().length < 2}
              onClick={() =>
                startTransition(async () => {
                  const result = await createRole({ name: newRoleName })
                  setState(result)
                  if (result.success) {
                    setNewRoleName('')
                    setShowNewRole(false)
                  }
                })
              }
            >
              Create role
            </Button>
          </div>
        ) : null}

        <ul className="divide-y divide-saipei-gray-100">
          {roles.map((role) => (
            <li key={role.id}>
              <button
                type="button"
                onClick={() => selectRole(role)}
                className={cn(
                  'w-full px-5 py-3 text-left transition-colors',
                  role.id === selectedId
                    ? 'bg-saipei-green-50'
                    : 'hover:bg-saipei-gray-50',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'font-semibold',
                      role.id === selectedId
                        ? 'text-saipei-green-800'
                        : 'text-saipei-dark-800',
                    )}
                  >
                    {role.name}
                  </span>
                  {role.isSystem ? <Badge tone="info">Built in</Badge> : null}
                </div>
                <p className="mt-0.5 text-xs text-saipei-gray-500">
                  {role.description ?? 'No description'}
                </p>
                <p className="tabular mt-1 flex items-center gap-1 text-xs text-saipei-gray-500">
                  <Users className="h-3 w-3" aria-hidden />
                  {formatNumber(role.userCount)} user
                  {role.userCount === 1 ? '' : 's'} ·{' '}
                  {formatNumber(role.permissionCodes.length)} permissions
                </p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {/* --- Permission matrix --- */}
      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title={selected ? `Permissions for ${selected.name}` : 'Permissions'}
            description="Tick what this role may do. Changes apply the next time the user signs in."
            action={
              <Button
                onClick={save}
                disabled={!selected || isPending || !dirty}
                icon={<Save className="h-4 w-4" aria-hidden />}
              >
                {isPending ? 'Saving…' : 'Save permissions'}
              </Button>
            }
          />
        </div>

        {state.error ? (
          <div className="px-5 pb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}
        {state.success ? (
          <div className="px-5 pb-4">
            <Alert tone="success" title="Saved">
              {state.success}
            </Alert>
          </div>
        ) : null}
        {dirty ? (
          <div className="px-5 pb-4">
            <Alert tone="warning">
              You have unsaved changes to this role.
            </Alert>
          </div>
        ) : null}

        <div className="divide-y divide-saipei-gray-100 border-t border-saipei-gray-200">
          {modules.map((module) => {
            const codes = module.permissions.map((p) => p.code)
            const grantedCount = codes.filter((code) => granted.has(code)).length
            const all = grantedCount === codes.length

            return (
              <div key={module.module} className="px-5 py-4">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold tracking-wider text-saipei-dark-700 uppercase">
                    {module.module}
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleModule(module)}
                    className="text-xs font-medium text-saipei-green-700 hover:underline"
                  >
                    {all ? 'Clear all' : 'Select all'}
                    <span className="tabular ml-1 text-saipei-gray-400">
                      ({grantedCount}/{codes.length})
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {module.permissions.map((permission) => (
                    <label
                      key={permission.code}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors',
                        granted.has(permission.code)
                          ? 'border-saipei-green-300 bg-saipei-green-50'
                          : 'border-saipei-gray-200 hover:border-saipei-gray-300',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={granted.has(permission.code)}
                        onChange={() => toggle(permission.code)}
                        className="mt-0.5 h-4 w-4 rounded border-saipei-gray-300 accent-[var(--saipei-green)]"
                      />
                      <span>
                        <span
                          className={cn(
                            'block',
                            granted.has(permission.code)
                              ? 'font-medium text-saipei-green-900'
                              : 'text-saipei-gray-700',
                          )}
                        >
                          {permission.label}
                        </span>
                        <span className="tabular block text-xs text-saipei-gray-400">
                          {permission.code}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
