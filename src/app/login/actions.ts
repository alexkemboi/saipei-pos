'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { audit, authenticate, createSession } from '@/lib/auth'

export interface LoginState {
  error?: string
}

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
})

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Enter both your username and password.' }
  }

  const user = await authenticate(parsed.data.username, parsed.data.password)
  if (!user) {
    // Deliberately vague: do not reveal which half of the pair was wrong.
    return { error: 'Those credentials were not recognised. Please try again.' }
  }

  await createSession(user)
  await audit({
    userId: user.id,
    action: 'LOGIN',
    entity: 'User',
    entityId: user.id,
    summary: `${user.fullName} signed in`,
  })

  redirect('/dashboard')
}
