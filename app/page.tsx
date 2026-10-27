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
    return (
      <div className="py-16 text-center">
        <div className="inline-block border-2 border-black p-8 bg-white font-mono text-xs uppercase tracking-widest">
          [...] CARGANDO INFORMACIÓN DEL SISTEMA...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <main className="py-8 space-y-6">
        <div className="border-b-2 border-black pb-3">
          <h1 className="text-xl font-bold font-mono tracking-tight uppercase">
            DASHBOARD // ERROR DE CARGA
          </h1>
        </div>
        <div className="border-2 border-black bg-black text-white p-4 font-mono text-xs uppercase">
          [ERROR]: {error || 'No fue posible obtener los datos de la caja.'}
        </div>
        <button
          type="button"
          onClick={loadData}
          className="border-2 border-black bg-white hover:bg-black hover:text-white transition-none px-6 py-2 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          [⟳] REINTENTAR CARGA
        </button>
      </main>
    );
  }

  const { vision, movements } = data;

  return (
    <main className="space-y-8 py-4">
      {/* Encabezado superior con línea divisoria negra */}
      <header className="border-b-2 border-black pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
              PANEL PRINCIPAL DE CONTROL
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-black uppercase">
              DASHBOARD // RESUMEN FINANCIERO
            </h1>
          </div>
          <div className="text-[11px] font-mono text-neutral-600 uppercase tracking-wider">
            ESTADO // EN LÍNEA
          </div>
        </div>
      </header>

      {/* Cuadrícula de 3 cajas rectangulares */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CAJA 1: DINERO DISPONIBLE HOY */}
          <div className="border-2 border-black bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
                CAJA 01 // SALDO ACTUAL
              </div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                DINERO DISPONIBLE HOY
              </h2>
            </div>
            <div className="mt-4 pt-3 border-t border-black">
              <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-black tabular-nums">
                $ {Math.round(vision.disponible_actual).toLocaleString('es-CO')}
              </div>
              <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1 tracking-wide">
                DISPONIBLE EN CAJA
              </div>
            </div>
          </div>

          {/* CAJA 2: TOTAL ENTRADAS (INGRESOS) */}
          <div className="border-2 border-black bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
                CAJA 02 // FLUJO POSITIVO
              </div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                TOTAL ENTRADAS (INGRESOS)
              </h2>
            </div>
            <div className="mt-4 pt-3 border-t border-black">
              <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-black tabular-nums">
                + $ {Math.round(vision.total_entradas).toLocaleString('es-CO')}
              </div>
              <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1 tracking-wide">
                MES ACTUAL: $ {Math.round(vision.entradas_mes || 0).toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {/* CAJA 3: TOTAL SALIDAS (GASTOS) */}
          <div className="border-2 border-black bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
                CAJA 03 // FLUJO NEGATIVO
              </div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                TOTAL SALIDAS (GASTOS)
              </h2>
            </div>
            <div className="mt-4 pt-3 border-t border-black">
              <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-black tabular-nums">
                - $ {Math.round(vision.total_salidas).toLocaleString('es-CO')}
              </div>
              <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1 tracking-wide">
                MES ACTUAL: $ {Math.round(vision.salidas_mes || 0).toLocaleString('es-CO')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Accesos Rápidos con botones/enlaces tipo bloque */}
      <section className="space-y-3">
        <div className="border-b border-black pb-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
            ACCESOS RÁPIDOS // NAVEGACIÓN DIRECTA
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/movimientos"
            className="block border-2 border-black bg-white hover:bg-black hover:text-white transition-none p-4 text-xs font-mono font-bold uppercase tracking-wider group cursor-pointer"
          >
            <div className="text-[10px] text-neutral-500 group-hover:text-neutral-300 uppercase mb-1">
              GESTIÓN DE ENTRADAS Y SALIDAS
            </div>
            <div className="flex items-center justify-between">
              <span>[+] VER Y REGISTRAR MOVIMIENTOS</span>
              <span className="font-mono">→</span>
            </div>
          </Link>

          <Link
            href="/productos"
            className="block border-2 border-black bg-white hover:bg-black hover:text-white transition-none p-4 text-xs font-mono font-bold uppercase tracking-wider group cursor-pointer"
          >
            <div className="text-[10px] text-neutral-500 group-hover:text-neutral-300 uppercase mb-1">
              GESTIÓN DE STOCK E INVENTARIO
            </div>
            <div className="flex items-center justify-between">
              <span>[▤] VER Y ADMINISTRAR PRODUCTOS</span>
              <span className="font-mono">→</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Tabla de últimos movimientos con cuadrícula geométrica visible */}
      <section className="space-y-3">
        <div className="border-b border-black pb-2 flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
            ÚLTIMOS MOVIMIENTOS // ACTIVIDAD RECIENTE
          </h2>
          <span className="text-[11px] font-mono text-neutral-600 uppercase">
            REGISTROS: {movements.slice(0, 10).length}
          </span>
        </div>

        {movements.length === 0 ? (
          <div className="border-2 border-black p-8 text-center bg-white font-mono text-xs uppercase text-neutral-500">
            NO HAY MOVIMIENTOS REGISTRADOS EN LA BASE DE DATOS.
          </div>
        ) : (
          <div className="border-2 border-black overflow-x-auto bg-white">
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead>
                <tr className="bg-black text-white border-b-2 border-black">
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    FECHA
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    TIPO
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    CONCEPTO / DESCRIPCIÓN
                  </th>
                  <th className="p-3 font-bold uppercase tracking-wider text-right">
                    MONTO ($)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {movements.slice(0, 10).map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-neutral-100 transition-none border-b border-black last:border-b-0"
                  >
                    <td className="p-3 border-r border-black tabular-nums whitespace-nowrap">
                      {new Date(m.movement_date).toLocaleDateString('es-CO')}
                    </td>
                    <td className="p-3 border-r border-black whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 border border-black text-[10px] font-bold tracking-wider ${
                          m.type === 'ENTRADA'
                            ? 'bg-white text-black'
                            : 'bg-black text-white'
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td className="p-3 border-r border-black font-medium">
                      {m.description}
                    </td>
                    <td className="p-3 text-right tabular-nums font-bold whitespace-nowrap">
                      {m.type === 'ENTRADA' ? '+' : '-'} $
                      {Math.round(m.amount).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
