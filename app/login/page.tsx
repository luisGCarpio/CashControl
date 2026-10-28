'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json();
        setError(data.error || 'Usuario o contraseña incorrectos.');
      }
    } catch {
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white border border-black p-8 rounded-none">
        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-xl font-bold font-mono tracking-tight text-black uppercase">
            Iniciar sesión
          </h1>
        </div>

        {error && (
          <div role="alert" aria-live="polite" className="border border-black bg-black text-white p-3 font-mono text-xs uppercase mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black"
            >
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border border-black bg-white px-3 py-2 text-sm font-mono rounded-none"
              placeholder="admin"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-black bg-white px-3 py-2 text-sm font-mono rounded-none"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full border border-black bg-black text-white hover:bg-white hover:text-black transition-none py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-none cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Autenticando...' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
