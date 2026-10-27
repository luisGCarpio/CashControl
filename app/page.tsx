'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bell,
  Package,
  PlusCircle,
  LogOut,
  CheckCircle2,
  BarChart3,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react';

const CATEGORIAS_ENTRADA = [
  { value: 'VENTA_PRODUCTO', label: 'Venta de Producto (Catálogo o Propio)' },
  { value: 'APORTE_CAPITAL', label: 'Inyección / Aporte de Capital' },
  { value: 'OTRO_INGRESO', label: 'Otro Ingreso' },
];

const CATEGORIAS_SALIDA = [
  { value: 'COMPRA_CATALOGO', label: 'Compra Mercancía Hecha (Reventa / Catálogo)' },
  { value: 'MATERIA_PRIMA', label: 'Compra Materia Prima / Insumos (Producción)' },
  { value: 'EMPAQUES_ENVIOS', label: 'Empaques, Bolsas, Domicilios y Envíos' },
  { value: 'SERVICIOS_ARRIENDO', label: 'Arriendo, Servicios, Internet, Cuotas' },
  { value: 'PUBLICIDAD', label: 'Publicidad / Redes Sociales' },
  { value: 'GASTO_NO_PLANEADO', label: 'Gasto No Planeado / Imprevisto / Hormiga' },
  { value: 'RETIRO_PERSONAL', label: 'Retiro Personal' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'mensual' | 'semanal'>('mensual');
  const [movementFilter, setMovementFilter] = useState<'TODOS' | 'ENTRADA' | 'SALIDA'>('TODOS');

  // Notificaciones de feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estado Formulario de Movimiento
  const [movForm, setMovForm] = useState({
    type: 'ENTRADA',
    category: 'VENTA_PRODUCTO',
    amount: '',
    description: '',
    product_id: '',
    quantity: 1,
    is_unplanned: false,
  });

  // Estado Formulario de Producto
  const [prodForm, setProdForm] = useState({
    name: '',
    supply_model: 'REVENTA',
    unit_cost: '',
    extra_cost: '0',
    sale_price: '',
    stock: '0',
  });

  // Estado Formulario de Recordatorio
  const [remForm, setRemForm] = useState({
    title: '',
    amount: '',
    category: 'SERVICIOS_ARRIENDO',
    frequency: 'MENSUAL',
    due_date: new Date().toISOString().split('T')[0],
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 5000);
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      showFeedback('error', 'Error al sincronizar datos con el servidor: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Autocompletar y recalcular monto al cambiar de producto o tipo
  const updateProductPricing = (prodId: string, currentType: string, qty: number) => {
    if (!prodId || !data?.products) {
      setMovForm((prev) => ({ ...prev, product_id: prodId }));
      return;
    }
    const found = data.products.find((p: any) => String(p.id) === String(prodId));
    if (found) {
      const unitVal = currentType === 'ENTRADA' ? found.sale_price : found.unit_cost;
      setMovForm((prev) => ({
        ...prev,
        product_id: prodId,
        amount: String(unitVal * qty),
        description:
          prev.description && !prev.description.startsWith('Venta:') && !prev.description.startsWith('Compra:')
            ? prev.description
            : `${currentType === 'ENTRADA' ? 'Venta' : 'Compra stock/insumos'}: ${found.name} (x${qty})`,
      }));
    }
  };

  const handleTypeChange = (newType: 'ENTRADA' | 'SALIDA') => {
    const defaultCat = newType === 'ENTRADA' ? 'VENTA_PRODUCTO' : 'COMPRA_CATALOGO';
    setMovForm((prev) => {
      const updated = { ...prev, type: newType, category: defaultCat };
      if (prev.product_id && data?.products) {
        const found = data.products.find((p: any) => String(p.id) === String(prev.product_id));
        if (found) {
          const unitVal = newType === 'ENTRADA' ? found.sale_price : found.unit_cost;
          updated.amount = String(unitVal * prev.quantity);
          updated.description = `${newType === 'ENTRADA' ? 'Venta' : 'Compra stock/insumos'}: ${found.name} (x${prev.quantity})`;
        }
      }
      return updated;
    });
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...movForm,
          is_unplanned: movForm.category === 'GASTO_NO_PLANEADO' || movForm.is_unplanned,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Error al guardar el movimiento');
      }

      showFeedback('success', `${movForm.type === 'ENTRADA' ? 'Entrada' : 'Salida'} guardada correctamente.`);
      setMovForm({
        type: 'ENTRADA',
        category: 'VENTA_PRODUCTO',
        amount: '',
        description: '',
        product_id: '',
        quantity: 1,
        is_unplanned: false,
      });
      fetchDashboard();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleDeleteMovement = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este movimiento? Si afectó stock, se revertirá automáticamente.')) {
      return;
    }
    try {
      const res = await fetch(`/api/movements?id=${id}`, { method: 'DELETE' });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Error al eliminar movimiento');
      showFeedback('success', 'Movimiento eliminado y saldo/inventario recalculado.');
      fetchDashboard();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prodForm),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Error al agregar producto');
      }

      showFeedback('success', `Producto "${resJson.name}" agregado con éxito al catálogo.`);
      setProdForm({
        name: '',
        supply_model: 'REVENTA',
        unit_cost: '',
        extra_cost: '0',
        sale_price: '',
        stock: '0',
      });
      fetchDashboard();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleDeactivateProduct = async (id: number, name: string) => {
    if (!confirm(`¿Deseas retirar "${name}" del catálogo activo?`)) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Error al retirar producto');
      showFeedback('success', `Producto "${name}" retirado del catálogo.`);
      fetchDashboard();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleSubmitReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(remForm),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Error al programar recordatorio');
      }

      showFeedback('success', `Recordatorio "${resJson.title}" programado.`);
      setRemForm({
        title: '',
        amount: '',
        category: 'SERVICIOS_ARRIENDO',
        frequency: 'MENSUAL',
        due_date: new Date().toISOString().split('T')[0],
      });
      fetchDashboard();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleCompleteReminder = async (id: number, registerExpense: boolean) => {
    try {
      const res = await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, registerExpense }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Error al procesar pago de recordatorio');
      showFeedback('success', 'Pago procesado exitosamente.');
      fetchDashboard();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleDeleteReminder = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este recordatorio?')) return;
    try {
      const res = await fetch(`/api/reminders?id=${id}`, { method: 'DELETE' });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'Error al eliminar recordatorio');
      showFeedback('success', 'Recordatorio eliminado.');
      fetchDashboard();
    } catch (err: any) {
      showFeedback('error', err.message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="animate-spin text-emerald-400" size={32} />
        <p className="text-sm">Cargando estado real y métricas financieras...</p>
      </div>
    );
  }

  const { vision, chartStats, movements, products, reminders, alerts, productInsights } = data;
  const activeBars = chartStats[chartMode] || [];
  const maxBarValue = Math.max(
    1,
    ...activeBars.map((b: any) => Math.max(b.entradas || 0, b.salidas || 0))
  );

  const filteredMovements = movements.filter((m: any) => {
    if (movementFilter === 'TODOS') return true;
    return m.type === movementFilter;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* ALERTA FLOTANTE DE FEEDBACK */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-xl shadow-2xl flex items-start gap-3 border transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950 border-rose-500/50 text-rose-200'
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

      {/* BARRA SUPERIOR */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Wallet className="text-emerald-400" size={22} />
              Pulso Financiero & Control de Caja
            </h1>
            <p className="text-xs text-slate-400">
              Control riguroso de caja real, inventario, costos y recordatorios
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg flex items-center gap-1.5 transition"
          >
            <LogOut size={15} /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-8">
        {/* 1. VISIÓN REAL Y ACTUAL DEL DINERO */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Dinero Disponible Hoy (Caja Real)</span>
              <Wallet className="text-emerald-400" size={20} />
            </div>
            <p
              className={`text-3xl font-extrabold mt-2 ${
                vision.disponible_actual >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              ${Math.round(vision.disponible_actual).toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Saldo neto disponible tras registrar todas las entradas y salidas
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Total Entradas (Ingresos)</span>
              <TrendingUp className="text-sky-400" size={20} />
            </div>
            <p className="text-3xl font-bold text-slate-100 mt-2">
              ${Math.round(vision.total_entradas).toLocaleString()}
            </p>
            <p className="text-xs text-sky-400 mt-2">
              Este mes: +${Math.round(vision.entradas_mes).toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs uppercase font-semibold">
              <span>Total Salidas (Gastos + Compras)</span>
              <TrendingDown className="text-rose-400" size={20} />
            </div>
            <p className="text-3xl font-bold text-slate-100 mt-2">
              ${Math.round(vision.total_salidas).toLocaleString()}
            </p>
            <p className="text-xs text-rose-400 mt-2">
              Este mes: -${Math.round(vision.salidas_mes).toLocaleString()}
            </p>
          </div>
        </section>

        {/* 2. RADAR DE ALERTAS INTELIGENTES */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="text-amber-400" size={20} />
              Radar de Alertas: Gastos, Inventario y Rentabilidad
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
              {alerts.length} alertas detectadas
            </span>
          </div>

          {/* Tarjetas Resumen de Inteligencia de Productos */}
          {products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] uppercase text-slate-400 font-semibold">Rotación de Ventas</span>
                {productInsights.masVendido ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-400 mt-1">
                      🔥 {productInsights.masVendido.name} ({productInsights.masVendido.units_sold} uds)
                    </p>
                    {productInsights.menosVendido && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Menor: {productInsights.menosVendido.name} ({productInsights.menosVendido.units_sold} uds)
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">Sin ventas registradas aún</p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] uppercase text-slate-400 font-semibold">Margen por Unidad</span>
                {productInsights.masRentable ? (
                  <>
                    <p className="text-sm font-semibold text-sky-400 mt-1">
                      💎 {productInsights.masRentable.name} (+${Math.round(productInsights.masRentable.unit_profit).toLocaleString()}/ud)
                    </p>
                    {productInsights.menosRentable && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Menor margen: {productInsights.menosRentable.name} (${Math.round(productInsights.menosRentable.unit_profit).toLocaleString()}/ud)
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">Registra productos para analizar</p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] uppercase text-slate-400 font-semibold">¿A cuál le pierdo dinero?</span>
                {productInsights.enPerdida?.length > 0 ? (
                  <p className="text-sm font-semibold text-rose-400 mt-1">
                    ⚠️ {productInsights.enPerdida.map((p: any) => p.name).join(', ')}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-emerald-400 mt-1">
                    ✅ Ninguno vende por debajo del costo
                  </p>
                )}
                <p className="text-[10px] text-slate-500 mt-0.5">Costo unitario mayor o igual al precio venta</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] uppercase text-slate-400 font-semibold">Oportunidad de Más Ganancia</span>
                {productInsights.potencialMasDinero?.length > 0 ? (
                  <p className="text-sm font-semibold text-amber-300 mt-1">
                    🚀 {productInsights.potencialMasDinero.map((p: any) => p.name).join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">Registra ventas para detectar oportunidades</p>
                )}
                <p className="text-[10px] text-slate-500 mt-0.5">Por alta rotación o gran margen libre</p>
              </div>
            </div>
          )}

          {/* Lista detallada de alertas */}
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">
              Todo bajo control. No hay anomalías en gastos, quiebres de inventario ni productos en pérdida.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alerts.map((al: any) => (
                <div
                  key={al.id}
                  className={`p-4 rounded-xl border flex gap-3 items-start ${
                    al.level === 'DANGER'
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      : al.level === 'WARNING'
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                      : al.level === 'SUCCESS'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                      : 'bg-sky-950/30 border-sky-500/40 text-sky-200'
                  }`}
                >
                  <Flame className="shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/30">
                      {al.scope}
                    </span>
                    <h4 className="font-semibold text-sm mt-1">{al.title}</h4>
                    <p className="text-xs opacity-90 mt-0.5">{al.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. FORMULARIO DE ENTRADAS/SALIDAS + DIAGRAMA DE BARRAS */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Registrar Entrada o Salida */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <PlusCircle className="text-emerald-400" size={20} />
              Registrar Entrada o Salida
            </h2>

            <form onSubmit={handleSubmitMovement} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTypeChange('ENTRADA')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    movForm.type === 'ENTRADA'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  + ENTRADA DE DINERO
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('SALIDA')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    movForm.type === 'SALIDA'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  - SALIDA / GASTO
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipo / Categoría del movimiento</label>
                <select
                  value={movForm.category}
                  onChange={(e) => setMovForm({ ...movForm, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  {(movForm.type === 'ENTRADA' ? CATEGORIAS_ENTRADA : CATEGORIAS_SALIDA).map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    Producto vinculado (Control de Stock)
                  </label>
                  <select
                    value={movForm.product_id}
                    onChange={(e) => updateProductPricing(e.target.value, movForm.type, movForm.quantity)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">-- Ninguno / General --</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={movForm.quantity}
                    onChange={(e) => {
                      const q = Math.max(1, Number(e.target.value) || 1);
                      setMovForm({ ...movForm, quantity: q });
                      if (movForm.product_id) {
                        updateProductPricing(movForm.product_id, movForm.type, q);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Monto Total ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  placeholder="Ej: 45000"
                  value={movForm.amount}
                  onChange={(e) => setMovForm({ ...movForm, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Descripción / Detalle</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Venta perfume cliente María / Pago bolsas y cajas"
                  value={movForm.description}
                  onChange={(e) => setMovForm({ ...movForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                />
              </div>

              {movForm.type === 'SALIDA' && (
                <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={movForm.is_unplanned || movForm.category === 'GASTO_NO_PLANEADO'}
                    onChange={(e) => setMovForm({ ...movForm, is_unplanned: e.target.checked })}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0"
                  />
                  Gasto no planeado / imprevisto / hormiga (vigilancia de radar)
                </label>
              )}

              <button
                type="submit"
                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition ${
                  movForm.type === 'ENTRADA'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg'
                }`}
              >
                Guardar {movForm.type === 'ENTRADA' ? 'Entrada' : 'Salida'}
              </button>
            </form>
          </div>

          {/* Diagrama de Barras Continuo */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <BarChart3 className="text-sky-400" size={20} />
                  Estadísticas: Entradas vs Salidas
                </h2>
                <p className="text-xs text-slate-400">
                  Comparativa cronológica continua
                </p>
              </div>

              <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setChartMode('semanal')}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    chartMode === 'semanal' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semanas
                </button>
                <button
                  onClick={() => setChartMode('mensual')}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    chartMode === 'mensual' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Meses
                </button>
              </div>
            </div>

            {activeBars.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-slate-500">
                No hay datos disponibles en el rango seleccionado.
              </div>
            ) : (
              <div className="h-64 flex items-end gap-2 sm:gap-4 pt-8 pb-2 px-2 border-b border-slate-800">
                {activeBars.map((item: any, idx: number) => {
                  const hasIn = item.entradas > 0;
                  const hasOut = item.salidas > 0;
                  const inPct = hasIn ? Math.max(6, Math.round((item.entradas / maxBarValue) * 100)) : 0;
                  const outPct = hasOut ? Math.max(6, Math.round((item.salidas / maxBarValue) * 100)) : 0;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end">
                      <div className="w-full flex items-end justify-center gap-1.5 sm:gap-2 h-full">
                        {/* Barra Entradas */}
                        <div className="flex flex-col items-center w-5 sm:w-8 h-full justify-end group relative">
                          {hasIn && (
                            <span className="text-[10px] text-emerald-400 mb-1 hidden group-hover:block font-bold">
                              ${Math.round(item.entradas).toLocaleString()}
                            </span>
                          )}
                          <div
                            style={{ height: `${inPct}%` }}
                            className={`w-full bg-emerald-500 rounded-t-md transition-all ${
                              hasIn ? 'opacity-90 hover:opacity-100' : 'opacity-0'
                            }`}
                            title={`Entradas: $${Math.round(item.entradas).toLocaleString()}`}
                          />
                        </div>
                        {/* Barra Salidas */}
                        <div className="flex flex-col items-center w-5 sm:w-8 h-full justify-end group relative">
                          {hasOut && (
                            <span className="text-[10px] text-rose-400 mb-1 hidden group-hover:block font-bold">
                              ${Math.round(item.salidas).toLocaleString()}
                            </span>
                          )}
                          <div
                            style={{ height: `${outPct}%` }}
                            className={`w-full bg-rose-500 rounded-t-md transition-all ${
                              hasOut ? 'opacity-90 hover:opacity-100' : 'opacity-0'
                            }`}
                            title={`Salidas: $${Math.round(item.salidas).toLocaleString()}`}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-2 font-medium truncate w-full text-center">
                        {item.etiqueta}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400 mt-4">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Entradas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> Salidas
                </span>
              </div>
              <span className="hidden sm:inline">Pasa el cursor para ver el monto exacto</span>
            </div>
          </div>
        </section>

        {/* 4. CATÁLOGO / PRODUCCIÓN DE PRODUCTOS + RECORDATORIOS DE PAGOS */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Gestión de Productos y Stock */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Package className="text-purple-400" size={20} />
              Control de Productos: Reventa o Producción
            </h2>

            <form
              onSubmit={handleSubmitProduct}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800"
            >
              <input
                type="text"
                required
                placeholder="Nombre (Ej: Perfume Árabe / Blusa)"
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:col-span-2 text-slate-200"
              />
              <select
                value={prodForm.supply_model}
                onChange={(e) => setProdForm({ ...prodForm, supply_model: e.target.value })}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
              >
                <option value="REVENTA">Reventa / Catálogo</option>
                <option value="PRODUCCION">Producción (Materia Prima)</option>
              </select>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  {prodForm.supply_model === 'REVENTA' ? 'Costo Compra/Ud ($)' : 'Costo Materia Prima/Ud ($)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="Costo base"
                  value={prodForm.unit_cost}
                  onChange={(e) => setProdForm({ ...prodForm, unit_cost: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Empaque / Envase / Extra ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={prodForm.extra_cost}
                  onChange={(e) => setProdForm({ ...prodForm, extra_cost: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Precio Venta Final ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="Precio cliente"
                  value={prodForm.sale_price}
                  onChange={(e) => setProdForm({ ...prodForm, sale_price: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Stock Inicial (Unidades)
                </label>
                <input
                  type="number"
                  min="0"
                  value={prodForm.stock}
                  onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-bold"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 rounded-lg text-xs transition shadow-md"
                >
                  + Agregar Producto al Catálogo
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2">Producto</th>
                    <th className="py-2">Modelo</th>
                    <th className="py-2">Costo Total</th>
                    <th className="py-2">Precio Venta</th>
                    <th className="py-2">Margen / Ud</th>
                    <th className="py-2">Stock</th>
                    <th className="py-2">Ventas</th>
                    <th className="py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-500">
                        No hay productos registrados en el catálogo.
                      </td>
                    </tr>
                  ) : (
                    products.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-950/40">
                        <td className="py-2.5 font-medium">{p.name}</td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                            {p.supply_model}
                          </span>
                        </td>
                        <td className="py-2.5">${Math.round(p.total_unit_cost).toLocaleString()}</td>
                        <td className="py-2.5">${Math.round(p.sale_price).toLocaleString()}</td>
                        <td
                          className={`py-2.5 font-bold ${
                            p.unit_profit > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ${Math.round(p.unit_profit).toLocaleString()} ({p.margin_percent}%)
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              p.stock === 0
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : p.stock <= 3
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {p.stock} uds
                          </span>
                        </td>
                        <td className="py-2.5">{p.units_sold} uds</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleDeactivateProduct(p.id, p.name)}
                            title="Desactivar producto"
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recordatorios de Pagos */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Bell className="text-amber-400" size={20} />
              Recordatorios de Pagos Próximos
            </h2>

            <form
              onSubmit={handleSubmitReminder}
              className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800"
            >
              <input
                type="text"
                required
                placeholder="Concepto (Ej: Pago revista Avon / Arriendo / Internet)"
                value={remForm.title}
                onChange={(e) => setRemForm({ ...remForm, title: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Monto ($)"
                  value={remForm.amount}
                  onChange={(e) => setRemForm({ ...remForm, amount: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                />
                <select
                  value={remForm.frequency}
                  onChange={(e) => setRemForm({ ...remForm, frequency: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200"
                >
                  <option value="SEMANAL">Semanal</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="MENSUAL">Mensual</option>
                  <option value="UNICO">Único</option>
                </select>
                <input
                  type="date"
                  required
                  value={remForm.due_date}
                  onChange={(e) => setRemForm({ ...remForm, due_date: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2 rounded-lg text-xs transition shadow-md"
              >
                + Programar Recordatorio de Pago
              </button>
            </form>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {reminders.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No tienes pagos pendientes por vencer.
                </p>
              ) : (
                reminders.map((r: any) => {
                  const isOverdue = r.days_remaining < 0;
                  const isToday = r.days_remaining === 0;
                  const isSoon = r.days_remaining > 0 && r.days_remaining <= 3;

                  return (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                        isOverdue
                          ? 'bg-rose-950/30 border-rose-500/40'
                          : isToday
                          ? 'bg-amber-950/40 border-amber-500/50'
                          : isSoon
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{r.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {r.frequency}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Vence: <strong className="text-slate-200">{r.due_date}</strong> • Monto:{' '}
                          <strong className="text-amber-300">${Math.round(r.amount).toLocaleString()}</strong>
                        </p>
                        <span
                          className={`text-[10px] font-semibold mt-0.5 inline-block ${
                            isOverdue
                              ? 'text-rose-400'
                              : isToday
                              ? 'text-amber-300'
                              : isSoon
                              ? 'text-amber-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {isOverdue
                            ? `¡Vencido hace ${Math.abs(r.days_remaining)} días!`
                            : isToday
                            ? '¡Vence hoy!'
                            : isSoon
                            ? `Vence en ${r.days_remaining} días`
                            : `${r.days_remaining} días restantes`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCompleteReminder(r.id, r.amount > 0)}
                          title="Descuenta de caja automáticamente y avanza periodo si es recurrente"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 text-xs flex items-center gap-1 transition"
                        >
                          <CheckCircle2 size={14} /> Pagado
                        </button>
                        <button
                          onClick={() => handleDeleteReminder(r.id)}
                          title="Eliminar recordatorio"
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* 5. HISTORIAL DE ENTRADAS Y SALIDAS */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Historial de Entradas y Salidas</h2>

            <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start">
              <button
                onClick={() => setMovementFilter('TODOS')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  movementFilter === 'TODOS' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({movements.length})
              </button>
              <button
                onClick={() => setMovementFilter('ENTRADA')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  movementFilter === 'ENTRADA' ? 'bg-emerald-800/80 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Solo Entradas (+)
              </button>
              <button
                onClick={() => setMovementFilter('SALIDA')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  movementFilter === 'SALIDA' ? 'bg-rose-800/80 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Solo Salidas (-)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5">Fecha</th>
                  <th className="py-2.5">Tipo</th>
                  <th className="py-2.5">Categoría / Índole</th>
                  <th className="py-2.5">Descripción</th>
                  <th className="py-2.5">Producto</th>
                  <th className="py-2.5 text-right">Monto</th>
                  <th className="py-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      No hay movimientos registrados en este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-950/50">
                      <td className="py-3 text-slate-400">
                        {new Date(m.movement_date).toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] ${
                            m.type === 'ENTRADA'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {m.type === 'ENTRADA' ? (
                            <ArrowUpRight size={12} />
                          ) : (
                            <ArrowDownRight size={12} />
                          )}
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3">
                        {m.category}
                        {m.is_unplanned && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            No planeado
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-200">{m.description}</td>
                      <td className="py-3 text-slate-400">
                        {m.product_name ? `${m.product_name} (x${m.quantity})` : '-'}
                      </td>
                      <td
                        className={`py-3 text-right font-bold ${
                          m.type === 'ENTRADA' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {m.type === 'ENTRADA' ? '+' : '-'}${Math.round(m.amount).toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDeleteMovement(m.id)}
                          title="Eliminar movimiento y revertir stock si aplica"
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}