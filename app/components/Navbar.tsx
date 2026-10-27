'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export interface NavbarProps {
  onDataChange?: () => void;
}

export default function Navbar({ onDataChange }: NavbarProps = {}) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  // Si la ruta es /login, no renderizar nada
  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Error during logout:', e);
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6 text-sm">
      <Link href="/" className="font-bold text-base">
        Pulso Financiero
      </Link>
      <Link href="/" className="hover:underline">
        Dashboard
      </Link>
      <Link href="/movimientos" className="hover:underline">
        Movimientos
      </Link>
      <Link href="/productos" className="hover:underline">
        Productos
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="ml-auto border border-gray-700 px-3 py-1 rounded hover:border-gray-500 disabled:opacity-50"
      >
        {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
      </button>
    </nav>
  );
}
