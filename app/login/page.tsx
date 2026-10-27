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
    <main>
      <h1>Iniciar Sesión</h1>
      <p>Ingresa tus datos para acceder al sistema.</p>

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Credenciales</legend>
          <p>
            <label htmlFor="username">Usuario:</label>
            <br />
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </p>
          <p>
            <label htmlFor="password">Contraseña:</label>
            <br />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </p>
          <p>
            <button type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Ingresar'}
            </button>
          </p>
        </fieldset>
      </form>
    </main>
  );
}
