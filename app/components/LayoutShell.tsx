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

  // En el resto del sistema: cuadrícula/flex con dos columnas
  return (
    <div className="flex min-h-screen bg-white">
      {/* Columna Izquierda: Sidebar persistente y fija (ancho 240px) */}
      <Sidebar />

      {/* Columna Derecha: Contenido principal (<main>) con márgenes adecuados y fondo blanco */}
      <div className="flex-1 min-w-0 bg-white">
        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
