'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, Field, Input } from '@/components/ui/form'
import { login, type LoginState } from './actions'

const INITIAL: LoginState = {}

export function LoginForm() {
  const [state, formAction] = useActionState(login, INITIAL)

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Username or email" htmlFor="username" required>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          placeholder="admin"
          invalid={Boolean(state.error)}
        />
      </Field>

      <Field label="Password" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          invalid={Boolean(state.error)}
        />
      </Field>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      fullWidth
      disabled={pending}
      icon={<LogIn className="h-4 w-4" aria-hidden />}
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  )
}
