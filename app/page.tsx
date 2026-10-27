'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Package,
  History,
  Check,
  AlertCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import MovementModal from './components/MovementModal';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'mensual' | 'semanal'>('mensual');
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      showFeedback('error', 'Error al sincronizar datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();

    // Sincronización en tiempo real cuando se registran movimientos desde el Navbar
    const handleDataChanged = () => {
      fetchDashboard();
    };

    window.addEventListener('pulso:datachanged', handleDataChanged);
    return () => {
      window.removeEventListener('pulso:datachanged', handleDataChanged);
    };
  }, [fetchDashboard]);

  if (loading || !data) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="animate-spin text-emerald-400" size={32} />
        <p className="text-sm font-medium">Cargando métricas de caja y pulso financiero...</p>
      </div>
    );
  }

  const { vision, chartStats, movements, products } = data;
  const activeBars = chartStats?.[chartMode] || [];
  const maxBarValue = Math.max(
    1,
    ...activeBars.map((b: any) => Math.max(b.entradas || 0, b.salidas || 0))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Toast de Feedback */}
      {feedback && (
        <div
          className={`fixed top-20 right-4 z-50 max-w-md p-4 rounded-xl shadow-2xl flex items-start gap-3 border transition-all animate-in fade-in slide-in-from-top-4 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/95 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="shrink-0 mt-0.5 text-emerald-400" size={18} />
          ) : (
            <AlertCircle className="shrink-0 mt-0.5 text-rose-400" size={18} />
          )}
          <div className="text-xs font-medium leading-relaxed">{feedback.message}</div>
        </div>
      )}

      {/* Modal de Movimiento Rápido */}
      <MovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        products={products}
        onMovementSaved={() => {
          fetchDashboard();
          showFeedback('success', 'Movimiento registrado exitosamente.');
        }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* ENCABEZADO Y ACCIÓN RÁPIDA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Resumen Financiero
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Estado en tiempo real de tu caja, balance del mes y evolución de flujo.
            </p>
          </div>
          <button
            onClick={() => setIsMovementModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle size={18} />
            <span>Registrar Movimiento</span>
          </button>
        </div>

        {/* 1. LAS 3 CARDS PRINCIPALES (SUPERIOR) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Saldo Disponible */}
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Dinero Disponible Hoy (Caja Real)</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Wallet size={20} />
              </div>
            </div>
            <p
              className={`text-3xl sm:text-4xl font-extrabold mt-3 tracking-tight ${
                vision?.disponible_actual >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ${Math.round(vision?.disponible_actual || 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Saldo neto disponible tras registrar todas las operaciones
            </p>
          </div>

          {/* Card 2: Total Entradas */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Total Entradas (Ingresos)</span>
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-100 mt-3 tracking-tight">
              ${Math.round(vision?.total_entradas || 0).toLocaleString()}
            </p>
            <p className="text-xs text-sky-400 mt-3 font-medium">
              Este mes: +${Math.round(vision?.entradas_mes || 0).toLocaleString()}
            </p>
          </div>

          {/* Card 3: Total Salidas */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Total Salidas (Gastos + Compras)</span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <TrendingDown size={20} />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-100 mt-3 tracking-tight">
              ${Math.round(vision?.total_salidas || 0).toLocaleString()}
            </p>
            <p className="text-xs text-rose-400 mt-3 font-medium">
              Este mes: -${Math.round(vision?.salidas_mes || 0).toLocaleString()}
            </p>
          </div>
        </section>

        {/* 2. ESTADÍSTICA DE ENTRADAS VS SALIDAS (GRÁFICO) */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="text-emerald-400" size={20} />
                Estadística: Entradas vs Salidas
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparativa gráfica de ingresos percibidos frente a egresos efectuados.
              </p>
            </div>

            {/* Selector Mensual / Semanal */}
            <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setChartMode('mensual')}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                  chartMode === 'mensual'
                    ? 'bg-emerald-500 text-slate-950 shadow font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Últimos Meses
              </button>
              <button
                onClick={() => setChartMode('semanal')}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                  chartMode === 'semanal'
                    ? 'bg-emerald-500 text-slate-950 shadow font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Últimas Semanas
              </button>
            </div>
          </div>

          {/* Gráfico de Barras */}
          {activeBars.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
              No hay movimientos registrados para proyectar la gráfica aún.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {activeBars.map((bar: any, idx: number) => {
                  const entHeight = (bar.entradas / maxBarValue) * 100;
                  const salHeight = (bar.salidas / maxBarValue) * 100;
                  const saldoNeto = bar.entradas - bar.salidas;

                  return (
                    <div
                      key={idx}
                      className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition"
                    >
                      <span className="text-[11px] font-semibold text-slate-400 truncate">
                        {bar.periodo}
                      </span>

                      {/* Contenedor de barras */}
                      <div className="h-28 flex items-end justify-center gap-2 my-2 pt-2">
                        {/* Barra Entradas */}
                        <div className="w-4 bg-slate-900 rounded-t flex items-end h-full">
                          <div
                            style={{ height: `${Math.max(4, entHeight)}%` }}
                            className="w-full bg-emerald-500 rounded-t transition-all duration-500"
                            title={`Entradas: $${Math.round(bar.entradas).toLocaleString()}`}
                          />
                        </div>

                        {/* Barra Salidas */}
                        <div className="w-4 bg-slate-900 rounded-t flex items-end h-full">
                          <div
                            style={{ height: `${Math.max(4, salHeight)}%` }}
                            className="w-full bg-rose-500 rounded-t transition-all duration-500"
                            title={`Salidas: $${Math.round(bar.salidas).toLocaleString()}`}
                          />
                        </div>
                      </div>

                      {/* Cifras numéricas */}
                      <div className="text-[10px] space-y-0.5 border-t border-slate-800/60 pt-1.5">
                        <div className="flex justify-between text-emerald-400 font-medium">
                          <span>In:</span>
                          <span>${Math.round(bar.entradas).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-rose-400 font-medium">
                          <span>Out:</span>
                          <span>${Math.round(bar.salidas).toLocaleString()}</span>
                        </div>
                        <div
                          className={`flex justify-between font-bold pt-0.5 border-t border-slate-800/40 ${
                            saldoNeto >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          <span>Neto:</span>
                          <span>${Math.round(saldoNeto).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leyenda del gráfico */}
              <div className="flex items-center justify-end gap-5 text-xs text-slate-400 pt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                  <span>Entradas (Ventas / Aportes)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-rose-500"></div>
                  <span>Salidas (Compras / Gastos)</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 3. ACCESOS DIRECTOS Y VISTAS PREVIAS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Tarjeta de Acceso a Movimientos */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <History size={18} />
                  </div>
                  <h3 className="text-base font-bold text-white">Historial de Movimientos</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {movements?.length || 0} registros
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Consulta todas las transacciones de entrada y salida, filtra por categoría, busca por concepto o elimina registros.
              </p>

              {/* Últimos 3 movimientos */}
              <div className="mt-4 space-y-2">
                {movements?.slice(0, 3).map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/60 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {m.type === 'ENTRADA' ? (
                        <ArrowUpRight className="text-emerald-400 shrink-0" size={16} />
                      ) : (
                        <ArrowDownRight className="text-rose-400 shrink-0" size={16} />
                      )}
                      <span className="font-medium text-slate-200 truncate">{m.description}</span>
                    </div>
                    <span
                      className={`font-semibold shrink-0 ml-2 ${
                        m.type === 'ENTRADA' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.type === 'ENTRADA' ? '+' : '-'}${Math.round(m.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/movimientos"
              className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
            >
              <span>Ver Historial Completo</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Tarjeta de Acceso a Productos / Catálogo */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                    <Package size={18} />
                  </div>
                  <h3 className="text-base font-bold text-white">Control de Productos y Stock</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {products?.length || 0} en catálogo
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Administra tu catálogo de reventa o producción, calcula tus márgenes de ganancia y supervisa las existencias en tiempo real.
              </p>

              {/* Muestra rápida de 3 productos */}
              <div className="mt-4 space-y-2">
                {products?.slice(0, 3).map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/60 text-xs"
                  >
                    <div className="truncate">
                      <span className="font-medium text-slate-200">{p.name}</span>
                      <span className="text-[10px] text-slate-500 ml-2">Stock: {p.stock} uds</span>
                    </div>
                    <span className="font-semibold text-sky-400 shrink-0 ml-2">
                      ${Math.round(p.sale_price).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href="/productos"
              className="mt-5 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
            >
              <span>Gestionar Productos y Catálogo</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
