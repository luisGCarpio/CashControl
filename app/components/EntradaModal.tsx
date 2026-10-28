'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface EntradaProduct {
  id: number;
  name: string;
  sale_price: number;
  unit_cost: number;
  stock?: number;
}

export interface EntradaModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Array<{ id: number; name: string; sale_price: number; unit_cost: number; stock?: number }>;
  onSuccess: () => void;
}

export type EntradaMode = 'VENTA_CATALOGO' | 'INGRESO_LIBRE';
export type PaymentMethod = 'EFECTIVO' | 'NEQUI / DAVIPLATA' | 'BANCO / TARJETA';
export type FreeIncomeCategory = 'VENTA_PRODUCTO' | 'APORTE_CAPITAL' | 'OTRO_INGRESO';

interface CartItem {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'EFECTIVO',
  'NEQUI / DAVIPLATA',
  'BANCO / TARJETA',
];

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EntradaModal({
  isOpen,
  onClose,
  products: initialProducts,
  onSuccess,
}: EntradaModalProps) {
  // Modo de Entrada: Venta de productos (catálogo) vs Ingreso libre / otro
  const [mode, setMode] = useState<EntradaMode>('VENTA_CATALOGO');

  // Medio de pago y fecha
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFECTIVO');
  const [movementDate, setMovementDate] = useState<string>(getTodayString);

  // Catálogo interno en caso de que no se provean productos vía props
  const [internalProducts, setInternalProducts] = useState<EntradaProduct[]>([]);

  // Estado de Venta por Catálogo
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<string>('1');
  const [saleNote, setSaleNote] = useState<string>('');

  // Estado de Ingreso Libre
  const [freeAmount, setFreeAmount] = useState<string>('');
  const [freeDescription, setFreeDescription] = useState<string>('');
  const [freeCategory, setFreeCategory] = useState<FreeIncomeCategory>('OTRO_INGRESO');

  // Estado de envío y errores
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const modalRef = useRef<HTMLDivElement>(null);

  // Lista consolidada de productos disponibles
  const availableProducts: EntradaProduct[] =
    initialProducts && initialProducts.length > 0 ? initialProducts : internalProducts;

  // Cargar catálogo si no vino en props
  useEffect(() => {
    if (isOpen && (!initialProducts || initialProducts.length === 0)) {
      fetch('/api/products')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) {
            setInternalProducts(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, initialProducts]);

  // Reiniciar estado al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setMode('VENTA_CATALOGO');
      setPaymentMethod('EFECTIVO');
      setMovementDate(getTodayString());
      setCart([]);
      setSelectedProductId('');
      setSelectedQuantity('1');
      setSaleNote('');
      setFreeAmount('');
      setFreeDescription('');
      setFreeCategory('OTRO_INGRESO');
      setErrorMsg('');
      setSubmitting(false);
    }
  }, [isOpen]);

  // Manejo de accesibilidad: Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !submitting) {
        onClose();
      }
    },
    [isOpen, submitting, onClose]
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

  // Cálculos para producto actualmente seleccionado
  const selectedProduct = availableProducts.find(
    (p) => String(p.id) === selectedProductId
  );
  const existingInCart = cart.find((i) => i.productId === Number(selectedProductId));
  const qtyInCart = existingInCart ? existingInCart.quantity : 0;
  const currentTotalStock = selectedProduct ? (selectedProduct.stock ?? 0) : 0;
  const remainingStockForSelected = Math.max(0, currentTotalStock - qtyInCart);

  // Totales del carrito
  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartTotalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Agregar producto al carrito
  const handleAddToCart = () => {
    setErrorMsg('');
    if (!selectedProductId) {
      setErrorMsg('Selecciona un producto del catálogo.');
      return;
    }

    const prod = availableProducts.find((p) => String(p.id) === selectedProductId);
    if (!prod) {
      setErrorMsg('El producto seleccionado no es válido.');
      return;
    }

    const qty = parseInt(selectedQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('La cantidad a vender debe ser un número entero mayor a 0.');
      return;
    }

    if (qty > remainingStockForSelected) {
      setErrorMsg(
        `Stock insuficiente para "${prod.name}". Disponible: ${remainingStockForSelected} unidad(es).`
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === prod.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          unitPrice: prod.sale_price,
          quantity: qty,
          maxStock: prod.stock ?? 0,
        },
      ];
    });

    setSelectedProductId('');
    setSelectedQuantity('1');
  };

  // Modificar cantidad en carrito
  const handleUpdateQuantity = (productId: number, delta: number) => {
    setErrorMsg('');
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.maxStock) {
              setErrorMsg(`No puedes agregar más de ${item.maxStock} unidades en stock.`);
              return item;
            }
            if (nextQty <= 0) {
              return null;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  // Quitar ítem del carrito
  const handleRemoveFromCart = (productId: number) => {
    setErrorMsg('');
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Enviar Venta de Productos (Catálogo)
  const submitVentaCatalogo = async () => {
    if (cart.length === 0) {
      setErrorMsg('Debes agregar al menos un producto al carrito de la venta.');
      return;
    }

    const itemsSummary = cart.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    const notePart = saleNote.trim() ? ` - ${saleNote.trim()}` : '';
    let fullDescription = `[${paymentMethod}] Venta: ${itemsSummary}${notePart}`;
    if (fullDescription.length > 500) {
      fullDescription = fullDescription.slice(0, 497) + '...';
    }

    const batchPayload = {
      payment_method: paymentMethod,
      type: 'ENTRADA',
      category: 'VENTA_PRODUCTO',
      description: fullDescription,
      movement_date: movementDate || getTodayString(),
      items: cart.map((item) => ({
        type: 'ENTRADA',
        category: 'VENTA_PRODUCTO',
        amount: item.unitPrice * item.quantity,
        description: fullDescription,
        product_id: item.productId,
        quantity: item.quantity,
        is_unplanned: false,
        movement_date: movementDate || getTodayString(),
        payment_method: paymentMethod,
      })),
    };

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Error al procesar la venta de productos.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la venta.');
    } finally {
      setSubmitting(false);
    }
  };

  // Enviar Ingreso Libre / Otro
  const submitIngresoLibre = async () => {
    const numAmount = Number(freeAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a 0 para el ingreso.');
      return;
    }

    if (!freeDescription.trim()) {
      setErrorMsg('Ingresa un concepto o motivo para este ingreso.');
      return;
    }

    let finalDesc = `[${paymentMethod}] ${freeDescription.trim()}`;
    if (finalDesc.length > 500) {
      finalDesc = finalDesc.slice(0, 497) + '...';
    }

    const payload = {
      type: 'ENTRADA',
      category: freeCategory,
      amount: numAmount,
      description: finalDesc,
      product_id: null,
      quantity: 1,
      is_unplanned: false,
      movement_date: movementDate || getTodayString(),
      payment_method: paymentMethod,
      is_free_sale: true,
    };

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Error al registrar el ingreso libre.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el ingreso.');
    } finally {
      setSubmitting(false);
    }
  };

  // Manejador central del formulario
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mode === 'VENTA_CATALOGO') {
      submitVentaCatalogo();
    } else {
      submitIngresoLibre();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={() => {
        if (!submitting) onClose();
      }}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entrada-modal-title"
        className="relative w-full max-w-2xl bg-white border border-black p-4 sm:p-6 my-auto shadow-none text-black max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera limpia y dedicada */}
        <div className="flex items-center justify-between pb-3 mb-4">
          <h2
            id="entrada-modal-title"
            className="text-base sm:text-lg font-mono font-bold uppercase tracking-tight text-black m-0"
          >
            REGISTRAR ENTRADA
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Cerrar modal"
            className="border border-black bg-white text-black hover:bg-black hover:text-white px-2 py-0.5 text-xs font-mono font-bold uppercase cursor-pointer disabled:opacity-35"
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
            <span className="font-bold">{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="ml-3 font-mono font-bold text-white hover:underline uppercase text-[10px] shrink-0"
            >
              CERRAR
            </button>
          </div>
        )}

        {/* Selector de modo de entrada (sencillo y simétrico) */}
        <div className="grid grid-cols-2 gap-0 border border-black bg-white mb-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setMode('VENTA_CATALOGO');
              setErrorMsg('');
            }}
            className={`py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer border-r border-black disabled:opacity-35 text-center ${
              mode === 'VENTA_CATALOGO'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            VENTA DE PRODUCTOS (CATÁLOGO)
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setMode('INGRESO_LIBRE');
              setErrorMsg('');
            }}
            className={`py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer disabled:opacity-35 text-center ${
              mode === 'INGRESO_LIBRE'
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            INGRESO LIBRE / OTRO
          </button>
        </div>

        {/* Contenido según modo */}
        {mode === 'VENTA_CATALOGO' ? (
          /* Modo Venta de Productos */
          <div className="space-y-4">
            {/* Formulario para agregar productos */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                <div className="sm:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="entrada-product-select"
                      className="block text-xs font-mono font-bold uppercase tracking-wider text-black"
                    >
                      PRODUCTO A VENDER
                    </label>
                    {selectedProduct && (
                      <span className="text-[11px] font-mono font-bold uppercase text-black">
                        STOCK: {remainingStockForSelected} U.
                      </span>
                    )}
                  </div>
                  <select
                    id="entrada-product-select"
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      setErrorMsg('');
                    }}
                    className="w-full h-10 border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
                  >
                    <option value="">-- SELECCIONA UN PRODUCTO --</option>
                    {availableProducts.map((p) => {
                      const stockCount = p.stock ?? 0;
                      return (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={stockCount <= 0}
                        >
                          {p.name} - ${p.sale_price.toLocaleString('es-CO')} COP (STOCK: {stockCount})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label
                    htmlFor="entrada-product-qty"
                    className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-center text-black"
                  >
                    CANTIDAD
                  </label>
                  <input
                    id="entrada-product-qty"
                    type="number"
                    min="1"
                    max={remainingStockForSelected > 0 ? remainingStockForSelected : 1}
                    step="1"
                    placeholder="1"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(e.target.value)}
                    className="w-full h-10 border border-black bg-white px-2 py-2 text-xs font-mono text-center font-bold text-black focus:outline-none"
                    aria-label="Cantidad a agregar"
                  />
                </div>

                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!selectedProductId || remainingStockForSelected <= 0 || submitting}
                    className="w-full h-10 border border-black bg-black text-white hover:bg-white hover:text-black px-2 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition-none disabled:opacity-35 flex items-center justify-center text-center"
                  >
                    + AGREGAR
                  </button>
                </div>
              </div>

              {selectedProduct && remainingStockForSelected <= 0 && (
                <p className="text-[11px] font-mono font-bold uppercase text-black m-0">
                  * Este producto ya no tiene más unidades disponibles en stock para sumar a la venta.
                </p>
              )}
            </div>

            {/* Carrito ágil de productos a vender */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                  PRODUCTOS EN LA VENTA ({cart.length})
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] font-mono uppercase underline hover:no-underline font-bold cursor-pointer text-black"
                  >
                    VACIAR LISTA
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="border border-black p-4 text-center bg-white">
                  <p className="font-mono text-xs uppercase text-black m-0">
                    Selecciona un producto del catálogo para agregarlo a la venta
                  </p>
                </div>
              ) : (
                <div className="border border-black bg-white overflow-x-auto">
                  <table className="w-full border-collapse text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-black bg-black text-white uppercase text-[11px]">
                        <th className="p-2">Producto</th>
                        <th className="p-2 text-right">Precio Unit.</th>
                        <th className="p-2 text-center">Cantidad</th>
                        <th className="p-2 text-right">Subtotal</th>
                        <th className="p-2 text-center">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {cart.map((item) => (
                        <tr key={item.productId} className="bg-white text-black">
                          <td className="p-2 font-bold uppercase">
                            <div>{item.name}</div>
                          </td>

                          <td className="p-2 text-right tabular-nums whitespace-nowrap">
                            ${item.unitPrice.toLocaleString('es-CO')}
                          </td>

                          <td className="p-2 text-center whitespace-nowrap">
                            <div className="inline-flex items-center border border-black bg-white text-black">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.productId, -1)}
                                disabled={item.quantity <= 1}
                                aria-label={`Reducir cantidad de ${item.name}`}
                                className="px-2 py-0.5 hover:bg-black hover:text-white transition-none cursor-pointer disabled:opacity-35 font-bold"
                              >
                                -
                              </button>
                              <span className="px-2 font-bold text-xs tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                disabled={item.quantity >= item.maxStock}
                                onClick={() => handleUpdateQuantity(item.productId, 1)}
                                aria-label={`Aumentar cantidad de ${item.name}`}
                                className="px-2 py-0.5 hover:bg-black hover:text-white transition-none cursor-pointer disabled:opacity-35 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="p-2 text-right tabular-nums font-bold whitespace-nowrap">
                            ${(item.unitPrice * item.quantity).toLocaleString('es-CO')}
                          </td>

                          <td className="p-2 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.productId)}
                              aria-label={`Quitar ${item.name}`}
                              className="border border-black px-2 py-0.5 bg-white text-black hover:bg-black hover:text-white transition-none cursor-pointer text-xs font-bold"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total calculado automáticamente */}
              {cart.length > 0 && (
                <div className="border border-black bg-white p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="font-mono text-xs uppercase text-black">
                    Total artículos: <span className="font-bold">{cartTotalUnits} unidades</span>
                  </div>
                  <div className="font-mono uppercase text-right">
                    <span className="text-xs text-black mr-2 font-bold">TOTAL VENTA:</span>
                    <span className="text-base sm:text-lg font-black tabular-nums text-black">
                      ${cartTotal.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Detalle o cliente opcional */}
            <div>
              <label
                htmlFor="entrada-sale-note"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                DETALLE O CLIENTE (OPCIONAL)
              </label>
              <input
                id="entrada-sale-note"
                type="text"
                maxLength={150}
                placeholder="DETALLE O CLIENTE"
                value={saleNote}
                onChange={(e) => setSaleNote(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
              />
            </div>
          </div>
        ) : (
          /* Modo Ingreso Libre / Otro */
          <div className="space-y-4">
            {/* Categoría */}
            <div>
              <label
                htmlFor="entrada-free-category"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                CATEGORÍA
              </label>
              <select
                id="entrada-free-category"
                value={freeCategory}
                onChange={(e) => setFreeCategory(e.target.value as FreeIncomeCategory)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
              >
                <option value="OTRO_INGRESO">OTRO INGRESO OPERATIVO / SERVICIO LIBRE</option>
                <option value="VENTA_PRODUCTO">VENTA DIRECTA / PRODUCTO SIN CATÁLOGO</option>
                <option value="APORTE_CAPITAL">APORTE DE CAPITAL / INYECCIÓN DE DINERO</option>
              </select>
            </div>

            {/* Monto: Input limpio y directo */}
            <div>
              <label
                htmlFor="entrada-free-amount"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                MONTO ($ COP)
              </label>
              <input
                id="entrada-free-amount"
                type="number"
                min="1"
                step="any"
                placeholder="0"
                required
                value={freeAmount}
                onChange={(e) => setFreeAmount(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none"
              />
            </div>

            {/* Concepto / Descripción */}
            <div>
              <label
                htmlFor="entrada-free-desc"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                CONCEPTO O MOTIVO
              </label>
              <input
                id="entrada-free-desc"
                type="text"
                required
                maxLength={400}
                placeholder="CONCEPTO O MOTIVO"
                value={freeDescription}
                onChange={(e) => setFreeDescription(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Medio de Pago (Obligatorio en ambos casos) */}
        <div className="pt-2 space-y-2">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-black">
            MEDIO DE PAGO
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((method) => {
              const isSelected = paymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  disabled={submitting}
                  onClick={() => setPaymentMethod(method)}
                  className={`w-full border border-black py-2.5 px-2 text-center font-mono text-xs font-bold uppercase transition-none cursor-pointer disabled:opacity-35 ${
                    isSelected
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-black hover:text-white'
                  }`}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fecha del movimiento */}
        <div className="pt-3">
          <label
            htmlFor="entrada-movement-date"
            className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
          >
            FECHA DEL MOVIMIENTO
          </label>
          <input
            id="entrada-movement-date"
            type="date"
            disabled={submitting}
            value={movementDate}
            onChange={(e) => setMovementDate(e.target.value)}
            className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
          />
        </div>

        {/* Pie del modal (Footer) */}
        <div className="grid grid-cols-2 gap-3 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full border border-black bg-white text-black hover:bg-black hover:text-white py-2.5 px-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition-none disabled:opacity-35 text-center"
          >
            CANCELAR
          </button>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting || (mode === 'VENTA_CATALOGO' && cart.length === 0)}
            className="w-full border border-black bg-black text-white hover:bg-white hover:text-black py-2.5 px-4 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition-none disabled:opacity-35 text-center"
          >
            {submitting ? 'GUARDANDO...' : 'REGISTRAR ENTRADA'}
          </button>
        </div>
      </div>
    </div>
  );
}
