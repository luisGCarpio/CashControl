import type { Metadata } from 'next';
import './globals.css';
import LayoutShell from './components/LayoutShell';

export const metadata: Metadata = {
  title: 'Pulso Caja - Control de Flujo e Inventario',
  description: 'Gestión de caja real, inventario y movimientos financieros.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-white text-black min-h-screen antialiased selection:bg-black selection:text-white">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
