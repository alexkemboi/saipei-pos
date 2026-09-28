import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Logo } from '@/components/ui/logo'
import { getSession } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    // Full-height canvas; the padding guarantees a margin all round the card
    // on every screen size, and grid centring keeps it in the middle.
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-saipei-dark-800 via-saipei-dark-700 to-saipei-dark-900 p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white px-6 py-10 shadow-2xl ring-1 ring-black/5 sm:px-10">
          <div className="flex justify-center">
            <Logo height={72} priority />
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-2xl font-bold text-saipei-dark-800">Sign in</h1>
            <p className="mt-1 text-sm text-saipei-gray-500">
              Enter your SAIPEI POS credentials to continue.
            </p>
          </div>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-saipei-dark-200">
          © {new Date().getFullYear()} SAIPEI FOODS LIMITED · From Kenya with Love
        </p>
      </div>
    </main>
  )
}
