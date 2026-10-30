'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  EntradaModal,
  SalidaModal,
  ArqueoModal,
  BrutalistCashFlowChart,
} from '@/app/components';
import { formatCurrency, formatCategory } from '@/lib/formatters';
import type { ExecutiveDashboardDTO } from '@/app/modules/movements/service';

export type DashboardPeriod = 'este-mes' | 'mes-anterior' | 'ultimos-30-dias' | 'este-ano';

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: 'este-mes', label: '[ESTE MES]' },
  { id: 'mes-anterior', label: '[MES ANTERIOR]' },
  { id: 'ultimos-30-dias', label: '[ÚLTIMOS 30 DÍAS]' },
  { id: 'este-ano', label: '[ESTE AÑO]' },
];

export default function DashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardDTO | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>('este-mes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modales operativos
  const [isEntradaOpen, setIsEntradaOpen] = useState(false);
  const [isSalidaOpen, setIsSalidaOpen] = useState(false);
  const [isArqueoOpen, setIsArqueoOpen] = useState(false);

  const loadData = useCallback(async (period: DashboardPeriod) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/dashboard?period=${period}`);
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error('No se pudieron cargar los datos del dashboard.');
      }
      const json: ExecutiveDashboardDTO = await res.json();
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión con el servidor.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedPeriod);
  }, [selectedPeriod, loadData]);

  const handlePeriodChange = (period: DashboardPeriod) => {
    if (period === selectedPeriod) return;
    setSelectedPeriod(period);
  };

  const handleRefresh = () => {
    loadData(selectedPeriod);
  };

  const currentPeriodOption =
    PERIOD_OPTIONS.find((p) => p.id === selectedPeriod) || PERIOD_OPTIONS[0];

  const dineroDisponible = data?.disponible_hoy ?? data?.disponible_actual ?? 0;
  const rendimientoNeto = data?.rendimiento_neto ?? data?.flujo_neto_periodo ?? 0;
  const entradasPeriodo = data?.total_entradas_periodo ?? data?.entradas_periodo ?? 0;
  const salidasPeriodo = data?.total_salidas_periodo ?? data?.salidas_periodo ?? 0;
  const gananciaBruta = data?.ganancia_bruta_real ?? 0;
  const margenBruto = data?.margen_bruto_pct ?? 0;

  const hayFuga =
    data?.alerta_fuga_no_planeados?.hay_fuga ||
    (data?.gastos_no_planeados_total ?? 0) > 0 ||
    (data?.gastos_no_planeados?.total ?? 0) > 0;
  const montoFuga =
    data?.alerta_fuga_no_planeados?.total_no_planeado ??
    data?.gastos_no_planeados_total ??
    data?.gastos_no_planeados?.total ??
    0;
  const pctFuga =
    data?.alerta_fuga_no_planeados?.porcentaje_sobre_salidas ??
    data?.gastos_no_planeados_pct ??
    data?.gastos_no_planeados?.percentage ??
    0;
  const conteoFuga = data?.alerta_fuga_no_planeados?.conteo || 1;

  const urgentesTotalCount =
    data?.obligaciones_pendientes?.total_urgentes ?? data?.urgentes_count ?? 0;
  const urgentesMonto =
    data?.obligaciones_pendientes?.monto_total ?? data?.urgentes_total ?? 0;
  const urgentesVencidasCount =
    data?.obligaciones_pendientes?.vencidas_conteo ??
    (data?.reminders || []).filter((r) => Number(r.days_remaining) < 0).length;
  const urgentesList =
    data?.obligaciones_pendientes?.items ??
    (data?.reminders || []).filter((r) => !r.is_completed && Number(r.days_remaining) <= 3);

  return (
    <main className="space-y-8 py-4">
      {/* Cabecera Principal y Barra de Acciones */}
      <header className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-black uppercase">
              Dashboard Financiero Ejecutivo
            </h1>
            <p className="text-xs font-mono text-black uppercase mt-1">
              Control de liquidez, rentabilidad y flujo monetario en tiempo real
            </p>
          </div>

          {/* Accesos directos operativos: Arqueo, Entrada, Salida */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsArqueoOpen(true)}
              className="h-9 border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-3 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              [ARQUEO DE CAJA]
            </button>
            <button
              type="button"
              onClick={() => setIsEntradaOpen(true)}
              className="h-9 border border-black bg-black text-white hover:bg-white hover:text-black transition-none px-3 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              + Registrar Entrada
            </button>
            <button
              type="button"
              onClick={() => setIsSalidaOpen(true)}
              className="h-9 border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-3 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              - Registrar Salida
            </button>
          </div>
        </div>

        {/* Selector de Período en la cabecera (botones de altura universal h-9) */}
        <div
          className="flex flex-wrap items-center gap-2 pt-2 border-t border-black"
          role="group"
          aria-label="Selector de período de análisis financiero"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-black mr-2">
            PERÍODO:
          </span>
          {PERIOD_OPTIONS.map((opt) => {
            const isActive = opt.id === selectedPeriod;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handlePeriodChange(opt.id)}
                aria-pressed={isActive}
                className={`h-9 px-3 border border-black font-mono text-xs font-bold uppercase tracking-wider transition-none ${
                  isActive
                    ? 'bg-black text-white cursor-default'
                    : 'bg-white text-black hover:bg-black hover:text-white cursor-pointer'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Manejo de Estados de Carga y Error */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block border border-black p-6 bg-white font-mono text-xs uppercase tracking-widest text-black font-bold">
            Cargando tablero financiero...
          </div>
        </div>
      ) : error || !data ? (
        <section className="space-y-4">
          <div className="border border-black bg-black text-white p-4 font-mono text-xs uppercase font-bold">
            {error || 'No fue posible obtener los datos de la caja.'}
          </div>
          <button
            type="button"
            onClick={() => loadData(selectedPeriod)}
            className="h-9 border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-6 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Reintentar carga
          </button>
        </section>
      ) : (
        <>
          {/* Tarjeta Hero Financiero */}
          <section
            aria-label="Dinero disponible y balance neto"
            className="border border-black bg-black text-white p-6 sm:p-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <p className="text-xs font-mono font-bold uppercase tracking-widest text-white">
                  Dinero disponible hoy (total caja / bancos)
                </p>
                <div className="mt-2 text-3xl sm:text-5xl font-mono font-bold tracking-tight text-white tabular-nums">
                  $ {formatCurrency(dineroDisponible)}{' '}
                  <span className="text-sm sm:text-base font-normal">COP</span>
                </div>
              </div>
              <div className="flex sm:flex-col sm:items-end justify-between gap-1 pt-4 sm:pt-0 border-t sm:border-t-0 border-white">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white">
                  Rendimiento neto ({currentPeriodOption.label.replace(/[\[\]]/g, '')})
                </span>
                <span className="text-xl sm:text-2xl font-mono font-bold tabular-nums text-white">
                  {rendimientoNeto >= 0 ? '+' : '-'} ${' '}
                  {formatCurrency(Math.abs(rendimientoNeto))}
                </span>
              </div>
            </div>
          </section>

          {/* Tira Métrica de Desempeño */}
          <section
            aria-label="Métricas de desempeño financiero del período"
            className="border border-black bg-white flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-black font-mono text-xs"
          >
            {/* Ganancia Bruta Real Estimada */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <span className="font-bold uppercase tracking-wider text-black">
                Ganancia bruta real estimada
              </span>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-black tabular-nums">
                  $ {formatCurrency(gananciaBruta)}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-wider font-bold text-black">
                  Margen bruto: <span className="tabular-nums">{margenBruto}%</span>
                </div>
              </div>
            </div>

            {/* Entradas del período */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <span className="font-bold uppercase tracking-wider text-black">
                Entradas del período
              </span>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-black tabular-nums">
                  + $ {formatCurrency(entradasPeriodo)}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-wider text-black">
                  Ingresos totales registrados
                </div>
              </div>
            </div>

            {/* Salidas del período */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <span className="font-bold uppercase tracking-wider text-black">
                Salidas del período
              </span>
              <div className="mt-3">
                <div className="text-xl sm:text-2xl font-bold tracking-tight text-black tabular-nums">
                  - $ {formatCurrency(salidasPeriodo)}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-wider text-black">
                  Egresos totales acumulados
                </div>
              </div>
            </div>
          </section>

          {/* Gráfico de Flujo de Caja Monetario Brutalista */}
          <section className="space-y-3" aria-label="Gráfico de flujo de caja">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
                Flujo de caja monetario
              </h2>
              <span className="text-[11px] font-mono uppercase text-black font-bold">
                PERÍODO: {currentPeriodOption.label.replace(/[\[\]]/g, '')}
              </span>
            </div>
            <BrutalistCashFlowChart data={data.serie_flujo_caja} height={280} />
          </section>

          {/* Desglose de Gastos por Categoría */}
          <section className="space-y-4" aria-label="Desglose de egresos por categoría">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
                Desglose de gastos por categoría
              </h2>
              <span className="text-[11px] font-mono uppercase text-black font-bold tabular-nums">
                TOTAL: - $ {formatCurrency(salidasPeriodo)}
              </span>
            </div>

            {/* Alerta destacada de fuga de gastos no planeados */}
            {hayFuga && (
              <div
                role="alert"
                className="border border-black bg-black text-white p-4 font-mono text-xs uppercase"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="font-bold tracking-wider">
                    [!] ALERTA DE FUGA: SE DETECTARON GASTOS NO PLANEADOS POR ${' '}
                    {formatCurrency(montoFuga)} ({pctFuga}% DEL TOTAL DE EGRESOS).
                  </span>
                  <span className="text-[10px] font-bold tracking-widest border border-white px-2 py-0.5 whitespace-nowrap self-start sm:self-auto">
                    {conteoFuga} REGISTRO{conteoFuga > 1 ? 'S' : ''}
                  </span>
                </div>
              </div>
            )}

            {(!data.desglose_gastos || data.desglose_gastos.length === 0) ? (
              <div className="border border-black p-8 text-center bg-white font-mono text-xs uppercase text-black font-bold">
                No hay egresos registrados en el período seleccionado.
              </div>
            ) : (
              <div className="border border-black bg-white divide-y divide-black font-mono text-xs">
                {data.desglose_gastos.map((item) => {
                  const catName =
                    (item as any).nombre || item.label || formatCategory(item.category);
                  const catMonto =
                    (item as any).monto ?? item.amount ?? 0;
                  const catPct =
                    (item as any).porcentaje ?? item.percentage ?? 0;
                  const catKey =
                    (item as any).categoria || item.category || catName;

                  return (
                    <div key={catKey} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-4 font-bold uppercase">
                        <span className="truncate">{catName}</span>
                        <div className="flex items-center gap-4 shrink-0 tabular-nums">
                          <span>{catPct}%</span>
                          <span>- $ {formatCurrency(catMonto)}</span>
                        </div>
                      </div>
                      {/* Barra visual brutalista: 10px alto, contenedor blanco con borde negro, relleno negro */}
                      <div className="h-[10px] w-full border border-black bg-white overflow-hidden">
                        <div
                          className="h-full bg-black transition-none"
                          style={{ width: `${Math.min(100, Math.max(0, catPct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sección de Obligaciones Financieras Pendientes */}
          <section className="space-y-3" aria-label="Obligaciones financieras pendientes">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
                Obligaciones financieras pendientes
              </h2>
              <Link
                href="/recordatorios"
                className="font-mono text-xs font-bold uppercase underline text-black hover:bg-black hover:text-white hover:no-underline px-1 transition-none"
              >
                [VER TODOS LOS RECORDATORIOS →]
              </Link>
            </div>

            {urgentesTotalCount === 0 ? (
              <div className="border border-black p-6 bg-white font-mono text-xs uppercase text-black flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="font-bold">
                  NO HAY OBLIGACIONES PENDIENTES URGENTES EN ESTE MOMENTO.
                </span>
                <Link
                  href="/recordatorios"
                  className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider shrink-0 no-underline"
                >
                  Programar obligación →
                </Link>
              </div>
            ) : (
              <div className="border border-black bg-white">
                <div className="p-4 bg-black text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 font-mono text-xs uppercase font-bold">
                  <span>
                    [!] {urgentesTotalCount} COMPROMISO{urgentesTotalCount > 1 ? 'S' : ''} URGENTE{urgentesTotalCount > 1 ? 'S' : ''}
                    {urgentesVencidasCount > 0 &&
                      ` (${urgentesVencidasCount} VENCIDA${
                        urgentesVencidasCount > 1 ? 'S' : ''
                      })`}
                  </span>
                  <span className="tabular-nums">
                    TOTAL: $ {formatCurrency(urgentesMonto)}
                  </span>
                </div>
                <div className="divide-y divide-black font-mono text-xs">
                  {urgentesList.map((rem) => (
                    <div
                      key={rem.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {Number(rem.days_remaining) < 0 ? (
                            <span className="border border-black bg-black text-white px-1.5 py-0.5 text-[10px] font-bold uppercase">
                              [VENCIDO HACE {Math.abs(Number(rem.days_remaining))} DÍAS]
                            </span>
                          ) : Number(rem.days_remaining) === 0 ? (
                            <span className="border border-black bg-black text-white px-1.5 py-0.5 text-[10px] font-bold uppercase">
                              [VENCE HOY]
                            </span>
                          ) : (
                            <span className="border border-black bg-white text-black px-1.5 py-0.5 text-[10px] font-bold uppercase">
                              [VENCE EN {rem.days_remaining} DÍAS]
                            </span>
                          )}
                          <span className="font-bold text-black uppercase">{rem.title}</span>
                        </div>
                        <div className="text-[11px] text-black uppercase">
                          Vence: {rem.due_date} | Categoría: {formatCategory(rem.category)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <span className="font-bold tabular-nums text-black text-sm">
                          $ {formatCurrency(rem.amount)}
                        </span>
                        <Link
                          href="/recordatorios"
                          className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-3 py-1 text-[11px] font-bold uppercase tracking-wider no-underline"
                        >
                          Pagar →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Accesos Directos Operativos a Módulos */}
          <section className="space-y-3" aria-label="Accesos directos a módulos operativos">
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
              Módulos del sistema
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/movimientos"
                className="flex items-center justify-between border border-black bg-white hover:bg-black hover:text-white transition-none p-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer no-underline text-black"
              >
                <span>Movimientos de caja</span>
                <span className="font-mono">→</span>
              </Link>

              <Link
                href="/productos"
                className="flex items-center justify-between border border-black bg-white hover:bg-black hover:text-white transition-none p-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer no-underline text-black"
              >
                <span>Catálogo de productos</span>
                <span className="font-mono">→</span>
              </Link>

              <Link
                href="/recordatorios"
                className="flex items-center justify-between border border-black bg-white hover:bg-black hover:text-white transition-none p-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer no-underline text-black"
              >
                <span>Control de recordatorios</span>
                <span className="font-mono">→</span>
              </Link>
            </div>
          </section>
        </>
      )}

      {/* Modales Modulares */}
      <ArqueoModal
        isOpen={isArqueoOpen}
        onClose={() => setIsArqueoOpen(false)}
        onMovementCreated={handleRefresh}
      />
      <EntradaModal
        isOpen={isEntradaOpen}
        onClose={() => setIsEntradaOpen(false)}
        onSuccess={handleRefresh}
      />
      <SalidaModal
        isOpen={isSalidaOpen}
        onClose={() => setIsSalidaOpen(false)}
        onSuccess={handleRefresh}
      />
    </main>
  );
}
