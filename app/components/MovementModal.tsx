'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Loader2,
  DollarSign,
  Calendar,
  FileText,
} from 'lucide-react';

export const CATEGORIAS_ENTRADA = [
  { value: 'VENTA_PRODUCTO', label: 'Venta de Producto (Catálogo o Propio)' },
  { value: 'APORTE_CAPITAL', label: 'Inyección / Aporte de Capital' },
  { value: 'OTRO_INGRESO', label: 'Otro Ingreso' },
];

export const CATEGORIAS_SALIDA = [
  { value: 'COMPRA_CATALOGO', label: 'Compra Mercancía Hecha (Reventa / Catálogo)' },
  { value: 'MATERIA_PRIMA', label: 'Compra Materia Prima / Insumos (Producción)' },
  { value: 'EMPAQUES_ENVIOS', label: 'Empaques, Bolsas, Domicilios y Envíos' },
  { value: 'SERVICIOS_ARRIENDO', label: 'Arriendo, Servicios, Internet, Cuotas' },
  { value: 'PUBLICIDAD', label: 'Publicidad / Redes Sociales' },
  { value: 'GASTO_NO_PLANEADO', label: 'Gasto No Planeado / Imprevisto / Hormiga' },
  { value: 'RETIRO_PERSONAL', label: 'Retiro Personal' },
];

export interface ProductItem {
  id: number;
  name: string;
  stock: number;
  sale_price: number;
  unit_cost: number;
  extra_cost?: number;
  supply_model?: string;
  [key: string]: any;
}

export type ProductOption = ProductItem;

export interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMovementSaved?: () => void;
  onSuccess?: (message?: string) => void;
  products?: ProductItem[] | any[];
}

