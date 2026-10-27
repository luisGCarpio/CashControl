'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Calendar,
  Clock,
  Check,
  CheckCircle2,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  DollarSign,
  AlertCircle,
  Loader2,
  CalendarCheck,
  Tag,
  Repeat,
  AlertTriangle,
} from 'lucide-react';

export interface ReminderItem {
  id: number;
  title: string;
  amount: number;
  category: string;
  frequency: 'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | string;
  due_date: string;
  days_remaining?: number;
  is_completed?: boolean;
  [key: string]: any;
}

export interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReminderUpdated: () => void;
  reminders: any[];
}

const CATEGORIAS_RECORDATORIO = [
  { value: 'SERVICIOS_ARRIENDO', label: 'Arriendo, Servicios, Internet, Cuotas' },
  { value: 'COMPRA_CATALOGO', label: 'Compra Mercancía (Reventa / Catálogo)' },
  { value: 'MATERIA_PRIMA', label: 'Compra Materia Prima / Insumos' },
  { value: 'EMPAQUES_ENVIOS', label: 'Empaques, Bolsas y Envíos' },
  { value: 'PUBLICIDAD', label: 'Publicidad / Redes Sociales' },
  { value: 'GASTO_NO_PLANEADO', label: 'Imprevisto / Otro' },
  { value: 'RETIRO_PERSONAL', label: 'Retiro Personal' },
];

const FRECUENCIAS = [
  { value: 'UNICO', label: 'Pago Único' },
  { value: 'SEMANAL', label: 'Semanal (cada 7 días)' },
  { value: 'QUINCENAL', label: 'Quincenal (cada 15 días)' },
  { value: 'MENSUAL', label: 'Mensual (cada mes)' },
];

