'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  // Si la ruta es '/login', la barra lateral no se debe mostrar
  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      window.location.href = '/login';
    }
  };

  const navItems = [
    {
      code: '01',
      label: 'DASHBOARD',
      href: '/',
      isActive: pathname === '/',
    },
    {
      code: '02',
      label: 'MOVIMIENTOS',
      href: '/movimientos',
      isActive: pathname === '/movimientos' || pathname.startsWith('/movimientos/'),
    },
    {
      code: '03',
      label: 'PRODUCTOS',
      href: '/productos',
      isActive: pathname === '/productos' || pathname.startsWith('/productos/'),
    },
  ];

  return (
    <aside className="w-60 min-w-[240px] max-w-[240px] h-screen sticky top-0 bg-white border-r-2 border-black flex flex-col justify-between select-none z-30 shrink-0">
      {/* Sección Superior: Logotipo y Menú */}
      <div className="flex flex-col">
        {/* Marca Arquitectónica en Caja Negra Invertida */}
        <div className="p-4 border-b-2 border-black bg-white">
          <div className="bg-black text-white px-2.5 py-1.5 text-xs font-black tracking-widest uppercase inline-block">
            PULSO // CAJA
          </div>
          <div className="text-[10px] text-black tracking-widest uppercase mt-2 font-mono font-bold">
            SISTEMA // ARQUITECTURA
          </div>
        </div>

        {/* Lista de Enlaces de Navegación con Cuadrícula Visible */}
        <nav className="border-b border-black">
          <ul className="m-0 p-0 list-none divide-y divide-black">
            {navItems.map((item) => {
              const activeClass = item.isActive
                ? 'bg-black text-white hover:bg-black hover:text-white'
                : 'bg-white text-black hover:bg-black hover:text-white';

              return (
                <li key={item.href} className="m-0 p-0">
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-3 text-xs font-bold tracking-wider no-underline transition-none ${activeClass}`}
                  >
                    <span className="font-mono mr-2.5 opacity-80">[{item.code}]</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Sección Inferior: Estado de Sesión y Salida Brutalista */}
      <div className="p-4 border-t-2 border-black bg-white flex flex-col gap-3">
        <div className="border border-black p-2.5 bg-white text-[10px] font-mono leading-tight">
          <div className="font-bold uppercase tracking-wider text-black">
            USUARIO: ADMIN
          </div>
          <div className="text-black uppercase tracking-wider mt-1 opacity-90">
            MULTI-TENANT: OK
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-2.5 px-3 border border-black bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-none text-center cursor-pointer"
        >
          SALIR
        </button>
      </div>
    </aside>
  );
}
