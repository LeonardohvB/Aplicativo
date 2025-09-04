import React, { useState } from 'react'
import { signInEmailPassword, signUpEmailPassword } from '@/lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(null); setMessage(null)

    try {
      if (mode === 'login') {
        await signInEmailPassword(email, password)
        setMessage('Login realizado!')
      } else {
        await signUpEmailPassword(email, password)
        setMessage('Cadastro criado! Verifique seu e-mail se a confirmação estiver ativada.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Consultório</h1>
        <p className="text-gray-600 mb-6">
          {mode === 'login' ? 'Entre com seu e-mail e senha.' : 'Crie sua conta.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="voce@exemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {message && <div className="text-sm text-green-600">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition disabled:opacity-60"
          >
            {loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600 mt-4">
          {mode === 'login' ? (
            <>
              Não tem conta?{' '}
              <button className="text-blue-600 hover:underline" onClick={() => setMode('signup')}>
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              Já possui conta?{' '}
              <button className="text-blue-600 hover:underline" onClick={() => setMode('login')}>
                Fazer login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
