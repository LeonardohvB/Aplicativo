// src/pages/Login.tsx
import React, { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null); setError(null)

    if (!isValidEmail(email)) return setError('Informe um e-mail válido.')
    if (!password || password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.')

    try {
      setLoading(true)
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage('Login realizado com sucesso!')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Conta criada! Verifique seu e-mail se a confirmação estiver ativada.')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Algo deu errado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    setMessage(null); setError(null)
    if (!isValidEmail(email)) return setError('Digite seu e-mail acima para receber o link de redefinição.')
    try {
      setLoading(true)
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
      })
      setMessage('Enviamos um link de redefinição para o seu e-mail.')
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível enviar o e-mail de redefinição.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      {/* blobs decorativos */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-indigo-200/30 blur-3xl" />

      <div className="w-full max-w-md">
        {/* logomarca/monograma */}
        <div className="mb-6 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
            <span className="text-lg font-bold">CL</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur">
          {/* abas */}
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === 'signup' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Criar conta
            </button>
          </div>

          {/* mensagens */}
          {message && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm">{message}</p>
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400"
                  placeholder="voce@exemplo.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400"
                  placeholder={mode === 'login' ? 'Sua senha' : 'Crie uma senha'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {mode === 'login' && (
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-blue-600/10 transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === 'login' ? 'Entrando…' : 'Criando conta…'}
                </>
              ) : mode === 'login' ? (
                'Entrar'
              ) : (
                'Criar conta'
              )}
            </button>
          </form>
        
        </div>
      </div>
    </div>
  )
}
