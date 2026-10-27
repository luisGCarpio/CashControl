'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
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
        setError(data.error || 'Error al iniciar sesión');
        setLoading(false);
      }
    } catch {
      setError('Error al conectar con el servidor');
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Iniciar Sesión</h1>
      <p className="text-sm text-gray-400 mb-4">Acceso al sistema de control de caja</p>

      {error && (
        <p className="text-red-500 font-semibold mb-4" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Usuario
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border border-gray-700 bg-transparent px-3 py-2 rounded text-sm focus:outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-700 bg-transparent px-3 py-2 rounded text-sm focus:outline-none focus:border-gray-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="border border-gray-600 px-4 py-2 rounded text-sm font-medium hover:border-gray-400 disabled:opacity-50"
        >
          {loading ? 'Verificando...' : 'Iniciar Sesión'}
        </button>
      </form>
    </main>
  );
}
