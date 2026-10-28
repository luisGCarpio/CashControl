'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Pagination from './components/Pagination';
import EntradaModal from './components/EntradaModal';
import SalidaModal from './components/SalidaModal';
import { formatDate, formatCategory } from '@/lib/formatters';

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
  reminders?: Array<{
    id: number;
    title: string;
    amount: number;
    category: string;
    frequency: string;
    due_date: string;
    days_remaining: number;
    is_completed: boolean;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [isEntradaOpen, setIsEntradaOpen] = useState(false);
  const [isSalidaOpen, setIsSalidaOpen] = useState(false);

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
    return (
      <div className="py-16 text-center">
        <div className="inline-block border border-black p-6 bg-white font-mono text-xs uppercase tracking-widest text-black">
          Cargando información...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <main className="py-8 space-y-6">
        <h1 className="text-xl font-bold font-mono tracking-tight uppercase text-black">
          Error al cargar datos
        </h1>
        <div className="border border-black bg-black text-white p-4 font-mono text-xs uppercase">
          {error || 'No fue posible obtener los datos de la caja.'}
        </div>
        <button
          type="button"
          onClick={loadData}
          className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-6 py-2 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          Reintentar carga
        </button>
      </main>
    );
  }

  const { vision, movements, reminders } = data;

  // Filtrado de obligaciones pendientes urgentes (vencidas o a vencer en <= 3 días)
  const urgentReminders = (reminders || []).filter(
    (r) => !r.is_completed && r.days_remaining <= 3
  );
  const urgentCount = urgentReminders.length;
  const urgentTotal = urgentReminders.reduce(
    (acc, r) => acc + (Number(r.amount) || 0),
    0
  );
  const overdueCount = urgentReminders.filter((r) => r.days_remaining < 0).length;

  const flujoNetoMes = (vision.entradas_mes || 0) - (vision.salidas_mes || 0);

  return (
    <main className="space-y-8 py-4">
      {/* Encabezado */}
      <header className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-black uppercase">
          Resumen Financiero
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEntradaOpen(true)}
            className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none py-2 px-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
          >
            + Registrar Entrada
          </button>
          <button
            type="button"
            onClick={() => setIsSalidaOpen(true)}
            className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none py-2 px-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
          >
            - Registrar Salida
          </button>
        </div>
      </header>

      {/* Resumen Financiero Ejecutivo: Hero de Balance y Desglose Mensual */}
      <section className="space-y-4">
        {/* TARJETA HERO: DINERO DISPONIBLE HOY */}
        <div className="border border-black bg-black text-white p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-white">
                Dinero disponible
              </p>
              <div className="mt-2 text-3xl sm:text-5xl font-mono font-bold tracking-tight text-white tabular-nums">
                $ {Math.round(vision.disponible_actual).toLocaleString('es-CO')}{' '}
                <span className="text-sm sm:text-base font-normal">COP</span>
              </div>
            </div>
            <div className="flex sm:flex-col sm:items-end justify-between gap-1 pt-2 sm:pt-0">
              <span className="text-[10px] font-mono uppercase tracking-widest text-white">
                Rendimiento neto mes
              </span>
              <span className="text-base sm:text-lg font-mono font-bold tabular-nums text-white">
                {flujoNetoMes >= 0 ? '+' : '-'} $ {Math.round(Math.abs(flujoNetoMes)).toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </div>

        {/* DESGLOSE DEL MES (ENTRADAS VS SALIDAS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ENTRADAS DEL MES */}
          <div className="border border-black bg-white p-5 flex flex-col justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-black">
              Entradas del mes
            </span>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-black tabular-nums">
                + $ {Math.round(vision.entradas_mes || 0).toLocaleString('es-CO')}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-black uppercase">
                <span>Total histórico</span>
                <span className="tabular-nums font-bold">
                  + $ {Math.round(vision.total_entradas).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          </div>

          {/* SALIDAS DEL MES */}
          <div className="border border-black bg-white p-5 flex flex-col justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-black">
              Salidas del mes
            </span>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-black tabular-nums">
                - $ {Math.round(vision.salidas_mes || 0).toLocaleString('es-CO')}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-black uppercase">
                <span>Total histórico</span>
                <span className="tabular-nums font-bold">
                  - $ {Math.round(vision.total_salidas).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Banner de alerta financiera (Pagos vencidos / próximos) */}
      {urgentCount > 0 && (
        <section aria-label="Alerta de obligaciones financieras pendientes">
          <Link
            href="/recordatorios"
            className="block border border-black bg-black text-white hover:bg-white hover:text-black transition-none p-3.5 sm:p-4 font-mono text-xs font-bold uppercase tracking-wider no-underline cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>
                [!] ATENCIÓN: {urgentCount}{' '}
                {urgentCount === 1 ? 'OBLIGACIÓN PENDIENTE' : 'OBLIGACIONES PENDIENTES'}
                {overdueCount > 0 ? ` (${overdueCount} VENCIDA${overdueCount > 1 ? 'S' : ''})` : ''}{' '}
                (TOTAL: $ {Math.round(urgentTotal).toLocaleString('es-CO')})
              </span>
              <span className="underline whitespace-nowrap font-bold">
                [VER RECORDATORIOS &rarr;]
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* Accesos directos */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
          Accesos directos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/movimientos"
            className="flex items-center justify-between border border-black bg-white hover:bg-black hover:text-white transition-none p-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer no-underline text-black"
          >
            <span>Ver y registrar movimientos</span>
            <span className="font-mono">→</span>
          </Link>

          <Link
            href="/productos"
            className="flex items-center justify-between border border-black bg-white hover:bg-black hover:text-white transition-none p-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer no-underline text-black"
          >
            <span>Ver y administrar productos</span>
            <span className="font-mono">→</span>
          </Link>
        </div>
      </section>

      {/* Tabla de últimos movimientos */}
      <section className="space-y-3">
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
          Últimos movimientos
        </h2>

        {movements.length === 0 ? (
          <div className="border border-black p-8 text-center bg-white font-mono text-xs uppercase text-black">
            No hay movimientos registrados en la base de datos.
          </div>
        ) : (
          <div className="border border-black bg-white">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left font-mono text-xs">
                <thead>
                  <tr className="bg-black text-white">
                    <th scope="col" className="w-[15%] p-3 border-r border-white font-bold uppercase tracking-wider">
                      Fecha
                    </th>
                    <th scope="col" className="w-[15%] p-3 border-r border-white font-bold uppercase tracking-wider">
                      Tipo
                    </th>
                    <th scope="col" className="w-[18%] p-3 border-r border-white font-bold uppercase tracking-wider">
                      Categoría
                    </th>
                    <th scope="col" className="w-[37%] p-3 border-r border-white font-bold uppercase tracking-wider">
                      Concepto / Descripción
                    </th>
                    <th scope="col" className="w-[15%] p-3 font-bold uppercase tracking-wider text-right">
                      Monto ($)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black bg-white">
                  {movements
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((m) => (
                      <tr
                        key={m.id}
                        className="transition-none bg-white"
                      >
                        <td className="p-3 border-r border-black tabular-nums whitespace-nowrap text-black">
                          {formatDate(m.movement_date)}
                        </td>
                        <td className="p-3 border-r border-black whitespace-nowrap">
                          {m.type === 'ENTRADA' ? (
                            <span className="border border-black bg-white text-black px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-block">
                              [+] ENTRADA
                            </span>
                          ) : (
                            <span className="border border-black bg-black text-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-block">
                              [-] SALIDA
                            </span>
                          )}
                        </td>
                        <td className="p-3 border-r border-black whitespace-nowrap">
                          <span className="border border-black px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-white text-black inline-block">
                            {formatCategory(m.category)}
                          </span>
                        </td>
                        <td className="p-3 border-r border-black font-medium text-black truncate" title={m.description}>
                          {m.description}
                        </td>
                        <td className="p-3 text-right tabular-nums font-bold whitespace-nowrap text-black">
                          {m.type === 'ENTRADA' ? '+' : '-'} $
                          {Math.round(m.amount).toLocaleString('es-CO')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.max(1, Math.ceil(movements.length / itemsPerPage))}
              onPageChange={setCurrentPage}
              totalItems={movements.length}
              itemsPerPage={itemsPerPage}
              itemName="movimientos"
            />
          </div>
        )}
      </section>

      <EntradaModal
        isOpen={isEntradaOpen}
        onClose={() => setIsEntradaOpen(false)}
        onSuccess={loadData}
      />
      <SalidaModal
        isOpen={isSalidaOpen}
        onClose={() => setIsSalidaOpen(false)}
        onSuccess={loadData}
      />
    </main>
  );
}
