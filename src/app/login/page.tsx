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
    <div className="flex min-h-screen">
      {/* Brand panel - dark green structure, hidden on small screens */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-saipei-dark-800 p-12 lg:flex">
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <Logo height={72} priority />
        </div>

        <div>
          <h1 className="text-3xl font-bold text-white">
            Import. Stock. Sell.
          </h1>
          <p className="mt-3 max-w-md text-saipei-green-100">
            One system from the supplier order in China through clearing at
            Mombasa to the sale at the till.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Track every container, bale and landed cost',
              'Fast POS built for cashiers, with M-PESA',
              'Live stock, debtors and profitability',
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-saipei-green-400" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-saipei-dark-300">
          SAIPEI FOODS LIMITED · From Kenya with Love
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo height={64} priority />
          </div>

          <h2 className="text-2xl font-bold text-saipei-dark-800">Sign in</h2>
          <p className="mt-1 mb-8 text-sm text-saipei-gray-500">
            Enter your SAIPEI POS credentials to continue.
          </p>

          <LoginForm />

          <p className="mt-10 text-center text-xs text-saipei-gray-400">
            © {new Date().getFullYear()} SAIPEI FOODS LIMITED
          </p>
        </div>
      </div>
    </div>
  )
}
