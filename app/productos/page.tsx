'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  Layers,
  PlusCircle,
  Trash2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Check,
  RefreshCw,
  ArrowLeft,
  Search,
  Filter,
  Sparkles,
  Boxes,
  ArrowUpRight,
  LogOut,
  ChevronDown,
  ChevronUp,
  Tag,
  ShoppingBag,
  TrendingDown,
  Percent,
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  supply_model: 'REVENTA' | 'PRODUCCION';
  unit_cost: number;
  extra_cost: number;
  total_unit_cost: number;
  sale_price: number;
  unit_profit: number;
  margin_percent: number;
  stock: number;
  active: boolean;
  units_sold?: number;
  total_revenue?: number;
  direct_investment?: number;
}

export default function ProductosPage() {
  const router = useRouter();

  // Estados principales
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [stockUpdatingId, setStockUpdatingId] = useState<number | null>(null);

  // Filtros y ordenamiento
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterModel, setFilterModel] = useState<'TODOS' | 'REVENTA' | 'PRODUCCION'>('TODOS');
  const [filterStock, setFilterStock] = useState<'TODOS' | 'BAJO_STOCK' | 'AGOTADO' | 'CON_STOCK'>('TODOS');
  const [sortBy, setSortBy] = useState<'name' | 'margin' | 'stock' | 'profit' | 'price'>('margin');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Control de interfaz
  const [showForm, setShowForm] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Formulario nuevo producto
  const [form, setForm] = useState({
    name: '',
    supply_model: 'REVENTA' as 'REVENTA' | 'PRODUCCION',
    unit_cost: '',
    extra_cost: '0',
    sale_price: '',
    stock: '0',
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 5000);
  };

  // Cargar productos desde API
  const fetchProducts = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      // Intentar primero desde /api/products, si falla o está vacío usar /api/dashboard
      const res = await fetch('/api/products');
      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data);
          return;
        }
      }

      // Fallback a /api/dashboard si /api/products no devolvió un array
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.status === 401) {
        router.push('/login');
        return;
      }
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (dashData.products && Array.isArray(dashData.products)) {
          setProducts(dashData.products);
          return;
        }
      }

      throw new Error('No se pudo obtener la lista de productos.');
    } catch (err: any) {
      showFeedback('error', 'Error al sincronizar productos: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Mini calculadora visual en tiempo real
  const calcUnitCost = parseFloat(form.unit_cost) || 0;
  const calcExtraCost = parseFloat(form.extra_cost) || 0;
  const calcSalePrice = parseFloat(form.sale_price) || 0;
  const calcTotalCost = calcUnitCost + calcExtraCost;
  const calcNetProfit = calcSalePrice - calcTotalCost;
  const calcMarginPercent = calcSalePrice > 0 ? (calcNetProfit / calcSalePrice) * 100 : 0;

  // Manejar creación de producto
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showFeedback('error', 'Por favor ingresa el nombre del producto.');
      return;
    }

    if (calcSalePrice <= 0) {
      showFeedback('error', 'El precio de venta debe ser mayor a 0.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          supply_model: form.supply_model,
          unit_cost: calcUnitCost,
          extra_cost: calcExtraCost,
          sale_price: calcSalePrice,
          stock: Math.max(0, parseInt(form.stock) || 0),
        }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Error al guardar producto');
      }

      showFeedback('success', `Producto "${resJson.name}" registrado con éxito en el catálogo.`);
      setForm({
        name: '',
        supply_model: 'REVENTA',
        unit_cost: '',
        extra_cost: '0',
        sale_price: '',
        stock: '0',
      });
      fetchProducts();
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Desactivar / Retirar producto
  const handleDeactivate = async (id: number, name: string) => {
    if (!confirm(`¿Estás seguro de retirar "${name}" del catálogo activo? Esta acción ocultará el producto.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Error al desactivar producto');
      }

      showFeedback('success', `Producto "${name}" retirado correctamente del catálogo.`);
      fetchProducts();
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Ajuste rápido de stock
  const handleQuickStockChange = async (product: Product, delta: number) => {
    const newStock = Math.max(0, Number(product.stock) + delta);
    if (newStock === Number(product.stock)) return;

    setStockUpdatingId(product.id);
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          stock: newStock,
        }),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'No se pudo actualizar el stock');
      }

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p))
      );
      showFeedback('success', `Stock de "${product.name}" actualizado a ${newStock} uds.`);
    } catch (err: any) {
      showFeedback('error', err.message);
    } finally {
      setStockUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  // Métricas rápidas
  const metrics = useMemo(() => {
    const totalActive = products.length;
    const totalUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
    const totalCostValuation = products.reduce(
      (acc, p) => acc + (Number(p.stock) || 0) * (Number(p.total_unit_cost) || 0),
      0
    );
    const totalSaleValuation = products.reduce(
      (acc, p) => acc + (Number(p.stock) || 0) * (Number(p.sale_price) || 0),
      0
    );
    const lowStockCount = products.filter((p) => Number(p.stock) <= 2).length;
    const outOfStockCount = products.filter((p) => Number(p.stock) === 0).length;

    // Producto más rentable (mayor porcentaje de margen)
    const sortedByMargin = [...products].sort(
      (a, b) => (Number(b.margin_percent) || 0) - (Number(a.margin_percent) || 0)
    );
    const bestMargin = sortedByMargin[0] || null;

    // Producto de mayor ganancia neta en dinero
    const sortedByProfit = [...products].sort(
      (a, b) => (Number(b.unit_profit) || 0) - (Number(a.unit_profit) || 0)
    );
    const bestProfit = sortedByProfit[0] || null;

    return {
      totalActive,
      totalUnits,
      totalCostValuation,
      totalSaleValuation,
      lowStockCount,
      outOfStockCount,
      bestMargin,
      bestProfit,
    };
  }, [products]);

  // Filtrado y ordenamiento de la tabla
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Filtro por texto
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchName = p.name.toLowerCase().includes(term);
          const matchModel = p.supply_model.toLowerCase().includes(term);
          if (!matchName && !matchModel) return false;
        }

        // Filtro por modelo
        if (filterModel !== 'TODOS' && p.supply_model !== filterModel) {
          return false;
        }

        // Filtro por stock
        if (filterStock === 'BAJO_STOCK' && Number(p.stock) > 2) return false;
        if (filterStock === 'AGOTADO' && Number(p.stock) !== 0) return false;
        if (filterStock === 'CON_STOCK' && Number(p.stock) <= 2) return false;

        return true;
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (sortBy) {
          case 'name':
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            break;
          case 'margin':
            valA = Number(a.margin_percent) || 0;
            valB = Number(b.margin_percent) || 0;
            break;
          case 'profit':
            valA = Number(a.unit_profit) || 0;
            valB = Number(b.unit_profit) || 0;
            break;
          case 'stock':
            valA = Number(a.stock) || 0;
            valB = Number(b.stock) || 0;
            break;
          case 'price':
            valA = Number(a.sale_price) || 0;
            valB = Number(b.sale_price) || 0;
            break;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [products, searchTerm, filterModel, filterStock, sortBy, sortOrder]);

  const toggleSort = (column: 'name' | 'margin' | 'stock' | 'profit' | 'price') => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="animate-spin text-emerald-400" size={32} />
        <p className="text-sm font-medium">Cargando catálogo y métricas de inventario...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* ALERTA FLOTANTE DE FEEDBACK (TOAST) */}
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

      {/* HEADER DE NAVEGACIÓN */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition border border-slate-700"
            >
              <ArrowLeft size={14} /> Volver al Tablero
            </Link>
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <div>
              <h1 className="text-lg font-bold tracking-tight flex items-center gap-2 text-slate-100">
                <Package className="text-purple-400" size={20} />
                Gestión Integral de Productos & Inventario
              </h1>
              <p className="text-[11px] text-slate-400">
                Catálogo activo, costos reales, márgenes de ganancia y control de existencias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts(true)}
              disabled={refreshing}
              title="Refrescar catálogo"
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-emerald-400' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-xs bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition border border-slate-700 hover:border-rose-800/60"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        {/* 1. MÉTRICAS RÁPIDAS SUPERIORES */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Productos Activos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Catálogo Activo
              </span>
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Boxes size={18} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-slate-100">
                {metrics.totalActive} <span className="text-sm font-normal text-slate-400">productos</span>
              </div>
              <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                <span className="text-sky-400">
                  {products.filter((p) => p.supply_model === 'REVENTA').length} Reventa
                </span>
                <span>•</span>
                <span className="text-purple-400">
                  {products.filter((p) => p.supply_model === 'PRODUCCION').length} Producción
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Stock Total & Valorización */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Stock Total Valorizado
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-emerald-400">
                ${Math.round(metrics.totalSaleValuation).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-slate-400 flex items-center justify-between">
                <span>{metrics.totalUnits} unidades en físico</span>
                <span className="text-slate-500 font-mono text-[10px]">
                  Costo: ${Math.round(metrics.totalCostValuation).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Mayor Margen de Ganancia */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Mayor Margen (%)
              </span>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Sparkles size={18} />
              </div>
            </div>
            <div className="mt-3">
              {metrics.bestMargin ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-amber-400">
                      {metrics.bestMargin.margin_percent}%
                    </span>
                    <span className="text-xs text-slate-400 truncate max-w-[140px]" title={metrics.bestMargin.name}>
                      {metrics.bestMargin.name}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                    <TrendingUp size={12} />
                    <span>+${Math.round(metrics.bestMargin.unit_profit).toLocaleString()} neta / ud</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500 py-1">Sin productos registrados</div>
              )}
            </div>
          </div>

          {/* Card 4: Alertas de Stock Bajo / Agotado */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Control de Existencias
              </span>
              <div
                className={`p-2 rounded-xl border ${
                  metrics.lowStockCount > 0
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}
              >
                {metrics.lowStockCount > 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold ${
                    metrics.lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {metrics.lowStockCount}
                </span>
                <span className="text-xs text-slate-400">en alerta (≤ 2 uds)</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {metrics.outOfStockCount > 0 ? (
                  <span className="text-rose-400 font-semibold">
                    {metrics.outOfStockCount} agotados por completo
                  </span>
                ) : (
                  <span className="text-slate-400">No hay productos en quiebre absoluto</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. FORMULARIO PARA REGISTRAR NUEVO PRODUCTO CON CALCULADORA VISUAL */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div
            onClick={() => setShowForm(!showForm)}
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition border-b border-slate-800/60"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <PlusCircle size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Registrar Nuevo Producto
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Reventa o Producción
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Calcula margen de ganancia real y costos antes de publicarlo en el catálogo
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-800/60"
            >
              {showForm ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {showForm && (
            <div className="p-5 sm:p-6 bg-slate-900/60">
              <form onSubmit={handleSubmitProduct} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Nombre del producto */}
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Nombre del Producto <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Bolso de Cuero Sintético, Aretes Artesanales, etc."
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition"
                    />
                  </div>

                  {/* Modelo de abastecimiento */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Modelo de Abastecimiento <span className="text-rose-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, supply_model: 'REVENTA' })}
                        className={`px-3 py-2 text-xs font-medium rounded-xl border transition flex items-center justify-center gap-1.5 ${
                          form.supply_model === 'REVENTA'
                            ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <ShoppingBag size={13} />
                        Reventa
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, supply_model: 'PRODUCCION' })}
                        className={`px-3 py-2 text-xs font-medium rounded-xl border transition flex items-center justify-center gap-1.5 ${
                          form.supply_model === 'PRODUCCION'
                            ? 'bg-purple-500/20 border-purple-500/60 text-purple-200 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Layers size={13} />
                        Producción
                      </button>
                    </div>
                  </div>

                  {/* Costo Unitario */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      {form.supply_model === 'REVENTA' ? 'Costo de Compra Mayorista ($)' : 'Costo de Insumos Base ($)'}{' '}
                      <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={form.unit_cost}
                        onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition font-mono"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {form.supply_model === 'REVENTA' ? 'Lo que pagas a tu proveedor por unidad' : 'Materia prima directa por unidad'}
                    </span>
                  </div>

                  {/* Costo Extra */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Costo Extra (Empaque / Flete / Logística) ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={form.extra_cost}
                        onChange={(e) => setForm({ ...form, extra_cost: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition font-mono"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Bolsas, cajas, etiquetas, traslados repartidos por pieza
                    </span>
                  </div>

                  {/* Precio de Venta al Público */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Precio de Venta al Público ($) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={form.sale_price}
                        onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition font-mono font-bold"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Precio final cobrado al cliente
                    </span>
                  </div>

                  {/* Stock Inicial */}
                  <div className="lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Stock Inicial en Almacén (Unidades Disponibles)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                      className="w-full sm:max-w-xs bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition font-mono"
                    />
                  </div>
                </div>

                {/* MINI CALCULADORA VISUAL EN TIEMPO REAL */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mt-3">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Percent size={14} className="text-emerald-400" />
                      Mini Calculadora Visual de Rentabilidad (Tiempo Real)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Costo Total = Base + Logística
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {/* Costo total */}
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Costo Total</div>
                      <div className="text-sm font-bold text-slate-200 mt-1 font-mono">
                        ${Math.round(calcTotalCost).toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">
                        ${calcUnitCost} + ${calcExtraCost}
                      </div>
                    </div>

                    {/* Precio venta */}
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Precio Venta</div>
                      <div className="text-sm font-bold text-sky-300 mt-1 font-mono">
                        ${Math.round(calcSalePrice).toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-0.5">Valor al público</div>
                    </div>

                    {/* Ganancia neta */}
                    <div
                      className={`p-2.5 rounded-lg border ${
                        calcNetProfit < 0
                          ? 'bg-rose-950/30 border-rose-500/30'
                          : 'bg-emerald-950/30 border-emerald-500/30'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Ganancia Neta</div>
                      <div
                        className={`text-sm font-bold mt-1 font-mono ${
                          calcNetProfit < 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {calcNetProfit >= 0 ? '+' : ''}${Math.round(calcNetProfit).toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Por unidad vendida</div>
                    </div>

                    {/* Margen % */}
                    <div
                      className={`p-2.5 rounded-lg border ${
                        calcNetProfit < 0
                          ? 'bg-rose-950/30 border-rose-500/30'
                          : calcMarginPercent < 25
                          ? 'bg-amber-950/30 border-amber-500/30'
                          : 'bg-emerald-950/30 border-emerald-500/30'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Margen Real</div>
                      <div
                        className={`text-sm font-bold mt-1 font-mono ${
                          calcNetProfit < 0
                            ? 'text-rose-400'
                            : calcMarginPercent < 25
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {calcMarginPercent.toFixed(1)}%
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Sobre precio venta</div>
                    </div>
                  </div>

                  {/* Barra visual de reparto y diagnóstico */}
                  {calcSalePrice > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="text-slate-400">Desglose porcentual del precio:</span>
                        <span
                          className={`font-medium ${
                            calcNetProfit < 0
                              ? 'text-rose-400'
                              : calcMarginPercent < 20
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          {calcNetProfit < 0
                            ? '⚠️ ¡Atención! Estás vendiendo a pérdida por debajo del costo real.'
                            : calcMarginPercent < 20
                            ? '⚡ Margen ajustado. Considera revisar tus costos extras o subir el precio.'
                            : calcMarginPercent < 45
                            ? '✅ Margen saludable para comercio minorista.'
                            : '🚀 Margen excelente de alta rentabilidad.'}
                        </span>
                      </div>
                      {/* Barra de progreso visual */}
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                        {calcTotalCost > 0 && (
                          <div
                            style={{
                              width: `${Math.min(100, (calcTotalCost / calcSalePrice) * 100)}%`,
                            }}
                            className={`${
                              calcNetProfit < 0 ? 'bg-rose-500' : 'bg-slate-600'
                            } transition-all`}
                            title={`Costo Total: ${((calcTotalCost / calcSalePrice) * 100).toFixed(0)}%`}
                          />
                        )}
                        {calcNetProfit > 0 && (
                          <div
                            style={{
                              width: `${Math.min(100, (calcNetProfit / calcSalePrice) * 100)}%`,
                            }}
                            className="bg-emerald-500 transition-all"
                            title={`Ganancia Neta: ${calcMarginPercent.toFixed(0)}%`}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 font-mono">
                        <span>Costo ({((calcTotalCost / (calcSalePrice || 1)) * 100).toFixed(0)}%)</span>
                        <span>Ganancia ({Math.max(0, calcMarginPercent).toFixed(0)}%)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón de envío */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-2.5 rounded-xl text-xs transition shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Guardando Producto...
                      </>
                    ) : (
                      <>
                        <PlusCircle size={15} />
                        Registrar Producto en Catálogo
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>

        {/* 3. TABLA MODERNA Y DETALLADA DE PRODUCTOS */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          {/* Barra superior de la tabla: Búsqueda, Filtros y Conteo */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Tag size={18} className="text-purple-400" />
                Inventario & Catálogo Detallado
                <span className="text-xs font-normal text-slate-400 ml-1">
                  ({filteredProducts.length} de {products.length} productos)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Supervisa márgenes, rotación de ventas y niveles críticos de existencias
              </p>
            </div>

            {/* Filtros rápidos */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Buscador */}
              <div className="relative flex-1 sm:w-60">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar producto o modelo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
                />
              </div>

              {/* Filtro por Modelo */}
              <select
                value={filterModel}
                onChange={(e: any) => setFilterModel(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
              >
                <option value="TODOS">Todos los Modelos</option>
                <option value="REVENTA">Solo Reventa</option>
                <option value="PRODUCCION">Solo Producción</option>
              </select>

              {/* Filtro por Stock */}
              <select
                value={filterStock}
                onChange={(e: any) => setFilterStock(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
              >
                <option value="TODOS">Todos los Stocks</option>
                <option value="BAJO_STOCK">Bajo Stock (≤ 2 uds)</option>
                <option value="AGOTADO">Agotados (0 uds)</option>
                <option value="CON_STOCK">Con Stock Seguro (&gt; 2 uds)</option>
              </select>
            </div>
          </div>

          {/* Tabla Responsive */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold select-none">
                  <th
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-200 transition"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Producto & Modelo</span>
                      {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th className="py-3 px-3">Costo Base + Extra</th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-200 transition"
                    onClick={() => toggleSort('price')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Precio Venta</span>
                      {sortBy === 'price' && (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-200 transition"
                    onClick={() => toggleSort('margin')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Margen / Ganancia Ud</span>
                      {sortBy === 'margin' && (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:text-slate-200 transition"
                    onClick={() => toggleSort('stock')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Stock Actual</span>
                      {sortBy === 'stock' && (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Ventas Realizadas</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package size={28} className="text-slate-600" />
                        <p className="text-sm font-medium">No se encontraron productos con los filtros aplicados.</p>
                        <p className="text-[11px] text-slate-500">
                          Prueba cambiando el término de búsqueda o registra un nuevo producto arriba.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const isLowStock = Number(p.stock) <= 2;
                    const isOutOfStock = Number(p.stock) === 0;
                    const isNegativeMargin = Number(p.unit_profit) < 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors group">
                        {/* 1. Nombre y Modelo */}
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {p.name}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            {p.supply_model === 'REVENTA' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                <ShoppingBag size={10} /> Reventa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                <Layers size={10} /> Producción Propia
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Costo Base + Extra */}
                        <td className="py-3 px-3 font-mono">
                          <div className="text-slate-200 font-semibold">
                            ${Math.round(p.total_unit_cost).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            ${Math.round(p.unit_cost).toLocaleString()} + ${Math.round(p.extra_cost).toLocaleString()}
                          </div>
                        </td>

                        {/* 3. Precio Venta */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-100">
                          ${Math.round(p.sale_price).toLocaleString()}
                        </td>

                        {/* 4. Margen / Ganancia Ud */}
                        <td className="py-3 px-3">
                          <div
                            className={`font-bold font-mono ${
                              isNegativeMargin ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {isNegativeMargin ? '' : '+'}${Math.round(p.unit_profit).toLocaleString()}
                          </div>
                          <div className="mt-0.5">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono ${
                                isNegativeMargin
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : p.margin_percent < 25
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {p.margin_percent}% margen
                            </span>
                          </div>
                        </td>

                        {/* 5. Stock Actual con Indicador de Advertencia */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border ${
                                isOutOfStock
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                                  : isLowStock
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {isOutOfStock ? (
                                <>
                                  <AlertCircle size={12} className="text-rose-400" />
                                  ¡Agotado! (0 uds)
                                </>
                              ) : isLowStock ? (
                                <>
                                  <AlertTriangle size={12} className="text-amber-400" />
                                  ¡Bajo! ({p.stock} uds)
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={12} className="text-emerald-400" />
                                  {p.stock} uds
                                </>
                              )}
                            </span>

                            {/* Ajustes rápidos de stock (+/-) */}
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                disabled={stockUpdatingId === p.id || p.stock <= 0}
                                onClick={() => handleQuickStockChange(p, -1)}
                                title="Disminuir 1 unidad de stock"
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs disabled:opacity-30 transition"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                disabled={stockUpdatingId === p.id}
                                onClick={() => handleQuickStockChange(p, 1)}
                                title="Añadir 1 unidad al stock"
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs disabled:opacity-30 transition"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 6. Ventas */}
                        <td className="py-3 px-3 text-center font-mono">
                          <div className="font-semibold text-slate-300">
                            {p.units_sold || 0} uds
                          </div>
                          {(p.total_revenue || 0) > 0 && (
                            <div className="text-[10px] text-emerald-400">
                              ${Math.round(p.total_revenue || 0).toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* 7. Acción: Desactivar */}
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            disabled={deletingId === p.id}
                            onClick={() => handleDeactivate(p.id, p.name)}
                            title="Retirar del catálogo activo"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 transition disabled:opacity-40"
                          >
                            {deletingId === p.id ? (
                              <RefreshCw size={15} className="animate-spin text-rose-400" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
