'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';

export interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'SERVICIOS_ARRIENDO', label: 'Servicios Públicos y Arriendo' },
  { value: 'PROVEEDORES', label: 'Pago a Proveedores' },
  { value: 'CREDITOS_DEUDAS', label: 'Créditos y Préstamos' },
  { value: 'IMPUESTOS', label: 'Impuestos y Tasas' },
  { value: 'OTRO', label: 'Otro Compromiso' },
] as const;

const FREQUENCIES = [
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'QUINCENAL', label: 'Quincenal' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'UNICO', label: 'Único / Pago Puntual' },
] as const;

export default function ReminderModal({
  isOpen,
  onClose,
  onSuccess,
}: ReminderModalProps) {
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('SERVICIOS_ARRIENDO');
  const [frequency, setFrequency] = useState<'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL'>('MENSUAL');
  const [dueDate, setDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Reiniciar formulario al abrir modal
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setAmount('');
      setCategory('SERVICIOS_ARRIENDO');
      setFrequency('MENSUAL');
      setDueDate(new Date().toISOString().split('T')[0]);
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

  const setQuickDate = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    setDueDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('El título o concepto del compromiso es obligatorio.');
      return;
    }

    if (!dueDate) {
      setErrorMsg('Debes seleccionar una fecha de vencimiento.');
      return;
    }

    const numericAmount = parseFloat(amount);
    const safeAmount = isNaN(numericAmount) || numericAmount < 0 ? 0 : numericAmount;

    const payload = {
      title: title.trim(),
      amount: safeAmount,
      category,
      frequency,
      due_date: dueDate,
    };

    try {
      setSubmitting(true);
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'Error al guardar la obligación.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado al guardar la obligación.');
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
        aria-labelledby="reminder-modal-title"
        className="relative w-full max-w-xl bg-white border border-black p-5 sm:p-6 my-auto shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-3 mb-4">
          <h2
            id="reminder-modal-title"
            className="text-sm sm:text-base font-mono font-bold uppercase tracking-tight text-black m-0"
          >
            REGISTRAR OBLIGACIÓN / PAGO RECURRENTE
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de obligación"
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
          {/* Row 1: Título / Concepto del compromiso (Full width) */}
          <div>
            <label
              htmlFor="modal-reminder-title"
              className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
            >
              Título / Concepto del compromiso
            </label>
            <input
              ref={firstInputRef}
              id="modal-reminder-title"
              type="text"
              required
              maxLength={120}
              placeholder="Ej. Arriendo Local Principal, Cuota Crédito Bancolombia"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black placeholder:text-black placeholder:opacity-40 focus:outline-none"
            />
          </div>

          {/* Row 2: Monto Estimado ($) (50%) y Categoría Contable (50%) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="modal-reminder-amount"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                MONTO ESTIMADO ($ COP)
              </label>
              <input
                id="modal-reminder-amount"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono font-bold text-black focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="modal-reminder-category"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                Categoría Contable
              </label>
              <select
                id="modal-reminder-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Frecuencia de Pago (50%) y Fecha de Vencimiento (50%) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="modal-reminder-frequency"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                Frecuencia de Pago
              </label>
              <select
                id="modal-reminder-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL')}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="modal-reminder-due-date"
                className="block text-xs font-mono font-bold uppercase tracking-wider mb-1 text-black"
              >
                Fecha de Vencimiento
              </label>
              <input
                id="modal-reminder-due-date"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2 text-xs font-mono uppercase text-black focus:outline-none"
              />
            </div>
          </div>

          {/* Row 4: Atajos de fecha (4 botones iguales al 25% cada uno) */}
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider mb-1 text-black">
              Atajos de Fecha
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setQuickDate(0)}
                className="py-1.5 border border-black bg-white text-black hover:bg-black hover:text-white text-xs font-mono font-bold uppercase cursor-pointer transition-none text-center"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(7)}
                className="py-1.5 border border-black bg-white text-black hover:bg-black hover:text-white text-xs font-mono font-bold uppercase cursor-pointer transition-none text-center"
              >
                +7d
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(15)}
                className="py-1.5 border border-black bg-white text-black hover:bg-black hover:text-white text-xs font-mono font-bold uppercase cursor-pointer transition-none text-center"
              >
                +15d
              </button>
              <button
                type="button"
                onClick={() => setQuickDate(30)}
                className="py-1.5 border border-black bg-white text-black hover:bg-black hover:text-white text-xs font-mono font-bold uppercase cursor-pointer transition-none text-center"
              >
                +30d
              </button>
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
              {submitting ? 'Guardando...' : 'Guardar Obligación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
