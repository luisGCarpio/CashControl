import type { Metadata } from 'next';
import './globals.css';
import Navbar from './components/Navbar';

export const metadata: Metadata = {
  title: 'Control de Caja Real | Entradas, Salidas y Alertas',
  description: 'Gestión de flujo de dinero, rentabilidad de productos y recordatorios de pago para negocios pequeños.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
