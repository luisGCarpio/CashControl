'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface SalidaModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Array<{
    id: number;
    name: string;
    sale_price: number;
    unit_cost: number;
    stock?: number;
  }>;
  onSuccess: () => void;
}

export type SalidaCategoryKey =
  | 'COMPRA_CATALOGO'
  | 'MATERIA_PRIMA'
  | 'SERVICIOS_ARRIENDO'
  | 'GASTO_GENERAL'
  | 'RETIRO_PERSONAL'
  | 'GASTO_NO_PLANEADO';

export type PaymentMethodKey = 'EFECTIVO' | 'NEQUI / DAVIPLATA' | 'BANCO';

interface CategoryOption {
  key: SalidaCategoryKey;
  label: string;
  defaultDescription: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    key: 'COMPRA_CATALOGO',
    label: 'COMPRA DE MERCANCÍA (AUMENTA STOCK)',
    defaultDescription: 'Compra de mercancía para inventario',
  },
  {
    key: 'MATERIA_PRIMA',
    label: 'MATERIA PRIMA / INSUMOS DE FABRICACIÓN',
    defaultDescription: 'Compra de insumos / materia prima',
  },
  {
    key: 'SERVICIOS_ARRIENDO',
    label: 'SERVICIOS PÚBLICOS O ARRIENDO',
    defaultDescription: 'Pago de servicios públicos / arriendo',
  },
  {
    key: 'GASTO_GENERAL',
    label: 'SUELDOS, NÓMINA, EMPAQUES U OPERACIÓN',
    defaultDescription: 'Gastos de operación / nómina',
  },
  {
    key: 'RETIRO_PERSONAL',
    label: 'SUELDO O RETIRO DEL DUEÑO',
    defaultDescription: 'Retiro personal / sueldo del dueño',
  },
  {
    key: 'GASTO_NO_PLANEADO',
    label: 'GASTO LIBRE O IMPREVISTO',
    defaultDescription: 'Gasto imprevisto no planeado',
  },
];

const PAYMENT_METHODS: { id: PaymentMethodKey; label: string }[] = [
  { id: 'EFECTIVO', label: 'EFECTIVO (CAJA FÍSICA)' },
  { id: 'NEQUI / DAVIPLATA', label: 'NEQUI / DAVIPLATA' },
  { id: 'BANCO', label: 'BANCO' },
];

