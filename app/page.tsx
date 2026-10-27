'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CashVision {
  total_entradas: number;
  total_salidas: number;
  disponible_actual: number;
  entradas_mes: number;
  salidas_mes: number;
}

interface Movement {
  id: number;
  user_id: number;
  type: 'ENTRADA' | 'SALIDA';
  category: string;
  amount: number;
  description: string;
  product_id?: number | null;
  quantity: number;
  is_unplanned: boolean;
  movement_date: string;
  product_name?: string | null;
}

interface DashboardResponse {
  vision: CashVision;
  movements: Movement[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) {
        throw new Error('Error al consultar el dashboard');
      }
      const json: DashboardResponse = await res.json();
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <p>Cargando información del dashboard...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Pulso Financiero - Dashboard</h1>
        <p className="text-red-500 font-semibold">{error || 'No se pudieron cargar los datos.'}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchDashboard();
          }}
          className="border border-gray-600 px-3 py-1 rounded text-sm hover:border-gray-400"
        >
          Reintentar
        </button>
      </main>
    );
  }

  const { vision, movements } = data;
  const recentMovements = movements?.slice(0, 10) || [];

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Pulso Financiero - Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Resumen operativo del flujo de caja del negocio.
        </p>
      </header>

      {/* Enlaces de navegación rápida */}
      <nav className="flex gap-4 text-sm font-medium">
        <Link href="/movimientos" className="underline hover:text-gray-300">
          Ir a Movimientos
        </Link>
        <Link href="/productos" className="underline hover:text-gray-300">
          Ir a Productos
        </Link>
      </nav>

      {/* Sección de métricas en lista semántica */}
      <section>
        <h2 className="text-lg font-bold mb-2">Métricas Principales</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            <strong>Dinero Disponible Hoy:</strong> ${Math.round(vision?.disponible_actual || 0).toLocaleString()}
          </li>
          <li>
            <strong>Total Entradas:</strong> ${Math.round(vision?.total_entradas || 0).toLocaleString()}
          </li>
          <li>
            <strong>Total Salidas:</strong> ${Math.round(vision?.total_salidas || 0).toLocaleString()}
          </li>
        </ul>
      </section>

      {/* Resumen de movimientos recientes en tabla nativa */}
      <section>
        <h2 className="text-lg font-bold mb-2">Movimientos Recientes</h2>
        {recentMovements.length === 0 ? (
          <p className="text-sm text-gray-400">No hay movimientos registrados.</p>
        ) : (
          <table className="w-full border-collapse border border-gray-700 text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-900">
                <th className="border border-gray-700 p-2">Fecha</th>
                <th className="border border-gray-700 p-2">Tipo</th>
                <th className="border border-gray-700 p-2">Categoría</th>
                <th className="border border-gray-700 p-2">Descripción</th>
                <th className="border border-gray-700 p-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {recentMovements.map((m) => (
                <tr key={m.id} className="border-b border-gray-700">
                  <td className="border border-gray-700 p-2">
                    {m.movement_date ? new Date(m.movement_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="border border-gray-700 p-2 font-semibold">
                    {m.type}
                  </td>
                  <td className="border border-gray-700 p-2">{m.category}</td>
                  <td className="border border-gray-700 p-2">{m.description}</td>
                  <td className="border border-gray-700 p-2 text-right font-mono">
                    {m.type === 'ENTRADA' ? '+' : '-'}${Math.round(m.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