export default function MovementModal({
  isOpen,
  onClose,
  onMovementSaved,
  onSuccess,
  products = [],
}: MovementModalProps) {
  const [type, setType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [category, setCategory] = useState<string>('VENTA_PRODUCTO');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isUnplanned, setIsUnplanned] = useState<boolean>(false);
  const [movementDate, setMovementDate] = useState<string>('');
  const [localProducts, setLocalProducts] = useState<ProductOption[]>(products);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar productos si no vinieron por props
  useEffect(() => {
    if (products && products.length > 0) {
      setLocalProducts(products);
    } else if (isOpen) {
      fetch('/api/products')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setLocalProducts(data);
        })
        .catch(() => {});
    }
  }, [isOpen, products]);

  // Reset del formulario cuando se abre o cierra el modal
  useEffect(() => {
    if (isOpen) {
      setType('ENTRADA');
      setCategory('VENTA_PRODUCTO');
      setAmount('');
      setDescription('');
      setProductId('');
      setQuantity(1);
      setIsUnplanned(false);
      setError(null);
      // Fecha actual en formato datetime-local
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
      setMovementDate(localISOTime);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: 'ENTRADA' | 'SALIDA') => {
    setType(newType);
    const defaultCat = newType === 'ENTRADA' ? 'VENTA_PRODUCTO' : 'COMPRA_CATALOGO';
    setCategory(defaultCat);
    setIsUnplanned(false);

    // Recalcular monto si hay producto seleccionado
    if (productId && localProducts.length > 0) {
      const prod = localProducts.find((p) => String(p.id) === String(productId));
      if (prod) {
        const unitVal = Number((newType === 'ENTRADA' ? prod.sale_price : prod.unit_cost) || 0);
        setAmount(String(unitVal * quantity));
        setDescription(
          `${newType === 'ENTRADA' ? 'Venta' : 'Compra stock/insumos'}: ${prod.name} (x${quantity})`
        );
      }
    }
  };

  const handleProductChange = (selectedId: string) => {
    setProductId(selectedId);
    if (!selectedId) return;

    const prod = localProducts.find((p) => String(p.id) === String(selectedId));
    if (prod) {
      const unitVal = Number(type === 'ENTRADA' ? prod.sale_price : prod.unit_cost) || 0;
      setAmount(String(unitVal * quantity));
      setDescription(
        `${type === 'ENTRADA' ? 'Venta' : 'Compra stock/insumos'}: ${prod.name} (x${quantity})`
      );
    }
  };

  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(1, newQty || 1);
    setQuantity(validQty);

    if (productId && localProducts.length > 0) {
      const prod = localProducts.find((p) => String(p.id) === String(productId));
      if (prod) {
        const unitVal = Number(type === 'ENTRADA' ? prod.sale_price : prod.unit_cost) || 0;
        setAmount(String(unitVal * validQty));
        setDescription(
          `${type === 'ENTRADA' ? 'Venta' : 'Compra stock/insumos'}: ${prod.name} (x${validQty})`
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('El monto debe ser un número válido mayor a 0.');
      return;
    }

    if (!description.trim()) {
      setError('La descripción o detalle es obligatoria.');
      return;
    }

    // Validación previa de stock si es venta
    if (type === 'ENTRADA' && category === 'VENTA_PRODUCTO' && productId) {
      const selectedProd = localProducts.find((p) => String(p.id) === String(productId));
      const currentStock = selectedProd?.stock ?? 0;
      if (selectedProd && currentStock < quantity) {
        setError(
          `Stock insuficiente: "${selectedProd.name}" solo tiene ${currentStock} unidades e intentas vender ${quantity}.`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const payload: Record<string, any> = {
        type,
        category,
        amount: parsedAmount,
        description: description.trim(),
        product_id: productId ? Number(productId) : null,
        quantity,
        is_unplanned: category === 'GASTO_NO_PLANEADO' || isUnplanned,
      };

      if (movementDate) {
        payload.movement_date = new Date(movementDate).toISOString();
      }

      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el movimiento');
      }

      if (onMovementSaved) {
        onMovementSaved();
      }

      if (onSuccess) {
        onSuccess(
          `${type === 'ENTRADA' ? 'Entrada (+)' : 'Salida (-)'} de $${parsedAmount.toLocaleString(
            'es-CO'
          )} registrada con éxito.`
        );
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const selectedProd = productId
    ? localProducts.find((p) => String(p.id) === String(productId))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                type === 'ENTRADA'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {type === 'ENTRADA' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Registrar {type === 'ENTRADA' ? 'Entrada de Dinero' : 'Salida / Gasto'}
              </h3>
              <p className="text-xs text-slate-400">
                Afecta directamente el saldo de caja y el inventario si aplica
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="shrink-0 text-rose-400 mt-0.5" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Selector de Tipo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleTypeChange('ENTRADA')}
              className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                type === 'ENTRADA'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp size={14} /> + ENTRADA
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('SALIDA')}
              className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                type === 'SALIDA'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingDown size={14} /> - SALIDA
            </button>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Categoría del movimiento
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value === 'GASTO_NO_PLANEADO') {
                  setIsUnplanned(true);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
            >
              {(type === 'ENTRADA' ? CATEGORIAS_ENTRADA : CATEGORIAS_SALIDA).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Producto Vinculado y Cantidad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Package size={14} className="text-slate-400" />
                Producto (Opcional - Afecta Stock)
              </label>
              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">-- Ninguno / Gasto o Ingreso General --</option>
                {localProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {p.stock})
                  </option>
                ))}
              </select>
              {selectedProd && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Stock actual:{' '}
                  <span
                    className={
                      (selectedProd.stock ?? 0) <= 2
                        ? 'text-amber-400 font-bold'
                        : 'text-slate-200 font-bold'
                    }
                  >
                    {selectedProd.stock ?? 0} uds
                  </span>{' '}
                  • Venta: ${Math.round(Number(selectedProd.sale_price) || 0).toLocaleString()} • Costo: $
                  {Math.round(Number(selectedProd.unit_cost) || 0).toLocaleString()}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cantidad
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => handleQuantityChange(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Monto y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign size={14} className="text-slate-400" />
                Monto Total ($) *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                placeholder="Ej: 50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none ${
                  type === 'ENTRADA'
                    ? 'text-emerald-400 focus:border-emerald-500'
                    : 'text-rose-400 focus:border-rose-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                Fecha y Hora
              </label>
              <input
                type="datetime-local"
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" />
              Descripción o Detalle *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Venta de producto a María / Pago insumos de aseo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
            />
          </div>

          {/* Gasto no planeado (solo para salidas) */}
          {type === 'SALIDA' && (
            <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer select-none text-xs text-amber-300">
              <input
                type="checkbox"
                checked={isUnplanned || category === 'GASTO_NO_PLANEADO'}
                onChange={(e) => setIsUnplanned(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-400" />
                Marcar como gasto no planeado / imprevisto / hormiga
              </span>
            </label>
          )}

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-2 transition disabled:opacity-50 ${
                type === 'ENTRADA'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/30'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <PlusCircle size={15} /> Registrar {type === 'ENTRADA' ? 'Entrada' : 'Salida'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
