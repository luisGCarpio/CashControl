'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  Search,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Flame,
  Package,
  Calendar,
  Filter,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';
import MovementModal, { ProductOption } from '@/app/components/MovementModal';

export interface Movement {
  id: number;
  type: 'ENTRADA' | 'SALIDA';
  category: string;
  amount: number;
  description: string;
  product_id: number | null;
  product_name?: string | null;
  quantity?: number;
  is_unplanned?: boolean;
  movement_date: string;
}

export interface CashVision {
  total_entradas: number;
  total_salidas: number;
  disponible_actual: number;
  entradas_mes?: number;
  salidas_mes?: number;
}

// Diccionario de categorías con etiquetas amigables y estilos de badge
const CATEGORY_MAP: Record<
  string,
  { label: string; badgeClass: string }
> = {
  VENTA_PRODUCTO: {
    label: 'Venta de Producto',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  APORTE_CAPITAL: {
    label: 'Inyección de Capital',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  OTRO_INGRESO: {
    label: 'Otro Ingreso',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  COMPRA_CATALOGO: {
    label: 'Compra Mercancía (Catálogo)',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  MATERIA_PRIMA: {
    label: 'Materia Prima / Insumos',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  EMPAQUES_ENVIOS: {
    label: 'Empaques / Envíos',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  SERVICIOS_ARRIENDO: {
    label: 'Servicios / Arriendo',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
  PUBLICIDAD: {
    label: 'Publicidad / Redes',
    badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  },
  GASTO_NO_PLANEADO: {
    label: 'Gasto Hormiga / Imprevisto',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  RETIRO_PERSONAL: {
    label: 'Retiro Personal',
    badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  },
};

function formatCategory(catKey: string): { label: string; badgeClass: string } {
  if (CATEGORY_MAP[catKey]) {
    return CATEGORY_MAP[catKey];
  }
  // Si es una categoría personalizada o no indexada
  const formatted = catKey
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    label: formatted,
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
  };
}

export default function MovimientosPage() {
  const router = useRouter();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [vision, setVision] = useState<CashVision | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Barra de control y filtros
  const [activeTab, setActiveTab] = useState<'TODOS' | 'ENTRADAS' | 'SALIDAS'>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal de registro
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Modal / Confirmación de eliminación
  const [movementToDelete, setMovementToDelete] = useState<Movement | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Feedback Toasts
  const [toast, setToast] = useState<{
    id: number;
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToast({ id, type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al obtener movimientos');

      setMovements(json.movements || []);
      setProducts(json.products || []);
      setVision(json.vision || null);
    } catch (err: any) {
      showToast('error', err.message || 'Error de conexión');
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cálculo de métricas
  const metrics = useMemo(() => {
    const totalEntradas =
      vision?.total_entradas ??
      movements
        .filter((m) => m.type === 'ENTRADA')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    const totalSalidas =
      vision?.total_salidas ??
      movements
        .filter((m) => m.type === 'SALIDA')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

    const balanceNeto =
      vision?.disponible_actual ?? totalEntradas - totalSalidas;

    const countEntradas = movements.filter((m) => m.type === 'ENTRADA').length;
    const countSalidas = movements.filter((m) => m.type === 'SALIDA').length;

    return {
      totalEntradas,
      totalSalidas,
      balanceNeto,
      countEntradas,
      countSalidas,
      totalCount: movements.length,
    };
  }, [movements, vision]);

  // Filtrado reactivo en tiempo real
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // 1. Filtro por tipo (tab)
      if (activeTab === 'ENTRADAS' && m.type !== 'ENTRADA') return false;
      if (activeTab === 'SALIDAS' && m.type !== 'SALIDA') return false;

      // 2. Buscador en tiempo real por texto
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();

      const descMatch = (m.description || '').toLowerCase().includes(term);
      const catMatch = (m.category || '').toLowerCase().includes(term);
      const catLabelMatch = formatCategory(m.category).label.toLowerCase().includes(term);
      const prodMatch = (m.product_name || '').toLowerCase().includes(term);
      const amountMatch = String(Math.round(m.amount)).includes(term);

      return descMatch || catMatch || catLabelMatch || prodMatch || amountMatch;
    });
  }, [movements, activeTab, searchTerm]);

  // Manejador para eliminar movimiento
  const handleConfirmDelete = async () => {
    if (!movementToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/movements?id=${movementToDelete.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo eliminar el movimiento.');
      }

      showToast(
        'success',
        `Movimiento #${movementToDelete.id} eliminado. Se recalculó la caja y el stock.`
      );
      setMovementToDelete(null);
      await fetchData();
    } catch (err: any) {
      showToast('error', err.message || 'Error al eliminar movimiento.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* TOAST FLOTANTE */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-2xl shadow-2xl flex items-start gap-3 border backdrop-blur-md transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-400" size={18} />
          ) : (
            <AlertCircle className="shrink-0 mt-0.5 text-rose-400" size={18} />
          )}
          <div className="flex-1 text-xs font-semibold leading-relaxed">
            {toast.message}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-100 p-0.5 rounded transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* MODAL DE REGISTRO */}
      <MovementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(msg) => {
          showToast('success', msg || 'Movimiento guardado con éxito.');
          fetchData();
        }}
        products={products}
      />

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {movementToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 size={22} />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                ¿Eliminar este movimiento?
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Estás a punto de eliminar el registro:{' '}
              <strong className="text-slate-100 font-semibold">
                "{movementToDelete.description}"
              </strong>{' '}
              por un monto de{' '}
              <strong
                className={
                  movementToDelete.type === 'ENTRADA' ? 'text-emerald-400' : 'text-rose-400'
                }
              >
                {movementToDelete.type === 'ENTRADA' ? '+' : '-'}$
                {Math.round(movementToDelete.amount).toLocaleString('es-CO')}
              </strong>
              .
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
              ⚠️ Si este movimiento afectó inventario (venta o compra de catálogo/insumo),
              el stock de los productos vinculados se revertirá automáticamente de manera atómica.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setMovementToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-900/30 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} /> Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirmar Eliminación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR DE NAVEGACIÓN */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium border border-slate-700/60"
              title="Volver a la vista general del Dashboard"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Volver al Dashboard</span>
            </Link>

            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2 text-slate-100">
                <Receipt className="text-emerald-400" size={22} />
                Historial de Movimientos de Caja
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Bitácora cronológica completa, filtrado y reversión de transacciones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 text-xs font-medium flex items-center gap-1.5"
              title="Sincronizar datos"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin text-emerald-400' : ''} />
              <span className="hidden md:inline">Actualizar</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition"
            >
              <PlusCircle size={16} />
              <span>+ Registrar Entrada / Salida</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 space-y-6">
        {/* 1. ENCABEZADO CON MÉTRICAS DE RESUMEN */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Entradas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Total Entradas Registradas</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-2">
              +${Math.round(metrics.totalEntradas).toLocaleString('es-CO')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {metrics.countEntradas} entrada(s) contabilizada(s)
            </p>
          </div>

          {/* Total Salidas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Total Salidas Registradas</span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <TrendingDown size={18} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-400 mt-2">
              -${Math.round(metrics.totalSalidas).toLocaleString('es-CO')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {metrics.countSalidas} salida(s) contabilizada(s)
            </p>
          </div>

          {/* Balance Neto */}
          <div
            className={`bg-slate-900 rounded-2xl p-5 shadow-lg border relative overflow-hidden ${
              metrics.balanceNeto >= 0
                ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-900'
                : 'border-rose-500/40 bg-gradient-to-b from-rose-950/20 to-slate-900'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Balance Neto (Caja Real)</span>
              <div
                className={`p-2 rounded-xl ${
                  metrics.balanceNeto >= 0
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                <Wallet size={18} />
              </div>
            </div>
            <p
              className={`text-2xl sm:text-3xl font-extrabold mt-2 ${
                metrics.balanceNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ${Math.round(metrics.balanceNeto).toLocaleString('es-CO')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {metrics.balanceNeto >= 0
                ? 'Superávit acumulado disponible'
                : 'Déficit acumulado en caja'}
            </p>
          </div>
        </section>

        {/* 2. BARRA DE CONTROL Y FILTROS */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Tabs de Filtro Tipo */}
            <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 gap-1 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('TODOS')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'TODOS'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos ({metrics.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ENTRADAS')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'ENTRADAS'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                <ArrowUpRight size={14} />
                Entradas ({metrics.countEntradas})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('SALIDAS')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'SALIDAS'
                    ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 shadow'
                    : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                <ArrowDownRight size={14} />
                Salidas ({metrics.countSalidas})
              </button>
            </div>

            {/* Buscador en tiempo real y botón de acción */}
            <div className="flex flex-1 items-center gap-3 w-full md:max-w-md">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="text"
                  placeholder="Buscar por descripción, categoría, producto o monto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-9 pr-9 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                    title="Limpiar búsqueda"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Subbarra informativa de resultados */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
            <span>
              Mostrando{' '}
              <strong className="text-slate-200">{filteredMovements.length}</strong> de{' '}
              <strong className="text-slate-200">{movements.length}</strong> transacciones
              {searchTerm ? ` para "${searchTerm}"` : ''}
            </span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-emerald-400 hover:underline text-xs"
              >
                Restablecer búsqueda
              </button>
            )}
          </div>
        </section>

        {/* 3. TABLA / LISTA COMPLETA Y ELEGANTE */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="animate-spin text-emerald-400" size={32} />
              <p className="text-xs">Cargando historial de movimientos...</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center gap-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500">
                <Receipt size={36} />
              </div>
              <h3 className="text-sm font-bold text-slate-300">
                No se encontraron movimientos
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {searchTerm || activeTab !== 'TODOS'
                  ? 'No hay registros que coincidan con los filtros aplicados. Intenta cambiar de tab o limpiar el buscador.'
                  : 'Aún no has registrado ninguna entrada ni salida. Presiona el botón para agregar la primera.'}
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow"
              >
                <PlusCircle size={15} /> + Registrar Primer Movimiento
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-3.5 px-4">Tipo</th>
                    <th className="py-3.5 px-4">Categoría</th>
                    <th className="py-3.5 px-4">Descripción & Detalle</th>
                    <th className="py-3.5 px-4">Fecha y Hora</th>
                    <th className="py-3.5 px-4 text-right">Monto</th>
                    <th className="py-3.5 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredMovements.map((m) => {
                    const isEntrada = m.type === 'ENTRADA';
                    const categoryInfo = formatCategory(m.category);

                    // Formato en español de la fecha
                    let dateStr = m.movement_date;
                    try {
                      const d = new Date(m.movement_date);
                      dateStr = d.toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      });
                    } catch {}

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-950/60 transition duration-150 group"
                      >
                        {/* Tipo con icono y color destacado */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                              isEntrada
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {isEntrada ? (
                              <ArrowUpRight size={14} className="stroke-[2.5]" />
                            ) : (
                              <ArrowDownRight size={14} className="stroke-[2.5]" />
                            )}
                            {isEntrada ? 'ENTRADA' : 'SALIDA'}
                          </span>
                        </td>

                        {/* Categoría traducida y amigable */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium border ${categoryInfo.badgeClass}`}
                            >
                              {categoryInfo.label}
                            </span>
                            {m.is_unplanned && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                <Flame size={11} className="text-amber-400" />
                                Gasto hormiga / imprevisto
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Descripción y producto vinculado */}
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-200 text-xs leading-snug">
                            {m.description}
                          </p>
                          {m.product_name && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2 py-0.5 rounded">
                              <Package size={11} />
                              {m.product_name}
                              {m.quantity && m.quantity > 1 ? ` (x${m.quantity} uds)` : ' (x1 ud)'}
                            </span>
                          )}
                        </td>

                        {/* Fecha y hora en español */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-500" />
                            <span>{dateStr}</span>
                          </div>
                        </td>

                        {/* Monto destacado */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <span
                            className={`text-sm font-extrabold tracking-tight ${
                              isEntrada ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isEntrada ? '+' : '-'}$
                            {Math.round(m.amount).toLocaleString('es-CO')}
                          </span>
                        </td>

                        {/* Botón de eliminar con confirmación */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => setMovementToDelete(m)}
                            title="Eliminar movimiento (revierte stock automáticamente)"
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* PIE DE PÁGINA */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        Control de Caja Real • Movimientos sincronizados en tiempo real
      </footer>
    </div>
  );
}
