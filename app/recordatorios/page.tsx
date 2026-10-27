'use client';

import { useEffect, useState } from 'react';

interface Reminder {
  id: number;
  user_id: number;
  title: string;
  amount: number;
  category: string;
  frequency: 'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';
  due_date: string;
  is_completed: boolean;
  days_remaining: number;
}

export default function RecordatoriosPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modales accesibles
  const [payingReminder, setPayingReminder] = useState<Reminder | null>(null);
  const [registerExpense, setRegisterExpense] = useState(true);
  const [deletingReminder, setDeletingReminder] = useState<Reminder | null>(null);

  // Formulario
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('SERVICIOS_ARRIENDO');
  const [frequency, setFrequency] = useState<'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL'>('MENSUAL');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  const loadReminders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reminders');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        throw new Error('Error al consultar los recordatorios.');
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setReminders(data);
      }
    } catch {
      setErrorMsg('Error al conectar con el servidor para consultar recordatorios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleSubmitReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          amount: Number(amount) || 0,
          category,
          frequency,
          due_date: dueDate,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al programar el recordatorio.');
      }

      setMsg(`Recordatorio "${title.toUpperCase()}" programado exitosamente.`);
      setTitle('');
      setAmount('');
      setCategory('SERVICIOS_ARRIENDO');
      setFrequency('MENSUAL');
      loadReminders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar recordatorio.');
    }
  };

  const handleCompleteReminder = async () => {
    if (!payingReminder) return;
    setMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payingReminder.id,
          registerExpense,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al procesar el pago del recordatorio.');
      }

      setMsg(
        `Recordatorio "${payingReminder.title}" marcado como pagado.${
          registerExpense ? ' Egreso registrado en caja.' : ''
        }`
      );
      setPayingReminder(null);
      loadReminders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al completar el pago.');
      setPayingReminder(null);
    }
  };

  const handleDeleteReminder = async () => {
    if (!deletingReminder) return;
    setMsg('');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/reminders?id=${deletingReminder.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al eliminar el recordatorio.');
      }

      setMsg(`Recordatorio "${deletingReminder.title}" eliminado correctamente.`);
      setDeletingReminder(null);
      loadReminders();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el recordatorio.');
      setDeletingReminder(null);
    }
  };

  const totalPorPagar = reminders.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const proximosAVencer = reminders.filter((r) => r.days_remaining <= 3).length;

  return (
    <main className="space-y-8 py-4">
      {/* Encabezado brutalista */}
      <header className="border-b-2 border-black pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
              PROGRAMACIÓN FINANCIERA Y OBLIGACIONES
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-black uppercase">
              RECORDATORIOS // PAGOS PENDIENTES
            </h1>
          </div>
          <div className="text-[11px] font-mono text-neutral-600 uppercase tracking-wider">
            TOTAL PENDIENTES: {reminders.length}
          </div>
        </div>
      </header>

      {/* Feedback accesible con role="status" y role="alert" */}
      {msg && (
        <div
          role="status"
          aria-live="polite"
          className="border-2 border-black bg-black text-white p-3 font-mono text-xs uppercase flex items-center justify-between"
        >
          <span>[SISTEMA]: {msg}</span>
          <button
            type="button"
            onClick={() => setMsg('')}
            aria-label="Cerrar mensaje del sistema"
            className="text-[10px] underline hover:text-neutral-300 font-mono uppercase cursor-pointer"
          >
            [CERRAR]
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="border-2 border-black bg-black text-white p-3 font-mono text-xs uppercase flex items-center justify-between"
        >
          <span>[ALERTA / ERROR]: {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            aria-label="Cerrar mensaje de error"
            className="text-[10px] underline hover:text-neutral-300 font-mono uppercase cursor-pointer"
          >
            [CERRAR]
          </button>
        </div>
      )}

      {/* Resumen numérico en cajas rectangulares de datos */}
      <section aria-label="Métricas de obligaciones pendientes">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              MÉTRICA // PENDIENTES
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              {reminders.length} PAGOS
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              OBLIGACIONES ACTIVAS
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              MÉTRICA // COMPROMISO TOTAL
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              $ {Math.round(totalPorPagar).toLocaleString('es-CO')}
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              MONTO TOTAL COMPROMETIDO
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              MÉTRICA // VENCIMIENTO CRÍTICO
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              {proximosAVencer} PAGOS
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              VENCE EN ≤ 3 DÍAS O VENCIDOS
            </div>
          </div>
        </div>
      </section>

      {/* Formulario de creación de recordatorios con marco negro 2px */}
      <section className="border-2 border-black bg-white p-6" aria-labelledby="form-reminder-heading">
        <div className="border-b border-black pb-3 mb-5">
          <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
            PROGRAMAR COMPROMISO
          </div>
          <h2 id="form-reminder-heading" className="text-sm font-mono font-bold uppercase tracking-widest text-black">
            FORMULARIO DE RECORDATORIO // PROGRAMACIÓN DE VENCIMIENTO
          </h2>
        </div>

        <form onSubmit={handleSubmitReminder} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="rem-title"
                className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black"
              >
                TÍTULO / CONCEPTO DEL PAGO:
              </label>
              <input
                id="rem-title"
                type="text"
                placeholder="EJ. ARRIENDO LOCAL, ENERGÍA, CUOTA CRÉDITO..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:bg-neutral-50"
              />
            </div>

            <div>
              <label
                htmlFor="rem-amount"
                className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black"
              >
                MONTO ESTIMADO ($ COP):
              </label>
              <input
                id="rem-amount"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:bg-neutral-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="rem-category"
                className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black"
              >
                CATEGORÍA CONTABLE:
              </label>
              <select
                id="rem-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:bg-neutral-50"
              >
                <option value="SERVICIOS_ARRIENDO">SERVICIOS O ARRIENDO</option>
                <option value="GASTO_GENERAL">GASTO GENERAL</option>
                <option value="COMPRA_CATALOGO">COMPRA DE MERCANCÍA</option>
                <option value="MATERIA_PRIMA">MATERIA PRIMA</option>
                <option value="GASTO_NO_PLANEADO">GASTO IMPREVISTO</option>
                <option value="RETIRO_PERSONAL">RETIRO PERSONAL</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="rem-frequency"
                className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black"
              >
                FRECUENCIA DE PAGO:
              </label>
              <select
                id="rem-frequency"
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as 'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL')
                }
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:bg-neutral-50"
              >
                <option value="UNICO">PAGO ÚNICO</option>
                <option value="SEMANAL">SEMANAL (CADA 7 DÍAS)</option>
                <option value="QUINCENAL">QUINCENAL (CADA 15 DÍAS)</option>
                <option value="MENSUAL">MENSUAL (CADA MES)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="rem-due-date"
                className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black"
              >
                FECHA DE VENCIMIENTO (YYYY-MM-DD):
              </label>
              <input
                id="rem-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:bg-neutral-50"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-none py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-none cursor-pointer"
            >
              [+] PROGRAMAR RECORDATORIO
            </button>
          </div>
        </form>
      </section>

      {/* Tabla geométrica de recordatorios pendientes */}
      <section className="space-y-4" aria-labelledby="tabla-reminders-heading">
        <div className="border-b border-black pb-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
              OBLIGACIONES REGISTRADAS
            </div>
            <h2 id="tabla-reminders-heading" className="text-xs font-mono font-bold uppercase tracking-widest text-black">
              VIGENCIAS // OBLIGACIONES ACTIVAS
            </h2>
          </div>
          <span className="text-[11px] font-mono text-neutral-600 uppercase">
            REGISTROS: {reminders.length}
          </span>
        </div>

        {loading ? (
          <div className="border-2 border-black p-8 text-center bg-white font-mono text-xs uppercase">
            [...] CARGANDO RECORDATORIOS...
          </div>
        ) : reminders.length === 0 ? (
          <div className="border-2 border-black p-8 text-center bg-white font-mono text-xs uppercase text-neutral-500">
            NO EXISTEN RECORDATORIOS PENDIENTES EN ESTE MOMENTO.
          </div>
        ) : (
          <div className="border-2 border-black overflow-x-auto bg-white">
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead>
                <tr className="bg-black text-white border-b-2 border-black">
                  <th scope="col" className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    CONCEPTO
                  </th>
                  <th scope="col" className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    CATEGORÍA
                  </th>
                  <th scope="col" className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    FRECUENCIA
                  </th>
                  <th scope="col" className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    VENCIMIENTO
                  </th>
                  <th scope="col" className="p-3 border-r border-black font-bold uppercase tracking-wider text-center">
                    PLAZO
                  </th>
                  <th scope="col" className="p-3 border-r border-black font-bold uppercase tracking-wider text-right">
                    MONTO ($)
                  </th>
                  <th scope="col" className="p-3 font-bold uppercase tracking-wider text-center">
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {reminders.map((r) => {
                  const isLate = r.days_remaining < 0;
                  const isDueToday = r.days_remaining === 0;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-neutral-100 transition-none border-b border-black last:border-b-0"
                    >
                      <td className="p-3 border-r border-black font-bold uppercase">
                        {r.title}
                      </td>
                      <td className="p-3 border-r border-black text-[11px] whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 border border-black bg-white text-black text-[10px]">
                          {r.category}
                        </span>
                      </td>
                      <td className="p-3 border-r border-black text-[11px] whitespace-nowrap">
                        {r.frequency}
                      </td>
                      <td className="p-3 border-r border-black tabular-nums whitespace-nowrap">
                        {r.due_date}
                      </td>
                      <td className="p-3 border-r border-black text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 border border-black font-bold text-[10px] uppercase tracking-wider ${
                            isLate
                              ? 'bg-black text-white'
                              : isDueToday
                              ? 'bg-black text-white'
                              : r.days_remaining <= 3
                              ? 'bg-neutral-200 text-black'
                              : 'bg-white text-black'
                          }`}
                        >
                          {isLate
                            ? `VENCIDO (${Math.abs(r.days_remaining)} DÍAS)`
                            : isDueToday
                            ? 'VENCE HOY'
                            : `${r.days_remaining} DÍAS RESTANTES`}
                        </span>
                      </td>
                      <td className="p-3 border-r border-black text-right tabular-nums font-bold whitespace-nowrap">
                        $ {Math.round(r.amount).toLocaleString('es-CO')}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPayingReminder(r);
                              setRegisterExpense(true);
                            }}
                            aria-label={`Pagar recordatorio: ${r.title}`}
                            className="border border-black bg-white hover:bg-black hover:text-white transition-none px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                          >
                            [PAGAR]
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingReminder(r)}
                            aria-label={`Eliminar recordatorio: ${r.title}`}
                            className="border border-black bg-white hover:bg-black hover:text-white transition-none px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                          >
                            [ELIMINAR]
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Accesible de Confirmación de Pago */}
      {payingReminder && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setPayingReminder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-pay-title"
            className="w-full max-w-md bg-white border-2 border-black p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b-2 border-black pb-2 flex items-center justify-between">
              <h3 id="modal-pay-title" className="text-xs font-mono font-bold uppercase tracking-wider text-black m-0">
                LIQUIDACIÓN // MARCAR COMO PAGADO
              </h3>
              <button
                type="button"
                onClick={() => setPayingReminder(null)}
                aria-label="Cerrar modal de pago"
                className="border border-black bg-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase hover:bg-black hover:text-white"
              >
                [X]
              </button>
            </div>

            <p className="text-xs font-mono text-black uppercase leading-relaxed">
              ¿CONFIRMA EL PAGO DEL COMPROMISO &quot;{payingReminder.title}&quot; POR $
              {Math.round(payingReminder.amount).toLocaleString('es-CO')}?
            </p>

            <div className="border border-black p-3 bg-neutral-50 text-xs font-mono space-y-1">
              <div>FRECUENCIA: <span className="font-bold">{payingReminder.frequency}</span></div>
              <div>CATEGORÍA: <span className="font-bold">{payingReminder.category}</span></div>
              <div>FECHA PROGRAMADA: <span className="font-bold">{payingReminder.due_date}</span></div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="pay-register-expense"
                type="checkbox"
                checked={registerExpense}
                onChange={(e) => setRegisterExpense(e.target.checked)}
                className="w-4 h-4 border-2 border-black rounded-none cursor-pointer"
              />
              <label
                htmlFor="pay-register-expense"
                className="text-xs font-mono font-bold uppercase text-black cursor-pointer select-none"
              >
                REGISTRAR AUTOMÁTICAMENTE EL EGRESO EN CAJA (SALIDA)
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPayingReminder(null)}
                className="border-2 border-black bg-white text-black hover:bg-neutral-100 transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                [CANCELAR]
              </button>
              <button
                type="button"
                onClick={handleCompleteReminder}
                aria-label={`Confirmar pago de ${payingReminder.title}`}
                className="border-2 border-black bg-black text-white hover:bg-neutral-800 transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                [CONFIRMAR PAGO]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Accesible de Confirmación de Eliminación */}
      {deletingReminder && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setDeletingReminder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-del-reminder-title"
            className="w-full max-w-md bg-white border-2 border-black p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b-2 border-black pb-2 flex items-center justify-between">
              <h3 id="modal-del-reminder-title" className="text-xs font-mono font-bold uppercase tracking-wider text-black m-0">
                [ALERTA] // CONFIRMACIÓN DE ELIMINACIÓN
              </h3>
              <button
                type="button"
                onClick={() => setDeletingReminder(null)}
                aria-label="Cerrar modal de eliminación"
                className="border border-black bg-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase hover:bg-black hover:text-white"
              >
                [X]
              </button>
            </div>

            <p className="text-xs font-mono text-black uppercase leading-relaxed">
              ¿CONFIRMA QUE DESEA ELIMINAR EL RECORDATORIO &quot;{deletingReminder.title}&quot;?
            </p>

            <p className="text-[10px] font-mono text-neutral-600 uppercase">
              ESTA ACCIÓN NO SE PUEDE DESHACER Y REMOVERÁ EL VENCIMIENTO PROGRAMADO.
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeletingReminder(null)}
                className="border-2 border-black bg-white text-black hover:bg-neutral-100 transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                [CANCELAR]
              </button>
              <button
                type="button"
                onClick={handleDeleteReminder}
                aria-label={`Confirmar eliminación definitiva del recordatorio ${deletingReminder.title}`}
                className="border-2 border-black bg-black text-white hover:bg-neutral-800 transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                [CONFIRMAR ELIMINACIÓN]
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
