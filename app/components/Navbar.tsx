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
    <nav>
      <strong>Mi Negocio</strong> |{' '}
      <Link href="/">Dashboard</Link> |{' '}
      <Link href="/movimientos">Movimientos</Link> |{' '}
      <Link href="/productos">Productos</Link> |{' '}
      <button type="button" onClick={handleLogout}>
        Cerrar Sesión
      </button>
    </nav>
  );
}
