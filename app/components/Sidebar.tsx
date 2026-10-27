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
    {
      code: '04',
      label: 'RECORDATORIOS',
      href: '/recordatorios',
      isActive: pathname === '/recordatorios' || pathname.startsWith('/recordatorios/'),
    },
  ];

  return (
    <>
      {/* Barra superior móvil (< 768px) */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b-2 border-black px-4 py-3 flex items-center justify-between select-none">
        <div className="bg-black text-white px-2.5 py-1 text-xs font-black tracking-widest uppercase">
          PULSO // CAJA
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="border border-black bg-white px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-none"
          aria-label="Abrir menú de navegación"
          aria-expanded={isMobileOpen}
        >
          [MENÚ]
        </button>
      </header>

      {/* Drawer móvil colapsable con fondo oscuro (< 768px) */}
      {isMobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50 md:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación principal"
            className="fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-white border-r-2 border-black z-50 flex flex-col justify-between md:hidden select-none"
          >
            <div className="flex flex-col">
              <div className="p-4 border-b-2 border-black bg-white flex items-center justify-between">
                <div>
                  <div className="bg-black text-white px-2 py-1 text-xs font-black tracking-widest uppercase inline-block">
                    PULSO // CAJA
                  </div>
                  <div className="text-[10px] text-black tracking-widest uppercase mt-1.5 font-mono font-bold">
                    SISTEMA // ARQUITECTURA
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="border border-black bg-white px-2 py-1 text-xs font-mono font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-none"
                  aria-label="Cerrar menú de navegación"
                >
                  [X] CERRAR
                </button>
              </div>

              <nav className="border-b border-black">
                <ul className="m-0 p-0 list-none divide-y divide-black">
                  {navItems.map((item) => {
                    const activeClass = item.isActive
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-black hover:text-white';

                    return (
                      <li key={item.href} className="m-0 p-0">
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileOpen(false)}
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
          </div>
        </>
      )}

      {/* Sidebar persistente en desktop (>= 768px) */}
      <aside className="hidden md:flex w-60 min-w-[240px] max-w-[240px] h-screen sticky top-0 bg-white border-r-2 border-black flex-col justify-between select-none z-30 shrink-0">
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
    </>
  );
}