export default function RemindersModal({
  isOpen,
  onClose,
  onReminderUpdated,
  reminders = [],
}: RemindersModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [registerExpenseOption, setRegisterExpenseOption] = useState<Record<number, boolean>>({});

  // New reminder form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('SERVICIOS_ARRIENDO');
  const [frequency, setFrequency] = useState<'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL'>('MENSUAL');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [savingNew, setSavingNew] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset notifications on open
  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setLoadingActionId(null);
      setDeletingId(null);
    }
  }, [isOpen]);

  // Mark reminder as paid
  const handleMarkAsPaid = async (reminder: ReminderItem) => {
    setLoadingActionId(reminder.id);
    setFeedback(null);

    // Default to true if not explicitly toggled off
    const shouldRegisterExpense = registerExpenseOption[reminder.id] !== false;

    try {
      const res = await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reminder.id,
          registerExpense: shouldRegisterExpense,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al marcar recordatorio como pagado.');
      }

      setFeedback({
        type: 'success',
        message: shouldRegisterExpense && Number(reminder.amount) > 0
          ? `¡Recordatorio pagado y registrado como salida en caja ($${Number(reminder.amount).toLocaleString('es-CO')})!`
          : '¡Recordatorio saldado exitosamente!',
      });

      onReminderUpdated();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al actualizar el recordatorio.',
      });
    } finally {
      setLoadingActionId(null);
    }
  };

  // Delete reminder
  const handleDeleteReminder = async (id: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar este recordatorio?')) {
      return;
    }

    setDeletingId(id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/reminders?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar el recordatorio.');
      }

      setFeedback({
        type: 'success',
        message: 'Recordatorio eliminado correctamente.',
      });

      onReminderUpdated();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al eliminar el recordatorio.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Create new reminder
  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!title.trim()) {
      setFeedback({ type: 'error', message: 'El título del recordatorio es obligatorio.' });
      return;
    }

    if (!dueDate) {
      setFeedback({ type: 'error', message: 'La fecha límite es obligatoria.' });
      return;
    }

    setSavingNew(true);

    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          amount: Number(amount) || 0,
          category,
          frequency,
          due_date: dueDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al programar el recordatorio.');
      }

      setFeedback({
        type: 'success',
        message: '¡Nuevo recordatorio programado exitosamente!',
      });

      // Reset new form
      setTitle('');
      setAmount('');
      setCategory('SERVICIOS_ARRIENDO');
      setFrequency('MENSUAL');
      setDueDate(new Date().toISOString().split('T')[0]);
      setShowAddForm(false);

      onReminderUpdated();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al conectar con el servidor.',
      });
    } finally {
      setSavingNew(false);
    }
  };

  const getCategoryLabel = (catVal: string) => {
    const found = CATEGORIAS_RECORDATORIO.find((c) => c.value === catVal);
    return found ? found.label.split('(')[0].trim() : catVal;
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 text-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Bell size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Recordatorios de Pago</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {reminders.length} {reminders.length === 1 ? 'pendiente' : 'pendientes'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Control de vencimientos y pagos programados para proteger tu liquidez
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-sm flex items-start gap-2.5 shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
            )}
            <div className="flex-1">{feedback.message}</div>
          </div>
        )}

        {/* Scrollable list content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Action button to expand New Reminder Form */}
          <div className="flex justify-between items-center pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Compromisos Próximos
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              {showAddForm ? (
                <>
                  <ChevronUp size={14} />
                  <span>Cerrar Formulario</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>+ Programar Recordatorio</span>
                </>
              )}
            </button>
          </div>

          {/* Formulario colapsable para nuevo recordatorio */}
          {showAddForm && (
            <form
              onSubmit={handleCreateReminder}
              className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 shadow-lg space-y-3.5 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Calendar size={14} />
                  Programar Nuevo Pago o Cuota
                </span>
                <span className="text-[11px] text-slate-500">Completa los campos obligatorios</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 font-medium mb-1">
                    Concepto o Título <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pago de arriendo local, Factura Enel, Cuota préstamo..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">
                    Monto estimado ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-2.5 text-slate-500" size={15} />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">
                    Fecha de Vencimiento <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Categoría</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {CATEGORIAS_RECORDATORIO.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Periodicidad</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {FRECUENCIAS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNew}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all disabled:opacity-50"
                >
                  {savingNew ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Guardar Recordatorio</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Lista de recordatorios */}
          {reminders.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CalendarCheck size={24} />
              </div>
              <h4 className="text-base font-semibold text-slate-200">No hay pagos pendientes</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No tienes pagos programados pendientes por vencer. Usa el botón de arriba para registrar futuros pagos de arriendo, servicios o proveedores.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((rem) => {
                const days = rem.days_remaining !== undefined ? Number(rem.days_remaining) : null;
                const isOverdue = days !== null && days < 0;
                const isToday = days !== null && days === 0;
                const isSoon = days !== null && days > 0 && days <= 3;

                const isLoadingAction = loadingActionId === rem.id;
                const isDeleting = deletingId === rem.id;

                const registerExpense = registerExpenseOption[rem.id] !== false;

                return (
                  <div
                    key={rem.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isOverdue
                        ? 'bg-rose-950/20 border-rose-500/40 shadow-sm'
                        : isToday
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Info */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-white text-sm truncate">{rem.title}</h4>

                          {/* Days Remaining Pill */}
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                              <AlertTriangle size={11} />
                              Venció hace {Math.abs(days!)} {Math.abs(days!) === 1 ? 'día' : 'días'}
                            </span>
                          )}
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                              <Clock size={11} />
                              ¡Vence hoy!
                            </span>
                          )}
                          {isSoon && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              Vence en {days} {days === 1 ? 'día' : 'días'}
                            </span>
                          )}
                          {!isOverdue && !isToday && !isSoon && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                              Vence el {rem.due_date}
                            </span>
                          )}
                        </div>

                        {/* Subdetails: category and frequency */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded">
                            <Tag size={10} className="text-slate-500" />
                            {getCategoryLabel(rem.category)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] bg-slate-800/80 px-2 py-0.5 rounded">
                            <Repeat size={10} className="text-slate-500" />
                            {rem.frequency}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar size={11} />
                            {rem.due_date}
                          </span>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex flex-col sm:items-end gap-2 shrink-0">
                        <div className="text-base font-bold text-white tracking-tight">
                          ${Number(rem.amount || 0).toLocaleString('es-CO')}{' '}
                          <span className="text-xs font-normal text-slate-400">COP</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Toggle registrar salida en caja */}
                          {Number(rem.amount) > 0 && (
                            <label
                              className="text-[11px] text-slate-400 flex items-center gap-1 select-none cursor-pointer pr-1"
                              title="Al marcar pagado se creará automáticamente un registro de SALIDA en el flujo de caja."
                            >
                              <input
                                type="checkbox"
                                checked={registerExpense}
                                onChange={(e) =>
                                  setRegisterExpenseOption((prev) => ({
                                    ...prev,
                                    [rem.id]: e.target.checked,
                                  }))
                                }
                                className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                              <span>Registrar gasto</span>
                            </label>
                          )}

                          {/* Botón Marcar Pagado */}
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(rem)}
                            disabled={isLoadingAction || isDeleting}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all disabled:opacity-50"
                            title="Marcar este recordatorio como pagado"
                          >
                            {isLoadingAction ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            <span>Pagar</span>
                          </button>

                          {/* Botón Eliminar */}
                          <button
                            type="button"
                            onClick={() => handleDeleteReminder(rem.id)}
                            disabled={isLoadingAction || isDeleting}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                            title="Eliminar recordatorio"
                          >
                            {isDeleting ? (
                              <Loader2 size={14} className="animate-spin text-rose-400" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 text-xs text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-amber-400" />
            Los recordatorios recurrentes se renuevan automáticamente al pagarse.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
