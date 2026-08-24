import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : isSignUp ? 'Error al registrarse' : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = api.getGoogleAuthUrl();
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border-2 border-[#000033]/10 shadow-xl p-8">
        <h1 className="text-2xl font-bold text-[#000033] mb-6 text-center">OTR Platform</h1>

        {/* Tab Toggle: Login vs Sign Up */}
        <div className="flex bg-[#000033]/5 p-1 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              !isSignUp
                ? 'bg-white text-[#024fff] shadow-sm'
                : 'text-[#000033]/60 hover:text-[#000033]'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              isSignUp
                ? 'bg-white text-[#024fff] shadow-sm'
                : 'text-[#000033]/60 hover:text-[#000033]'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Botón de Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-[#000033]/15 text-[#000033] font-medium py-2.5 px-4 rounded-xl hover:bg-[#000033]/5 transition-colors mb-4 text-xs"
        >
          <GoogleIcon />
          Continuar con Google
        </button>

        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#000033]/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-[#000033]/40 font-medium">o con email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-[#000033] mb-1">
                Nombre completo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ej. María Pérez"
                className="w-full px-3 py-2 text-xs border border-[#000033]/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#024fff] transition-all"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-[#000033] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu.email@ontherocks.tech"
              className="w-full px-3 py-2 text-xs border border-[#000033]/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#024fff] transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-[#000033] mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs border border-[#000033]/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#024fff] transition-all"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#024fff] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#024fff]/90 disabled:bg-[#000033]/20 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {loading ? (isSignUp ? 'Creando cuenta...' : 'Iniciando sesión...') : (isSignUp ? 'Crear cuenta' : 'Iniciar sesión')}
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
