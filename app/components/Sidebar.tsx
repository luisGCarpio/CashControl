'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Si la ruta es '/login', la barra lateral no se debe mostrar
  if (pathname === '/login') {
    return null;
  }

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Cerrar menú móvil al presionar tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

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
      label: 'DASHBOARD',
      href: '/',
      isActive: pathname === '/',
    },
    {
      label: 'MOVIMIENTOS',
      href: '/movimientos',
      isActive: pathname === '/movimientos' || pathname.startsWith('/movimientos/'),
    },
    {
      label: 'PRODUCTOS',
      href: '/productos',
      isActive: pathname === '/productos' || pathname.startsWith('/productos/'),
    },
    {
      label: 'RECORDATORIOS',
      href: '/recordatorios',
      isActive: pathname === '/recordatorios' || pathname.startsWith('/recordatorios/'),
    },
  ];

  return (
    <>
      {/* Barra superior móvil (< 768px) */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-black px-4 py-3 flex items-center justify-between select-none">
        <div className="border border-black bg-black text-white py-1 px-3 text-xs font-bold uppercase tracking-wider text-center select-none inline-block">
          copia wood
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="border border-black bg-white hover:bg-black hover:text-white text-black py-1 px-3 text-xs font-bold uppercase tracking-wider transition-none cursor-pointer"
          aria-label="Abrir menú de navegación"
          aria-expanded={isMobileOpen}
        >
          Menú
        </button>
      </header>

      {/* Drawer móvil colapsable (< 768px) */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación principal"
            className="fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-white border-r border-black z-50 flex flex-col justify-between md:hidden select-none"
          >
            <div className="flex flex-col">
              <div className="p-4 border-b border-black bg-white flex items-center justify-between gap-2">
                <div className="w-full py-2.5 px-3 border border-black bg-black text-white text-xs font-bold uppercase tracking-wider text-center select-none">
                  copia wood
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="shrink-0 border border-black bg-white hover:bg-black hover:text-white text-black py-2.5 px-3 text-xs font-bold uppercase tracking-wider transition-none cursor-pointer"
                  aria-label="Cerrar menú de navegación"
                >
                  Cerrar
                </button>
              </div>

              <nav className="p-3">
                <ul className="m-0 p-0 list-none space-y-1">
                  {navItems.map((item) => {
                    const activeClass = item.isActive
                      ? 'bg-black text-white hover:bg-black hover:!text-white'
                      : 'bg-white text-black hover:bg-black hover:text-white hover:!text-white';

                    return (
                      <li key={item.href} className="m-0 p-0">
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileOpen(false)}
                          className={`flex items-center px-3 py-2.5 text-xs font-bold tracking-wider no-underline transition-none ${activeClass}`}
                        >
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            <div className="p-4 border-t border-black bg-white">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2.5 px-3 border border-black bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-none text-center cursor-pointer"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sidebar persistente en desktop (>= 768px) */}
      <aside className="hidden md:flex w-60 min-w-[240px] max-w-[240px] h-screen sticky top-0 bg-white border-r border-black flex-col justify-between select-none z-30 shrink-0">
        {/* Sección Superior: Logotipo y Menú */}
        <div className="flex flex-col">
          <div className="p-4 border-b border-black bg-white">
            <div className="w-full py-2.5 px-3 border border-black bg-black text-white text-xs font-bold uppercase tracking-wider text-center select-none">
              copia wood
            </div>
          </div>

          <nav className="p-3">
            <ul className="m-0 p-0 list-none space-y-1">
              {navItems.map((item) => {
                const activeClass = item.isActive
                  ? 'bg-black text-white hover:bg-black hover:!text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white hover:!text-white';

                return (
                  <li key={item.href} className="m-0 p-0">
                    <Link
                      href={item.href}
                      className={`flex items-center px-3 py-2.5 text-xs font-bold tracking-wider no-underline transition-none ${activeClass}`}
                    >
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Sección Inferior: Salida */}
        <div className="p-4 border-t border-black bg-white">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2.5 px-3 border border-black bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-none text-center cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
