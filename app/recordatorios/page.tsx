'use client';

import { useEffect, useState, useMemo } from 'react';
import Pagination from '../components/Pagination';
import ReminderModal from '../components/ReminderModal';
import {
  formatDate,
  formatCategory,
  formatFrequency,
  formatCurrency,
  CATEGORY_LABELS,
} from '@/lib/formatters';

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

type SortField = 'title' | 'category' | 'due_date' | 'days_remaining' | 'amount';
type SortOrder = 'asc' | 'desc';
type FilterStatus = 'TODOS' | 'VENCIDOS' | 'PROXIMOS';

export default function RecordatoriosPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Filtros y Ordenamiento del DataTable
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('TODOS');
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modales
  const [isCreateReminderOpen, setIsCreateReminderOpen] = useState(false);
  const [payingReminder, setPayingReminder] = useState<Reminder | null>(null);
  const [registerExpense, setRegisterExpense] = useState(true);
  const [deletingReminder, setDeletingReminder] = useState<Reminder | null>(null);

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

  // Métricas totales de la tira resumen
  const totalPendientes = reminders.length;
  const compromisoTotal = useMemo(
    () => reminders.reduce((acc, r) => acc + (Number(r.amount) || 0), 0),
    [reminders]
  );
  const proximosOVencidos = useMemo(
    () => reminders.filter((r) => r.days_remaining <= 3).length,
    [reminders]
  );

  // Manejo de ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'amount' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Filtrado y ordenamiento en memoria
  const listaProcesada = useMemo(() => {
    let result = [...reminders];

    // 1. Filtro por estado
    if (filterStatus === 'VENCIDOS') {
      result = result.filter((r) => r.days_remaining < 0);
    } else if (filterStatus === 'PROXIMOS') {
      result = result.filter((r) => r.days_remaining >= 0 && r.days_remaining <= 3);
    }

    // 2. Filtro por categoría
    if (selectedCategory !== 'TODAS') {
      result = result.filter((r) => r.category === selectedCategory);
    }

    // 3. Filtro por texto (concepto/título, categoría o monto)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        const title = (r.title || '').toLowerCase();
        const cat = formatCategory(r.category).toLowerCase();
        const amountStr = Math.round(r.amount).toString();
        return title.includes(q) || cat.includes(q) || amountStr.includes(q);
      });
    }

    // 3. Ordenamiento
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title') {
        comparison = (a.title || '').localeCompare(b.title || '');
      } else if (sortField === 'category') {
        comparison = formatCategory(a.category).localeCompare(formatCategory(b.category));
      } else if (sortField === 'due_date') {
        comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else if (sortField === 'days_remaining') {
        comparison = a.days_remaining - b.days_remaining;
      } else if (sortField === 'amount') {
        comparison = Number(a.amount) - Number(b.amount);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [reminders, filterStatus, selectedCategory, searchQuery, sortField, sortOrder]);

  const hasActiveFilters = filterStatus !== 'TODOS' || selectedCategory !== 'TODAS' || searchQuery.trim() !== '';

  // Paginado
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return listaProcesada.slice(start, start + itemsPerPage);
  }, [listaProcesada, currentPage, itemsPerPage]);

  return (
    <main className="space-y-6 py-4">
      {/* Encabezado */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-black uppercase m-0">
            Recordatorios
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateReminderOpen(true)}
          className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none py-2 px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-none cursor-pointer self-start sm:self-auto"
        >
          + Nuevo Recordatorio
        </button>
      </header>

      {/* Feedback accesible */}
      {msg && (
        <div
          role="status"
          aria-live="polite"
          className="border border-black bg-black text-white p-3 font-mono text-xs uppercase flex items-center justify-between"
        >
          <span>{msg}</span>
          <button
            type="button"
            onClick={() => setMsg('')}
            aria-label="Cerrar mensaje"
            className="text-[10px] underline hover:no-underline font-mono uppercase cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="border border-black bg-black text-white p-3 font-mono text-xs uppercase flex items-center justify-between"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            aria-label="Cerrar mensaje de error"
            className="text-[10px] underline hover:no-underline font-mono uppercase cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 1. Tira horizontal compacta de métricas (Summary Strip) */}
      <section aria-label="Métricas de obligaciones pendientes">
        <div className="border border-black bg-white flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-black font-mono text-xs">
          <div className="p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3">
            <span className="uppercase tracking-wider font-bold">Pendientes:</span>
            <span className="font-bold tabular-nums text-black">
              {totalPendientes} {totalPendientes === 1 ? 'pago' : 'pagos'}
            </span>
          </div>

          <div className="p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3">
            <span className="uppercase tracking-wider font-bold">Compromiso total:</span>
            <span className="font-bold tabular-nums text-black">
              {formatCurrency(compromisoTotal, true)}
            </span>
          </div>

          <div
            className={`p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3 ${
              proximosOVencidos > 0 ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            <span className="uppercase tracking-wider font-bold">Próximos / Vencidos:</span>
            <span className="font-bold tabular-nums">
              {proximosOVencidos} {proximosOVencidos === 1 ? 'pago' : 'pagos'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Barra de herramientas del DataTable (Buscador + Filtros en una sola fila horizontal) */}
      <section className="space-y-3" aria-label="Controles de búsqueda y filtros de recordatorios">
        <div className="border border-black bg-white p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2">
          {/* Buscador de texto */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative h-9">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="BUSCAR POR CONCEPTO, CATEGORÍA O VALOR..."
                aria-label="Buscar recordatorios"
                className="h-9 w-full border border-black bg-white text-black px-3 text-xs font-mono uppercase placeholder:text-black placeholder:opacity-40 focus:outline-none focus:bg-black focus:text-white transition-none box-border"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  aria-label="Limpiar texto de búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold hover:underline cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Selector de Categoría */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filtrar por categoría"
            className="h-9 border border-black bg-white text-black px-3 text-xs font-mono uppercase focus:outline-none cursor-pointer box-border shrink-0 w-full md:w-auto"
          >
            <option value="TODAS">TODAS LAS CATEGORÍAS</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Tabs de Estado: TODOS | VENCIDOS | PRÓXIMOS */}
          <div className="h-9 flex border border-black box-border shrink-0 w-full md:w-auto" role="tablist" aria-label="Filtro por estado de vencimiento">
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'TODOS'}
              onClick={() => {
                setFilterStatus('TODOS');
                setCurrentPage(1);
              }}
              className={`h-full flex-1 md:flex-initial px-3 text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer flex items-center justify-center ${
                filterStatus === 'TODOS'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'VENCIDOS'}
              onClick={() => {
                setFilterStatus('VENCIDOS');
                setCurrentPage(1);
              }}
              className={`h-full flex-1 md:flex-initial px-3 text-xs font-mono font-bold uppercase tracking-wider border-l border-black transition-none cursor-pointer flex items-center justify-center ${
                filterStatus === 'VENCIDOS'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
            >
              Vencidos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'PROXIMOS'}
              onClick={() => {
                setFilterStatus('PROXIMOS');
                setCurrentPage(1);
              }}
              className={`h-full flex-1 md:flex-initial px-3 text-xs font-mono font-bold uppercase tracking-wider border-l border-black transition-none cursor-pointer flex items-center justify-center ${
                filterStatus === 'PROXIMOS'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
            >
              Próximos
            </button>
          </div>
        </div>
      </section>

      {/* 3. DataTable con Sorting y Jerarquía Visual */}
      <section className="space-y-4" aria-labelledby="tabla-reminders-heading">
        <div className="flex items-center justify-between">
          <h2 id="tabla-reminders-heading" className="text-xs font-mono font-bold uppercase tracking-widest text-black m-0">
            Obligaciones pendientes ({listaProcesada.length})
          </h2>
        </div>

        {loading ? (
          <div className="border border-black p-8 text-center bg-white font-mono text-xs uppercase">
            Cargando recordatorios...
          </div>
        ) : listaProcesada.length === 0 ? (
          <div className="border border-black p-8 text-center bg-white font-mono text-xs uppercase text-black">
            {hasActiveFilters
              ? 'No se encontraron recordatorios con los filtros aplicados.'
              : 'No existen recordatorios pendientes en este momento.'}
          </div>
        ) : (
          <div className="border border-black bg-white">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left font-mono text-xs">
                <thead>
                  <tr className="bg-black text-white">
                    <th
                      scope="col"
                      onClick={() => handleSort('title')}
                      className="w-[26%] p-3 border-r border-white font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Concepto</span>
                        <span>{sortField === 'title' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('category')}
                      className="w-[16%] p-3 border-r border-white font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Categoría</span>
                        <span>{sortField === 'category' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th scope="col" className="w-[11%] p-3 border-r border-white font-bold uppercase tracking-wider">
                      Frecuencia
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('due_date')}
                      className="w-[13%] p-3 border-r border-white font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Vencimiento</span>
                        <span>{sortField === 'due_date' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('days_remaining')}
                      className="w-[11%] p-3 border-r border-white font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>Plazo</span>
                        <span>{sortField === 'days_remaining' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('amount')}
                      className="w-[11%] p-3 border-r border-white font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>Monto ($)</span>
                        <span>{sortField === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th scope="col" className="w-[12%] p-3 font-bold uppercase tracking-wider text-center">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {paginatedItems.map((r) => {
                    return (
                      <tr key={r.id} className="transition-none bg-white">
                        <td className="p-3 border-r border-black font-bold uppercase truncate" title={r.title}>
                          {r.title}
                        </td>
                        <td className="p-3 border-r border-black whitespace-nowrap">
                          <span className="border border-black px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-white text-black inline-block">
                            {formatCategory(r.category)}
                          </span>
                        </td>
                        <td className="p-3 border-r border-black text-xs font-mono uppercase whitespace-nowrap">
                          {formatFrequency(r.frequency)}
                        </td>
                        <td className="p-3 border-r border-black tabular-nums whitespace-nowrap">
                          {formatDate(r.due_date)}
                        </td>
                        <td className="p-3 border-r border-black text-center whitespace-nowrap">
                          {r.days_remaining < 0 ? (
                            <span className="bg-black text-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-block">
                              VENCIDO ({Math.abs(r.days_remaining)}d)
                            </span>
                          ) : r.days_remaining === 0 ? (
                            <span className="border border-black bg-white text-black px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-block">
                              VENCE HOY
                            </span>
                          ) : (
                            <span className="text-xs font-mono tabular-nums">
                              {r.days_remaining} {r.days_remaining === 1 ? 'día' : 'días'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 border-r border-black text-right tabular-nums font-bold whitespace-nowrap">
                          {formatCurrency(r.amount)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPayingReminder(r);
                                setRegisterExpense(true);
                              }}
                              aria-label={`Pagar recordatorio: ${r.title}`}
                              className="border border-black bg-black text-white hover:bg-white hover:text-black px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-none cursor-pointer"
                            >
                              Pagar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingReminder(r)}
                              aria-label={`Eliminar recordatorio: ${r.title}`}
                              className="border border-black bg-white text-black hover:bg-black hover:text-white px-2 py-1 text-xs uppercase tracking-wider transition-none cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.max(1, Math.ceil(listaProcesada.length / itemsPerPage))}
              onPageChange={setCurrentPage}
              totalItems={listaProcesada.length}
              itemsPerPage={itemsPerPage}
              itemName="recordatorios"
            />
          </div>
        )}
      </section>

      {/* Modal de Confirmación de Pago */}
      {payingReminder && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setPayingReminder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-pay-title"
            className="w-full max-w-md bg-white border border-black p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pb-2 flex items-center justify-between">
              <h3 id="modal-pay-title" className="text-xs font-mono font-bold uppercase tracking-wider text-black m-0">
                Marcar como pagado
              </h3>
              <button
                type="button"
                onClick={() => setPayingReminder(null)}
                aria-label="Cerrar modal de pago"
                className="border border-black bg-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase hover:bg-black hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-mono text-black uppercase leading-relaxed">
              ¿Confirma el pago del compromiso &quot;{payingReminder.title}&quot; por{' '}
              {formatCurrency(payingReminder.amount)}?
            </p>

            <div className="text-xs font-mono space-y-1">
              <div>
                Frecuencia: <span className="font-bold">{formatFrequency(payingReminder.frequency)}</span>
              </div>
              <div>
                Categoría: <span className="font-bold">{formatCategory(payingReminder.category)}</span>
              </div>
              <div>
                Fecha programada: <span className="font-bold">{formatDate(payingReminder.due_date)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="pay-register-expense"
                type="checkbox"
                checked={registerExpense}
                onChange={(e) => setRegisterExpense(e.target.checked)}
                className="w-4 h-4 border border-black rounded-none cursor-pointer accent-black"
              />
              <label
                htmlFor="pay-register-expense"
                className="text-xs font-mono font-bold uppercase text-black cursor-pointer select-none"
              >
                Registrar automáticamente el egreso en caja (salida)
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPayingReminder(null)}
                className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCompleteReminder}
                aria-label={`Confirmar pago de ${payingReminder.title}`}
                className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deletingReminder && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setDeletingReminder(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-del-reminder-title"
            className="w-full max-w-md bg-white border border-black p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pb-2 flex items-center justify-between">
              <h3 id="modal-del-reminder-title" className="text-xs font-mono font-bold uppercase tracking-wider text-black m-0">
                Eliminar recordatorio
              </h3>
              <button
                type="button"
                onClick={() => setDeletingReminder(null)}
                aria-label="Cerrar modal de eliminación"
                className="border border-black bg-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase hover:bg-black hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-mono text-black uppercase leading-relaxed m-0">
              ¿Confirma que desea eliminar el recordatorio &quot;{deletingReminder.title}&quot;?
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeletingReminder(null)}
                className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteReminder}
                aria-label={`Confirmar eliminación definitiva del recordatorio ${deletingReminder.title}`}
                className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Confirmar eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación de Recordatorio */}
      <ReminderModal
        isOpen={isCreateReminderOpen}
        onClose={() => setIsCreateReminderOpen(false)}
        onSuccess={() => {
          loadReminders();
          setMsg('Recordatorio programado correctamente.');
        }}
      />
    </main>
  );
}