export default function SalidaModal({
  isOpen,
  onClose,
  products = [],
  onSuccess,
}: SalidaModalProps) {
  const [category, setCategory] = useState<SalidaCategoryKey>('COMPRA_CATALOGO');
  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodKey>('EFECTIVO');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const modalRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  // Reiniciar estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setCategory('COMPRA_CATALOGO');
      setProductId('');
      setQuantity('1');
      setAmount('');
      setDescription('');
      setPaymentMethod('EFECTIVO');
      setErrorMsg('');

      setTimeout(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  // Cierre accesible con tecla Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  // Manejar cambio de categoría
  const handleCategoryChange = (newCat: SalidaCategoryKey) => {
    setCategory(newCat);
    setErrorMsg('');

    const currentOption = CATEGORY_OPTIONS.find((c) => c.key === newCat);
    if (currentOption) {
      setDescription(currentOption.defaultDescription);
    }

    if (newCat !== 'COMPRA_CATALOGO' && newCat !== 'MATERIA_PRIMA') {
      setProductId('');
      setQuantity('1');
    }
  };

  // Manejar cambio de producto en compra de catálogo o insumo
  const handleProductChange = (newProdId: string) => {
    setProductId(newProdId);
    setErrorMsg('');

    if (!newProdId) return;

    const prod = products.find((p) => String(p.id) === newProdId);
    if (prod) {
      const q = Math.max(1, parseInt(quantity, 10) || 1);
      if (prod.unit_cost > 0) {
        setAmount(String(prod.unit_cost * q));
      }
      setDescription(`Compra mercancía: ${q}x ${prod.name}`);
    }
  };

  // Manejar cambio de cantidad a ingresar
  const handleQuantityChange = (newQtyStr: string) => {
    setQuantity(newQtyStr);
    const q = Math.max(1, parseInt(newQtyStr, 10) || 1);

    if (productId) {
      const prod = products.find((p) => String(p.id) === productId);
      if (prod) {
        if (prod.unit_cost > 0) {
          setAmount(String(prod.unit_cost * q));
        }
        setDescription(`Compra mercancía: ${q}x ${prod.name}`);
      }
    }
  };

  // Envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a 0 ($ COP).');
      return;
    }

    let backendCategory = category;
    let finalProductId: number | null = null;
    let finalQuantity = 1;

    if (category === 'COMPRA_CATALOGO') {
      if (!productId) {
        setErrorMsg('Debes seleccionar un producto del catálogo para ingresar al stock.');
        return;
      }
      finalProductId = Number(productId);
      finalQuantity = Math.max(1, parseInt(quantity, 10) || 1);
      backendCategory = 'COMPRA_CATALOGO';
    } else if (category === 'MATERIA_PRIMA') {
      if (productId) {
        finalProductId = Number(productId);
        finalQuantity = Math.max(1, parseInt(quantity, 10) || 1);
        backendCategory = 'MATERIA_PRIMA';
      } else {
        finalProductId = null;
        finalQuantity = 1;
        backendCategory = 'GASTO_GENERAL';
      }
    } else {
      finalProductId = null;
      finalQuantity = 1;
      backendCategory = category;
    }

    const cleanDesc = description.trim();
    if (!cleanDesc) {
      setErrorMsg('El concepto o detalle del gasto es obligatorio.');
      return;
    }

    const prefix = `[${paymentMethod}]`;
    let finalDesc = cleanDesc.toUpperCase().startsWith(prefix) ? cleanDesc : `${prefix} ${cleanDesc}`;
    if (finalDesc.length > 500) {
      finalDesc = finalDesc.slice(0, 497) + '...';
    }

    const payload = {
      type: 'SALIDA',
      category: backendCategory,
      amount: numAmount,
      description: finalDesc,
      product_id: finalProductId,
      quantity: finalQuantity,
      is_unplanned: category === 'GASTO_NO_PLANEADO',
      payment_method: paymentMethod,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la salida de dinero');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión al registrar la salida.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="salida-modal-title"
        className="relative w-full max-w-lg bg-white border border-black p-5 sm:p-6 my-auto shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera limpia */}
        <div className="flex items-center justify-between pb-3 mb-4">
          <h2
            id="salida-modal-title"
            className="text-sm sm:text-base font-mono font-bold uppercase tracking-tight text-black m-0"
          >
            REGISTRAR SALIDA
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="border border-black bg-white text-black hover:bg-black hover:text-white px-2 py-0.5 text-xs font-mono font-bold uppercase cursor-pointer transition-none"
          >
            ✕
          </button>
        </div>

        {/* Mensaje de error accesible */}
        {errorMsg && (
          <div
            role="alert"
            aria-live="assertive"
            className="border border-black bg-black text-white p-3 mb-4 font-mono text-xs uppercase flex items-start justify-between"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="ml-2 font-mono font-bold text-white hover:underline uppercase text-[10px]"
            >
              CERRAR
            </button>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Motivo del Egreso (Categoría) */}
          <div>
            <label
              htmlFor="salida-category"
              className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
            >
              MOTIVO DEL EGRESO
            </label>
            <select
              id="salida-category"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as SalidaCategoryKey)}
              className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold uppercase text-black focus:outline-none"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bloque condicional para COMPRA_CATALOGO */}
          {category === 'COMPRA_CATALOGO' && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="salida-product"
                  className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
                >
                  PRODUCTO A REABASTECER
                </label>
                <select
                  id="salida-product"
                  value={productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                  className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
                >
                  <option value="">-- SELECCIONA EL PRODUCTO --</option>
                  {products.length > 0 ? (
                    products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name.toUpperCase()} (STOCK ACTUAL: {p.stock} | COSTO: ${p.unit_cost.toLocaleString('es-CO')})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      NO HAY PRODUCTOS REGISTRADOS EN EL CATÁLOGO
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="salida-quantity"
                  className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
                >
                  CANTIDAD DE UNIDADES A INGRESAR
                </label>
                <input
                  id="salida-quantity"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Bloque condicional para MATERIA_PRIMA */}
          {category === 'MATERIA_PRIMA' && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="salida-materia-product"
                  className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
                >
                  PRODUCTO ASOCIADO AL INSUMO (OPCIONAL)
                </label>
                <select
                  id="salida-materia-product"
                  value={productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
                >
                  <option value="">-- NINGUNO (INSUMO GENERAL DE OPERACIÓN) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.toUpperCase()} (STOCK: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              {productId && (
                <div>
                  <label
                    htmlFor="salida-materia-quantity"
                    className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
                  >
                    CANTIDAD DE UNIDADES A INGRESAR
                  </label>
                  <input
                    id="salida-materia-quantity"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Monto ($ COP) */}
          <div>
            <label
              htmlFor="salida-amount"
              className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
            >
              MONTO TOTAL DEL EGRESO ($ COP)
            </label>
            <input
              ref={amountInputRef}
              id="salida-amount"
              type="number"
              min="1"
              step="any"
              placeholder="0"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none"
            />
          </div>

          {/* Concepto / Detalle del Gasto */}
          <div>
            <label
              htmlFor="salida-description"
              className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
            >
              CONCEPTO / DETALLE DEL GASTO
            </label>
            <input
              id="salida-description"
              type="text"
              required
              maxLength={500}
              placeholder="CONCEPTO O DETALLE"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none placeholder:text-black placeholder:opacity-40"
            />
          </div>

          {/* Medio de Pago */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black">
              PAGADO DESDE
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((pm) => {
                const isSelected = paymentMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-tight transition-none cursor-pointer text-center border border-black ${
                      isSelected
                        ? 'bg-black text-white'
                        : 'bg-white text-black hover:bg-black hover:text-white'
                    }`}
                  >
                    {pm.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pie del modal (Footer) */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full border border-black bg-white text-black hover:bg-black hover:text-white py-2.5 text-xs font-mono font-bold uppercase cursor-pointer disabled:opacity-35 transition-none"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full border border-black bg-black text-white hover:bg-white hover:text-black py-2.5 text-xs font-mono font-bold uppercase cursor-pointer disabled:opacity-35 transition-none"
            >
              {submitting ? 'REGISTRANDO...' : 'REGISTRAR SALIDA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
