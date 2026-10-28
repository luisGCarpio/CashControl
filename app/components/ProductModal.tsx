'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductModal({
  isOpen,
  onClose,
  onSuccess,
}: ProductModalProps) {
  const [name, setName] = useState<string>('');
  const [supplyModel, setSupplyModel] = useState<'REVENTA' | 'PRODUCCION'>('REVENTA');
  const [unitCost, setUnitCost] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('');
  const [stock, setStock] = useState<string>('0');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Reiniciar formulario cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setName('');
      setSupplyModel('REVENTA');
      setUnitCost('');
      setSalePrice('');
      setStock('0');
      setErrorMsg('');

      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
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

  // Cálculos de rentabilidad en tiempo real
  const numUnitCost = Math.max(0, parseFloat(unitCost) || 0);
  const numSalePrice = Math.max(0, parseFloat(salePrice) || 0);
  const unitProfit = numSalePrice - numUnitCost;
  const marginPercent = numSalePrice > 0 ? ((numSalePrice - numUnitCost) / numSalePrice) * 100 : 0;
  const isLoss = numSalePrice > 0 && unitProfit < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('El nombre del producto es obligatorio.');
      return;
    }

    if (numSalePrice <= 0) {
      setErrorMsg('Debes especificar un precio de venta para el producto.');
      return;
    }

    const payload = {
      name: name.trim(),
      supply_model: supplyModel,
      unit_cost: numUnitCost,
      extra_cost: 0,
      sale_price: numSalePrice,
      stock: Math.max(0, parseInt(stock, 10) || 0),
    };

    try {
      setSubmitting(true);
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'Error al crear el producto.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado al guardar el producto.');
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
        aria-labelledby="product-modal-title"
        className="relative w-full max-w-lg bg-white border border-black p-5 sm:p-6 my-auto shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-3 mb-4">
          <h2
            id="product-modal-title"
            className="text-sm sm:text-base font-mono font-bold uppercase tracking-tight text-black m-0"
          >
            NUEVO PRODUCTO
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de producto"
            className="border border-black bg-white text-black hover:bg-black hover:text-white p-1 transition-none cursor-pointer"
          >
            <X className="w-5 h-5" />
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
              Cerrar
            </button>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre del Producto */}
          <div>
            <label
              htmlFor="modal-product-name"
              className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
            >
              Nombre del producto
            </label>
            <input
              ref={firstInputRef}
              id="modal-product-name"
              type="text"
              required
              maxLength={120}
              placeholder="Ej. Perfume Esencia Floral 100ml"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black placeholder:text-black placeholder:opacity-40 focus:outline-none"
            />
          </div>

          {/* Tipo de Producto */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black">
              Tipo de producto
            </label>
            <div className="grid grid-cols-2 gap-0 border border-black bg-white">
              <button
                type="button"
                onClick={() => setSupplyModel('REVENTA')}
                className={`py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer text-center ${
                  supplyModel === 'REVENTA'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-black hover:text-white'
                }`}
              >
                PRODUCTO COMPRADO (REVENTA)
              </button>
              <button
                type="button"
                onClick={() => setSupplyModel('PRODUCCION')}
                className={`py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer text-center border-l border-black ${
                  supplyModel === 'PRODUCCION'
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-black hover:text-white'
                }`}
              >
                PRODUCTO FABRICADO (PRODUCCIÓN)
              </button>
            </div>
          </div>

          {/* Costos y Precios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Costo Unitario */}
            <div>
              <label
                htmlFor="modal-product-unit-cost"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                COSTO UNITARIO ($ COP)
              </label>
              <input
                id="modal-product-unit-cost"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none tabular-nums"
              />
            </div>

            {/* Precio de Venta */}
            <div>
              <label
                htmlFor="modal-product-sale-price"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                PRECIO DE VENTA ($ COP)
              </label>
              <input
                id="modal-product-sale-price"
                type="number"
                min="0"
                step="any"
                required
                placeholder="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none tabular-nums"
              />
            </div>
          </div>

          {/* Sección de Rentabilidad y Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {/* Columna izquierda: Stock inicial */}
            <div className="flex flex-col justify-between">
              <label
                htmlFor="modal-product-stock"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                Stock inicial (unidades)
              </label>
              <input
                id="modal-product-stock"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold uppercase text-black tabular-nums placeholder:text-black placeholder:opacity-40 focus:outline-none"
              />
            </div>

            {/* Columna derecha: Cálculo de rentabilidad */}
            <div
              className={`p-3 font-mono text-xs uppercase flex flex-col justify-center gap-1.5 ${
                isLoss
                  ? 'border border-black bg-black text-white'
                  : 'border border-black bg-white text-black'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold">GANANCIA ESTIMADA</span>
                <span className="font-bold text-xs sm:text-sm tabular-nums">
                  {isLoss ? (
                    <span>¡PÉRDIDA! (-${Math.abs(unitProfit).toLocaleString('es-CO')})</span>
                  ) : (
                    <span>${unitProfit.toLocaleString('es-CO')}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px] font-bold">MARGEN DE GANANCIA</span>
                <span className="font-bold text-xs sm:text-sm tabular-nums">
                  {marginPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="border border-black bg-white text-black hover:bg-black hover:text-white py-2.5 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition-none disabled:opacity-35 text-center"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="border border-black bg-black text-white hover:bg-white hover:text-black py-2.5 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition-none disabled:opacity-35 text-center flex items-center justify-center gap-2"
            >
              {submitting ? 'Creando Producto...' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
