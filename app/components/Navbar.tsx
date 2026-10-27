'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <nav className="mb-6 pb-3 border-b-2 border-black flex flex-wrap items-center justify-between gap-4 font-mono text-xs uppercase">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/"
          className="border-2 border-black bg-black text-white px-2.5 py-1 font-bold tracking-wider hover:bg-neutral-800 transition-none"
        >
          SISTEMA // CAJA
        </Link>
        <span className="text-neutral-400">/</span>
        <Link
          href="/"
          className={`px-2 py-1 border transition-none font-bold tracking-wider ${
            pathname === '/'
              ? 'border-2 border-black bg-black text-white'
              : 'border-transparent text-black hover:border-black'
          }`}
        >
          [01] DASHBOARD
        </Link>
        <Link
          href="/movimientos"
          className={`px-2 py-1 border transition-none font-bold tracking-wider ${
            pathname === '/movimientos'
              ? 'border-2 border-black bg-black text-white'
              : 'border-transparent text-black hover:border-black'
          }`}
        >
          [02] MOVIMIENTOS
        </Link>
        <Link
          href="/productos"
          className={`px-2 py-1 border transition-none font-bold tracking-wider ${
            pathname === '/productos'
              ? 'border-2 border-black bg-black text-white'
              : 'border-transparent text-black hover:border-black'
          }`}
        >
          [03] PRODUCTOS
        </Link>
      </div>

      <div>
        <button
          type="button"
          onClick={handleLogout}
          className="border-2 border-black bg-white hover:bg-black hover:text-white transition-none px-3 py-1 font-mono font-bold uppercase tracking-wider text-xs cursor-pointer"
        >
          [→] CERRAR SESIÓN
        </button>
      </div>
    </nav>
  );
}
