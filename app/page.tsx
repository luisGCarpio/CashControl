'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardData {
  vision: {
    disponible_actual: number;
    total_entradas: number;
    total_salidas: number;
    entradas_mes: number;
    salidas_mes: number;
  };
  movements: Array<{
    id: number;
    type: string;
    category: string;
    amount: number;
    description: string;
    movement_date: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error('No se pudieron cargar los datos.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <p>Cargando información...</p>;
  }

  if (error || !data) {
    return (
      <main>
        <h1>Dashboard</h1>
        <p className="error">{error || 'Error al cargar los datos.'}</p>
        <button type="button" onClick={loadData}>
          Reintentar
        </button>
      </main>
    );
  }

  const { vision, movements } = data;

  return (
    <main>
      <h1>Dashboard - Mi Negocio</h1>
      <p>Bienvenido. Aquí tienes el resumen básico de tu caja.</p>

      <section>
        <h2>Resumen de Dinero</h2>
        <ul>
          <li>
            <strong>Disponible en Caja:</strong> ${Math.round(vision.disponible_actual).toLocaleString()}
          </li>
          <li>
            <strong>Total Entradas (Ingresos):</strong> ${Math.round(vision.total_entradas).toLocaleString()}
          </li>
          <li>
            <strong>Total Salidas (Gastos):</strong> ${Math.round(vision.total_salidas).toLocaleString()}
          </li>
        </ul>
      </section>

      <section>
        <h2>Accesos Rápidos</h2>
        <p>
          <Link href="/movimientos">→ Ver y Registrar Movimientos</Link>
        </p>
        <p>
          <Link href="/productos">→ Ver y Administrar Productos</Link>
        </p>
      </section>

      <section>
        <h2>Últimos Movimientos Registrados</h2>
        {movements.length === 0 ? (
          <p>No hay movimientos registrados todavía.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {movements.slice(0, 10).map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.movement_date).toLocaleDateString()}</td>
                  <td>{m.type}</td>
                  <td>{m.description}</td>
                  <td>
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
