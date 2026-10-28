'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

interface LayoutShellProps {
  children: React.ReactNode;
}

export default function LayoutShell({ children }: LayoutShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // En la página de login: no mostrar la sidebar y centrar el contenido completamente
  if (isLoginPage) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-white">
        {children}
      </div>
    );
  }

  // En el resto del sistema: layout responsivo (columna en móvil, fila en desktop)
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      {/* Sidebar: barra superior móvil + drawer en móvil, aside persistente de 240px en desktop */}
      <Sidebar />

      {/* Contenedor de contenido principal con flex-1 min-w-0 y márgenes ergonómicos en móviles (p-4 md:p-10) */}
      <div className="flex-1 min-w-0 bg-white">
        <div className="p-4 md:p-10 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
