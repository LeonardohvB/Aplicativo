// src/pages/Login.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setMsg(null); setErr(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMsg('Login realizado!')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Cadastro criado! Verifique seu e-mail caso a confirmação esteja ativada.')
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Falha ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-800">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </h1>

        <input
          className="w-full border rounded-lg p-3"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="w-full border rounded-lg p-3"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black text-white py-3 disabled:opacity-60"
        >
          {loading ? 'Enviando...' : (mode === 'login' ? 'Entrar' : 'Cadastrar')}
        </button>

        <div className="text-sm text-center">
          {mode === 'login' ? (
            <button type="button" className="underline" onClick={() => setMode('signup')}>
              Criar uma conta
            </button>
          ) : (
            <button type="button" className="underline" onClick={() => setMode('login')}>
              Já tenho conta
            </button>
          )}
        </div>

        {msg && <p className="text-green-600 text-sm">{msg}</p>}
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </form>
    </div>
  )
}
