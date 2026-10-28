'use client';

import { useEffect, useState, useMemo } from 'react';
import Pagination from '../components/Pagination';
import EntradaModal from '../components/EntradaModal';
import SalidaModal from '../components/SalidaModal';
import { formatCategory, formatDate, CATEGORY_LABELS } from '@/lib/formatters';

interface Movement {
  id: number;
  type: string;
  category: string;
  amount: number;
  description: string;
  movement_date: string;
}

interface Product {
  id: number;
  name: string;
  sale_price: number;
  unit_cost: number;
  stock?: number;
}

type SortField = 'date' | 'category' | 'description' | 'amount';
type SortOrder = 'asc' | 'desc';
type DateFilterOption = 'TODAS' | 'HOY' | 'ESTA_SEMANA' | 'ESTE_MES' | 'ULTIMOS_30_DIAS' | 'PERSONALIZADO';

export default function MovimientosPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [deletingMovement, setDeletingMovement] = useState<Movement | null>(null);

  // Filtros y Controles del DataTable
  const [filterType, setFilterType] = useState<'TODOS' | 'ENTRADA' | 'SALIDA'>('TODOS');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('TODAS');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modales
  const [isEntradaOpen, setIsEntradaOpen] = useState(false);
  const [isSalidaOpen, setIsSalidaOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resMov, resProd] = await Promise.all([
        fetch('/api/movements'),
        fetch('/api/products'),
      ]);

      if (resMov.status === 401) {
        window.location.href = '/login';
        return;
      }

      const dataMov = await resMov.json();
      const dataProd = await resProd.json();

      if (Array.isArray(dataMov)) setMovements(dataMov);
      if (Array.isArray(dataProd)) setProducts(dataProd);
    } catch {
      setMsg('Error al cargar datos del servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const confirmDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/movements?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al eliminar');
      }
      setMsg('Movimiento eliminado correctamente.');
      setDeletingMovement(null);
      loadData();
    } catch (err: any) {
      setMsg(err.message || 'Error al eliminar movimiento.');
      setDeletingMovement(null);
    }
  };

  // Métricas totales de cabecera
  const entradasTotal = useMemo(
    () =>
      movements
        .filter((m) => m.type === 'ENTRADA')
        .reduce((acc, m) => acc + Number(m.amount), 0),
    [movements]
  );

  const salidasTotal = useMemo(
    () =>
      movements
        .filter((m) => m.type === 'SALIDA')
        .reduce((acc, m) => acc + Number(m.amount), 0),
    [movements]
  );

  const balance = entradasTotal - salidasTotal;

  // Alternar ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'amount' || field === 'date' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Filtrado y ordenamiento en memoria (reactivo e instantáneo)
  const listaProcesada = useMemo(() => {
    let result = [...movements];

    // 1. Filtro por tipo
    if (filterType !== 'TODOS') {
      result = result.filter((m) => m.type === filterType);
    }

    // 2. Filtro por categoría
    if (selectedCategory !== 'TODAS') {
      result = result.filter((m) => m.category === selectedCategory);
    }

    // 3. Filtro por búsqueda textual
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((m) => {
        const desc = (m.description || '').toLowerCase();
        const catClean = formatCategory(m.category).toLowerCase();
        const amountStr = Math.round(m.amount).toString();
        return desc.includes(q) || catClean.includes(q) || amountStr.includes(q);
      });
    }

    // 4. Filtro por fecha / rango de fechas
    if (dateFilter !== 'TODAS') {
      const now = new Date();
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      result = result.filter((m) => {
        const movDate = (m.movement_date || '').substring(0, 10);
        if (!movDate) return true;

        if (dateFilter === 'HOY') {
          return movDate === todayISO;
        }
        if (dateFilter === 'ESTE_MES') {
          return movDate.startsWith(currentYearMonth);
        }
        if (dateFilter === 'ESTA_SEMANA') {
          const diffDays = (now.getTime() - new Date(movDate).getTime()) / (1000 * 60 * 60 * 24);
          return diffDays >= -1 && diffDays <= 7;
        }
        if (dateFilter === 'ULTIMOS_30_DIAS') {
          const diffDays = (now.getTime() - new Date(movDate).getTime()) / (1000 * 60 * 60 * 24);
          return diffDays >= -1 && diffDays <= 30;
        }
        if (dateFilter === 'PERSONALIZADO') {
          if (startDate && movDate < startDate) return false;
          if (endDate && movDate > endDate) return false;
          return true;
        }
        return true;
      });
    }

    // 5. Ordenamiento
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        const timeA = new Date(a.movement_date).getTime();
        const timeB = new Date(b.movement_date).getTime();
        comparison = timeA - timeB;
      } else if (sortField === 'amount') {
        comparison = Number(a.amount) - Number(b.amount);
      } else if (sortField === 'description') {
        comparison = (a.description || '').localeCompare(b.description || '');
      } else if (sortField === 'category') {
        comparison = formatCategory(a.category).localeCompare(formatCategory(b.category));
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [movements, filterType, selectedCategory, searchQuery, dateFilter, startDate, endDate, sortField, sortOrder]);

  // Paginado
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return listaProcesada.slice(start, start + itemsPerPage);
  }, [listaProcesada, currentPage, itemsPerPage]);

  return (
    <main className="space-y-6 py-4">
      {/* Encabezado */}
      <header className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-black uppercase m-0">
            Movimientos de Caja
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEntradaOpen(true)}
            className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
          >
            + Registrar Entrada
          </button>
          <button
            type="button"
            onClick={() => setIsSalidaOpen(true)}
            className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
          >
            - Registrar Salida
          </button>
        </div>
      </header>

      {/* Notificaciones */}
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
            aria-label="Cerrar notificación"
            className="text-[10px] underline hover:no-underline font-mono uppercase cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 1. Barra horizontal métrica compacta (Summary Strip) */}
      <section aria-label="Resumen de balance de caja">
        <div className="border border-black bg-white flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-black font-mono text-xs">
          <div className="p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3">
            <span className="uppercase tracking-wider font-bold">Total Entradas:</span>
            <span className="font-bold tabular-nums text-black">
              + $ {Math.round(entradasTotal).toLocaleString('es-CO')}
            </span>
          </div>

          <div className="p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3">
            <span className="uppercase tracking-wider font-bold">Total Salidas:</span>
            <span className="font-bold tabular-nums text-black">
              - $ {Math.round(salidasTotal).toLocaleString('es-CO')}
            </span>
          </div>

          <div className="p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3 bg-black text-white">
            <span className="uppercase tracking-wider font-bold">Balance Neto:</span>
            <span className="font-bold tabular-nums">
              $ {Math.round(balance).toLocaleString('es-CO')}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Barra de controles de la DataTable (Buscador + Filtros) */}
      <section className="space-y-3" aria-label="Controles de búsqueda y filtros">
        <div className="border border-black bg-white p-3 flex flex-col md:flex-row items-start gap-2">
          {/* Buscador de texto: flex-1 llena todo el espacio disponible hacia la izquierda */}
          <div className="flex-1 min-w-[200px] w-full">
            <div className="relative h-9">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="BUSCAR CONCEPTO O VALOR..."
                aria-label="Buscar movimientos"
                className="h-9 w-full border border-black bg-white text-black px-3 text-xs font-mono uppercase placeholder:text-black placeholder:opacity-40 focus:outline-none focus:bg-black focus:text-white transition-none box-border"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold hover:underline cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filtros a la derecha: siempre alineados y pegados al borde derecho */}
          {dateFilter !== 'PERSONALIZADO' ? (
            /* Modo Normal: Fila única simétrica con botones pegados a la derecha */
            <div className="flex flex-wrap md:flex-nowrap items-center gap-2 shrink-0 w-full md:w-auto">
              {/* Selector de Categoría */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filtrar por categoría"
                className="h-9 w-full sm:w-[200px] border border-black bg-white text-black px-2.5 text-xs font-mono uppercase focus:outline-none cursor-pointer box-border shrink-0"
              >
                <option value="TODAS">TODAS LAS CATEGORÍAS</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label.toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Selector de Rango de Fechas */}
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as DateFilterOption);
                  setCurrentPage(1);
                }}
                aria-label="Filtrar por rango de fechas"
                className="h-9 w-full sm:w-[190px] border border-black bg-white text-black px-2.5 text-xs font-mono uppercase focus:outline-none cursor-pointer box-border shrink-0"
              >
                <option value="TODAS">TODAS LAS FECHAS</option>
                <option value="HOY">HOY</option>
                <option value="ESTA_SEMANA">ESTA SEMANA</option>
                <option value="ESTE_MES">ESTE MES</option>
                <option value="ULTIMOS_30_DIAS">ÚLTIMOS 30 DÍAS</option>
                <option value="PERSONALIZADO">RANGO PERSONALIZADO...</option>
              </select>

              {/* Pestañas de tipo (Todos | Entradas | Salidas) */}
              <div
                className="h-9 w-full sm:w-[210px] flex border border-black box-border shrink-0"
                role="tablist"
                aria-label="Filtro por tipo"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterType === 'TODOS'}
                  onClick={() => {
                    setFilterType('TODOS');
                    setCurrentPage(1);
                  }}
                  className={`h-full flex-1 px-1 text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer flex items-center justify-center ${
                    filterType === 'TODOS'
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-black hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterType === 'ENTRADA'}
                  onClick={() => {
                    setFilterType('ENTRADA');
                    setCurrentPage(1);
                  }}
                  className={`h-full flex-1 px-1 text-xs font-mono font-bold uppercase tracking-wider border-l border-black transition-none cursor-pointer flex items-center justify-center ${
                    filterType === 'ENTRADA'
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-black hover:text-white'
                  }`}
                >
                  Entradas
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filterType === 'SALIDA'}
                  onClick={() => {
                    setFilterType('SALIDA');
                    setCurrentPage(1);
                  }}
                  className={`h-full flex-1 px-1 text-xs font-mono font-bold uppercase tracking-wider border-l border-black transition-none cursor-pointer flex items-center justify-center ${
                    filterType === 'SALIDA'
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-black hover:text-white'
                  }`}
                >
                  Salidas
                </button>
              </div>
            </div>
          ) : (
            /* Modo Rango Personalizado: Dos columnas independientes para ajuste exacto sin superposición */
            <div className="flex flex-col sm:flex-row items-start gap-2 shrink-0 w-full sm:w-auto">
              {/* Columna 1: Categoría y Rango de Fechas (280px para separación limpia entre texto e ícono) */}
              <div className="flex flex-col gap-2 w-full sm:w-[280px] shrink-0">
                {/* Fila 1: Selector de Categoría (mismo ancho de 280px que el bloque de fechas debajo) */}
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filtrar por categoría"
                  className="h-9 w-full border border-black bg-white text-black px-2.5 text-xs font-mono uppercase focus:outline-none cursor-pointer box-border"
                >
                  <option value="TODAS">TODAS LAS CATEGORÍAS</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label.toUpperCase()}
                    </option>
                  ))}
                </select>

                {/* Fila 2: Fechas [Inicio] y [Fin] (280px, texto e ícono separados con margin-left: auto) */}
                <div className="h-9 w-full flex items-center gap-2 box-border">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Fecha inicio"
                    className="h-9 flex-1 min-w-0 border border-black bg-white text-black px-2 text-xs font-mono focus:outline-none box-border [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:pl-2"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    aria-label="Fecha fin"
                    className="h-9 flex-1 min-w-0 border border-black bg-white text-black px-2 text-xs font-mono focus:outline-none box-border [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:pl-2"
                  />
                </div>
              </div>

              {/* Columna 2: Selector de Fechas y Pestañas de Tipo (intacto como solicitó el usuario) */}
              <div className="flex flex-col gap-2 w-full sm:w-[200px] shrink-0">
                {/* Fila 1: Selector de Fechas */}
                <select
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value as DateFilterOption);
                    setCurrentPage(1);
                  }}
                  aria-label="Filtrar por rango de fechas"
                  className="h-9 w-full border border-black bg-white text-black px-2.5 text-xs font-mono uppercase focus:outline-none cursor-pointer box-border"
                >
                  <option value="TODAS">TODAS LAS FECHAS</option>
                  <option value="HOY">HOY</option>
                  <option value="ESTA_SEMANA">ESTA SEMANA</option>
                  <option value="ESTE_MES">ESTE MES</option>
                  <option value="ULTIMOS_30_DIAS">ÚLTIMOS 30 DÍAS</option>
                  <option value="PERSONALIZADO">RANGO PERSONALIZADO...</option>
                </select>

                {/* Fila 2: Pestañas de tipo (Todos | Entradas | Salidas) */}
                <div
                  className="h-9 w-full flex border border-black box-border"
                  role="tablist"
                  aria-label="Filtro por tipo"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterType === 'TODOS'}
                    onClick={() => {
                      setFilterType('TODOS');
                      setCurrentPage(1);
                    }}
                    className={`h-full flex-1 px-1 text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer flex items-center justify-center ${
                      filterType === 'TODOS'
                        ? 'bg-black text-white'
                        : 'bg-white text-black hover:bg-black hover:text-white'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterType === 'ENTRADA'}
                    onClick={() => {
                      setFilterType('ENTRADA');
                      setCurrentPage(1);
                    }}
                    className={`h-full flex-1 px-1 text-xs font-mono font-bold uppercase tracking-wider border-l border-black transition-none cursor-pointer flex items-center justify-center ${
                      filterType === 'ENTRADA'
                        ? 'bg-black text-white'
                        : 'bg-white text-black hover:bg-black hover:text-white'
                    }`}
                  >
                    Entradas
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterType === 'SALIDA'}
                    onClick={() => {
                      setFilterType('SALIDA');
                      setCurrentPage(1);
                    }}
                    className={`h-full flex-1 px-1 text-xs font-mono font-bold uppercase tracking-wider border-l border-black transition-none cursor-pointer flex items-center justify-center ${
                      filterType === 'SALIDA'
                        ? 'bg-black text-white'
                        : 'bg-white text-black hover:bg-black hover:text-white'
                    }`}
                  >
                    Salidas
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. DataTable con Sorting y Formato Limpio */}
      <section className="space-y-4" aria-labelledby="historial-heading">
        <div className="flex items-center justify-between">
          <h2 id="historial-heading" className="text-xs font-mono font-bold uppercase tracking-widest text-black m-0">
            Historial de transacciones ({listaProcesada.length})
          </h2>
        </div>

        {loading ? (
          <div className="border border-black p-8 text-center bg-white font-mono text-xs uppercase">
            Cargando movimientos...
          </div>
        ) : listaProcesada.length === 0 ? (
          <div className="border border-black p-8 text-center bg-white font-mono text-xs uppercase text-black">
            No se encontraron movimientos con los filtros aplicados.
          </div>
        ) : (
          <div className="border border-black bg-white">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left font-mono text-xs">
                <thead>
                  <tr className="bg-black text-white">
                    <th
                      scope="col"
                      onClick={() => handleSort('date')}
                      className="w-[14%] p-3 border-r border-white font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Fecha</span>
                        <span>{sortField === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th scope="col" className="w-[14%] p-3 border-r border-white font-bold uppercase tracking-wider">
                      Tipo
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('category')}
                      className="w-[18%] p-3 border-r border-white font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Categoría</span>
                        <span>{sortField === 'category' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('description')}
                      className="w-[30%] p-3 border-r border-white font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Descripción</span>
                        <span>{sortField === 'description' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('amount')}
                      className="w-[12%] p-3 border-r border-white font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>Monto ($)</span>
                        <span>{sortField === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th scope="col" className="w-[12%] p-3 font-bold uppercase tracking-wider text-center">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {paginatedItems.map((m) => (
                    <tr key={m.id} className="transition-none bg-white">
                      <td className="p-3 border-r border-black tabular-nums whitespace-nowrap">
                        {formatDate(m.movement_date)}
                      </td>
                      <td className="p-3 border-r border-black whitespace-nowrap">
                        {m.type === 'ENTRADA' ? (
                          <span className="border border-black bg-white text-black px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-block">
                            [+] ENTRADA
                          </span>
                        ) : (
                          <span className="border border-black bg-black text-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-block">
                            [-] SALIDA
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-r border-black whitespace-nowrap">
                        <span className="border border-black px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-white text-black inline-block">
                          {formatCategory(m.category)}
                        </span>
                      </td>
                      <td className="p-3 border-r border-black font-medium truncate" title={m.description}>
                        {m.description}
                      </td>
                      <td className="p-3 border-r border-black text-right tabular-nums font-bold whitespace-nowrap">
                        {m.type === 'ENTRADA' ? '+' : '-'} $
                        {Math.round(m.amount).toLocaleString('es-CO')}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDeletingMovement(m)}
                          aria-label={`Eliminar movimiento: ${m.description} por $${Math.round(m.amount).toLocaleString('es-CO')}`}
                          className="border border-black bg-white text-black hover:bg-black hover:text-white px-2.5 py-1 text-xs uppercase tracking-wider transition-none cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.max(1, Math.ceil(listaProcesada.length / itemsPerPage))}
              onPageChange={setCurrentPage}
              totalItems={listaProcesada.length}
              itemsPerPage={itemsPerPage}
              itemName="movimientos"
            />
          </div>
        )}
      </section>

      {/* Modal accesible de confirmación para eliminar movimiento */}
      {deletingMovement && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setDeletingMovement(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-del-mov-title"
            className="w-full max-w-md bg-white border border-black p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pb-2 flex items-center justify-between">
              <h3 id="modal-del-mov-title" className="text-xs font-mono font-bold uppercase tracking-wider text-black m-0">
                Confirmar eliminación
              </h3>
              <button
                type="button"
                onClick={() => setDeletingMovement(null)}
                aria-label="Cerrar modal de confirmación"
                className="border border-black bg-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-mono text-black uppercase leading-relaxed m-0">
              ¿Confirma que desea eliminar el movimiento: &quot;{deletingMovement.description}&quot; por $
              {Math.round(deletingMovement.amount).toLocaleString('es-CO')}?
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeletingMovement(null)}
                className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(deletingMovement.id)}
                aria-label={`Confirmar eliminación permanente del movimiento ${deletingMovement.description}`}
                className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Confirmar eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para registrar Entrada */}
      <EntradaModal
        isOpen={isEntradaOpen}
        onClose={() => setIsEntradaOpen(false)}
        products={products}
        onSuccess={() => {
          loadData();
          setMsg('Entrada registrada exitosamente.');
        }}
      />

      {/* Modal para registrar Salida */}
      <SalidaModal
        isOpen={isSalidaOpen}
        onClose={() => setIsSalidaOpen(false)}
        products={products}
        onSuccess={() => {
          loadData();
          setMsg('Salida registrada exitosamente.');
        }}
      />
    </main>
  );
}
