import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { soundSuccess } from '@/lib/sounds'
import { trackLogin } from '@/lib/usage'

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user && !success) { navigate('/', { replace: true }); return }
    requestAnimationFrame(() => setMounted(true))
  }, [user, navigate, success])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username.trim(), password)
    setLoading(false)

    if (result.ok) {
      setSuccess(true); soundSuccess()
      const uid = (result as { userId?: string }).userId
      if (uid) trackLogin(uid)
      setTimeout(() => navigate('/', { replace: true }), 1800)
    } else {
      setError(
        result.error === 'USER_NOT_FOUND' ? 'Usuario no encontrado' :
        result.error === 'WRONG_PASSWORD' ? 'Contraseña incorrecta' :
        result.error === 'PROFILE_NOT_FOUND' ? 'Perfil no encontrado. Contacta con tu SM.' :
        result.error ?? 'Error de conexión'
      )
    }
  }

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#007AFF] via-[#3B82F6] to-[#5856D6]" />
        <div className="relative z-10 text-center animate-success-enter">
          <div className="text-6xl mb-4 animate-bounce-once">✨</div>
          <h2 className="font-logo text-5xl text-white tracking-tight mb-2">revelio</h2>
          <p className="text-white/60 text-sm tracking-widest uppercase">Bienvenido</p>
        </div>
        <style>{`
          @keyframes success-enter { 0% { opacity: 0; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes bounce-once { 0% { transform: scale(0) rotate(-20deg); } 50% { transform: scale(1.3) rotate(10deg); } 100% { transform: scale(1) rotate(0deg); } }
          .animate-success-enter { animation: success-enter 0.6s ease-out; }
          .animate-bounce-once { animation: bounce-once 0.5s ease-out 0.2s both; }
        `}</style>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#007AFF] via-[#3B82F6] to-[#5856D6] animate-gradient" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl -top-32 -right-32 animate-float-slow" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#5856D6]/20 blur-3xl bottom-0 -left-20 animate-float-medium" />
      </div>

      <div className={`relative z-10 w-full max-w-sm mx-4 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <button onClick={() => navigate('/welcome')} className="mb-6 flex items-center gap-1.5 text-white/50 text-sm hover:text-white/80 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Volver
        </button>

        <div className="rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="font-logo text-3xl text-white tracking-tight">revelio</h2>
            <p className="text-white/30 text-[10px] tracking-[0.2em] uppercase mt-1.5">Consulting Management Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Email o usuario</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                name="email" autoComplete="username"
                className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/40 focus:bg-white/15 transition-all"
                placeholder="nombre@alten.es o usuario" autoFocus required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                name="password" autoComplete="current-password"
                className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/40 focus:bg-white/15 transition-all"
                placeholder="••••••••" required />
            </div>

            <label className="flex items-center gap-2 text-white/40 text-xs cursor-pointer select-none">
              <input type="checkbox" className="accent-white/80 w-3.5 h-3.5 rounded" defaultChecked />
              Recuérdame
            </label>

            {error && (
              <div className="rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-2.5 text-sm text-red-200 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-[#007AFF] shadow-lg shadow-black/10 hover:shadow-xl hover:bg-white/95 transition-all disabled:opacity-50 active:scale-[0.98]">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes gradient-shift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animate-gradient { background-size: 200% 200%; animation: gradient-shift 8s ease infinite; }
        @keyframes float-slow { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -40px) scale(1.1); } }
        @keyframes float-medium { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-20px, 30px) scale(1.05); } }
        .animate-float-slow { animation: float-slow 12s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 9s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
