'use client';

import { useEffect, useState, useMemo } from 'react';
import Pagination from '../components/Pagination';
import ProductModal from '../components/ProductModal';
import { formatCurrency, formatSupplyModel } from '@/lib/formatters';

interface Product {
  id: number;
  name: string;
  supply_model: string;
  unit_cost: number;
  extra_cost: number;
  sale_price: number;
  stock: number;
  active: boolean;
}

type SortField = 'name' | 'supply_model' | 'cost' | 'sale_price' | 'margin' | 'stock';
type SortOrder = 'asc' | 'desc';
type StockFilter = 'TODOS' | 'BAJO' | 'DISPONIBLE';

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [msg, setMsg] = useState('');

  // Filtros y Ordenamiento del DataTable
  const [searchQuery, setSearchQuery] = useState('');
  const [modelFilter, setModelFilter] = useState<string>('TODOS');
  const [stockFilter, setStockFilter] = useState<StockFilter>('TODOS');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modales
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<{ id: number; name: string; currentStock: number } | null>(null);
  const [newStockValue, setNewStockValue] = useState('');
  const [stockModalError, setStockModalError] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: number; name: string } | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch {
      setMsg('Error al conectar con la base de datos de productos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openStockModal = (prod: Product) => {
    setStockTarget({ id: prod.id, name: prod.name, currentStock: prod.stock });
    setNewStockValue(String(prod.stock));
    setStockModalError('');
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockTarget) return;

    const val = Number(newStockValue);
    if (isNaN(val) || val < 0 || !Number.isInteger(val)) {
      setStockModalError('Cantidad inválida. Ingrese un número entero no negativo.');
      return;
    }

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: stockTarget.id, stock: val }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al actualizar el inventario.');
      }

      setMsg(`Nivel de stock de "${stockTarget.name}" actualizado a ${val} unidades.`);
      setStockTarget(null);
      loadProducts();
    } catch (err: any) {
      setStockModalError(err.message || 'Error al actualizar inventario.');
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;

    try {
      const res = await fetch(`/api/products?id=${deactivateTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al retirar producto del catálogo.');
      }

      setMsg(`Artículo "${deactivateTarget.name}" retirado exitosamente.`);
      setDeactivateTarget(null);
      loadProducts();
    } catch (err: any) {
      setMsg(err.message || 'Error al retirar artículo.');
      setDeactivateTarget(null);
    }
  };

  // Métricas totales de la tira resumen
  const totalUnidades = useMemo(
    () => products.reduce((acc, p) => acc + (p.stock || 0), 0),
    [products]
  );
  const valorInventario = useMemo(
    () =>
      products.reduce(
        (acc, p) => acc + (Number(p.unit_cost) + Number(p.extra_cost)) * Number(p.stock || 0),
        0
      ),
    [products]
  );

  // Manejo de ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'cost' || field === 'sale_price' || field === 'stock' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Filtrado y ordenamiento en memoria
  const listaProcesada = useMemo(() => {
    let result = [...products];

    // 1. Filtro por modelo de suministro
    if (modelFilter !== 'TODOS') {
      result = result.filter((p) => p.supply_model === modelFilter);
    }

    // 2. Filtro por estado de stock
    if (stockFilter === 'BAJO') {
      result = result.filter((p) => p.stock <= 2);
    } else if (stockFilter === 'DISPONIBLE') {
      result = result.filter((p) => p.stock > 2);
    }

    // 3. Filtro por búsqueda de texto
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const modelClean = (formatSupplyModel(p.supply_model) || '').toLowerCase();
        const modelRaw = (p.supply_model || '').toLowerCase();
        const price = Math.round(p.sale_price).toString();
        return name.includes(q) || modelClean.includes(q) || modelRaw.includes(q) || price.includes(q);
      });
    }

    // 4. Ordenamiento
    result.sort((a, b) => {
      let comparison = 0;
      const costA = Number(a.unit_cost) + Number(a.extra_cost);
      const costB = Number(b.unit_cost) + Number(b.extra_cost);
      const marginA = Number(a.sale_price) - costA;
      const marginB = Number(b.sale_price) - costB;

      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'supply_model') {
        comparison = a.supply_model.localeCompare(b.supply_model);
      } else if (sortField === 'cost') {
        comparison = costA - costB;
      } else if (sortField === 'sale_price') {
        comparison = Number(a.sale_price) - Number(b.sale_price);
      } else if (sortField === 'margin') {
        comparison = marginA - marginB;
      } else if (sortField === 'stock') {
        comparison = a.stock - b.stock;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [products, modelFilter, stockFilter, searchQuery, sortField, sortOrder]);

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
            Catálogo de Productos
          </h1>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setIsCreateProductOpen(true)}
            className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
          >
            + Nuevo Producto
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

      {/* 1. Tira horizontal métrica compacta (Summary Strip) */}
      <section aria-label="Métricas de inventario">
        <div className="border border-black bg-white flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-black font-mono text-xs">
          <div className="p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3">
            <span className="uppercase tracking-wider font-bold">Referencias:</span>
            <span className="font-bold tabular-nums text-black">
              {products.length} artículos
            </span>
          </div>

          <div className="p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3">
            <span className="uppercase tracking-wider font-bold">Existencias Físicas:</span>
            <span className="font-bold tabular-nums text-black">
              {totalUnidades} unidades
            </span>
          </div>

          <div className="p-3 flex-1 flex items-center justify-between sm:justify-start sm:gap-3 bg-black text-white">
            <span className="uppercase tracking-wider font-bold">Capital en Inventario:</span>
            <span className="font-bold tabular-nums">
              {formatCurrency(valorInventario, true)}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Barra de controles de DataTable (Buscador + Filtros en una sola fila horizontal) */}
      <section className="space-y-3" aria-label="Controles de búsqueda y filtros">
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
                placeholder="BUSCAR ARTÍCULO O MODELO..."
                aria-label="Buscar productos"
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

          {/* Selector de Modelo de Suministro */}
          <select
            value={modelFilter}
            onChange={(e) => {
              setModelFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filtrar por modelo de suministro"
            className="h-9 border border-black bg-white text-black px-3 text-xs font-mono uppercase focus:outline-none cursor-pointer box-border shrink-0 w-full md:w-auto"
          >
            <option value="TODOS">TODOS LOS MODELOS</option>
            <option value="REVENTA">REVENTA</option>
            <option value="PRODUCCION">PRODUCCIÓN</option>
          </select>

          {/* Tabs de Stock: TODOS | BAJO | DISPONIBLE */}
          <div className="h-9 flex border border-black box-border shrink-0 w-full md:w-auto" role="tablist" aria-label="Filtro por nivel de stock">
            <button
              type="button"
              role="tab"
              aria-selected={stockFilter === 'TODOS'}
              onClick={() => {
                setStockFilter('TODOS');
                setCurrentPage(1);
              }}
              className={`h-full flex-1 md:flex-initial px-3 text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer flex items-center justify-center ${
                stockFilter === 'TODOS'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={stockFilter === 'BAJO'}
              onClick={() => {
                setStockFilter('BAJO');
                setCurrentPage(1);
              }}
              className={`h-full flex-1 md:flex-initial px-3 text-xs font-mono font-bold uppercase tracking-wider border-l border-black transition-none cursor-pointer flex items-center justify-center ${
                stockFilter === 'BAJO'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
            >
              Stock Bajo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={stockFilter === 'DISPONIBLE'}
              onClick={() => {
                setStockFilter('DISPONIBLE');
                setCurrentPage(1);
              }}
              className={`h-full flex-1 md:flex-initial px-3 text-xs font-mono font-bold uppercase tracking-wider border-l border-black transition-none cursor-pointer flex items-center justify-center ${
                stockFilter === 'DISPONIBLE'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
            >
              Disponible
            </button>
          </div>
        </div>
      </section>

      {/* 3. DataTable con Sorting y Estilo Brutalista */}
      <section className="space-y-4" aria-labelledby="catalogo-heading">
        <div className="flex items-center justify-between">
          <h2 id="catalogo-heading" className="text-xs font-mono font-bold uppercase tracking-widest text-black m-0">
            Catálogo de productos ({listaProcesada.length})
          </h2>
        </div>

        {loading ? (
          <div className="border border-black p-8 text-center bg-white font-mono text-xs uppercase">
            Cargando productos...
          </div>
        ) : listaProcesada.length === 0 ? (
          <div className="border border-black p-8 text-center bg-white font-mono text-xs uppercase text-black">
            No se encontraron productos con los filtros aplicados.
          </div>
        ) : (
          <div className="border border-black bg-white">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left font-mono text-xs">
                <thead>
                  <tr className="bg-black text-white">
                    <th
                      scope="col"
                      onClick={() => handleSort('name')}
                      className="w-[24%] p-3 border-r border-white font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Artículo</span>
                        <span>{sortField === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('supply_model')}
                      className="w-[13%] p-3 border-r border-white font-bold uppercase tracking-wider cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Modelo</span>
                        <span>{sortField === 'supply_model' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('cost')}
                      className="w-[13%] p-3 border-r border-white font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>Costo Total</span>
                        <span>{sortField === 'cost' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('sale_price')}
                      className="w-[13%] p-3 border-r border-white font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>Precio Venta</span>
                        <span>{sortField === 'sale_price' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('margin')}
                      className="w-[13%] p-3 border-r border-white font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span>Margen Est.</span>
                        <span>{sortField === 'margin' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => handleSort('stock')}
                      className="w-[11%] p-3 border-r border-white font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-white hover:text-black hover:border-r-black hover:border-l hover:border-l-black transition-none select-none"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>Stock</span>
                        <span>{sortField === 'stock' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </div>
                    </th>
                    <th scope="col" className="w-[13%] p-3 font-bold uppercase tracking-wider text-center">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black">
                  {paginatedItems.map((p) => {
                    const totalCost = Number(p.unit_cost) + Number(p.extra_cost);
                    const margin = Number(p.sale_price) - totalCost;
                    const marginPct =
                      Number(p.sale_price) > 0
                        ? Math.round((margin / Number(p.sale_price)) * 100)
                        : 0;

                    return (
                      <tr key={p.id} className="transition-none bg-white">
                        <td className="p-3 border-r border-black font-bold uppercase truncate" title={p.name}>
                          {p.name}
                        </td>
                        <td className="p-3 border-r border-black whitespace-nowrap">
                          <span className="border border-black px-1.5 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-white text-black inline-block">
                            {formatSupplyModel(p.supply_model).toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 border-r border-black text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(totalCost)}
                        </td>
                        <td className="p-3 border-r border-black text-right tabular-nums font-bold whitespace-nowrap">
                          {formatCurrency(p.sale_price)}
                        </td>
                        <td className="p-3 border-r border-black text-right tabular-nums whitespace-nowrap text-[11px]">
                          {formatCurrency(margin)} ({marginPct}%)
                        </td>
                        <td className="p-3 border-r border-black text-center whitespace-nowrap">
                          {p.stock <= 2 ? (
                            <span className="border border-black bg-black text-white px-2 py-0.5 text-[11px] font-bold tabular-nums">
                              {p.stock} UDS (BAJO)
                            </span>
                          ) : (
                            <span className="font-bold text-black tabular-nums">
                              {p.stock} UDS
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openStockModal(p)}
                              aria-label={`Modificar stock de ${p.name}`}
                              className="border border-black bg-black text-white hover:bg-white hover:text-black px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-none cursor-pointer"
                            >
                              Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeactivateTarget({ id: p.id, name: p.name })}
                              aria-label={`Retirar producto ${p.name} del catálogo`}
                              className="border border-black bg-white text-black hover:bg-black hover:text-white px-2 py-1 text-xs uppercase tracking-wider transition-none cursor-pointer"
                            >
                              Retirar
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
              itemName="productos"
            />
          </div>
        )}
      </section>

      {/* Modal para Modificar Stock */}
      {stockTarget && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setStockTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-stock-title"
            className="w-full max-w-md bg-white border border-black p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pb-2 flex items-center justify-between">
              <h3 id="modal-stock-title" className="text-xs font-mono font-bold uppercase tracking-wider text-black m-0">
                Modificar stock
              </h3>
              <button
                type="button"
                onClick={() => setStockTarget(null)}
                aria-label="Cerrar ventana modal de stock"
                className="border border-black bg-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs font-mono uppercase text-black">
              Producto: <span className="font-bold">{stockTarget.name}</span>
            </div>
            <div className="text-xs font-mono uppercase text-black">
              Existencia actual: <span className="font-bold tabular-nums">{stockTarget.currentStock} uds</span>
            </div>

            {stockModalError && (
              <div role="alert" className="border border-black bg-black text-white p-2.5 font-mono text-[11px] uppercase">
                {stockModalError}
              </div>
            )}

            <form onSubmit={handleStockSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="modal-new-stock"
                  className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black"
                >
                  Nueva cantidad de stock:
                </label>
                <input
                  id="modal-new-stock"
                  type="number"
                  min="0"
                  step="1"
                  autoFocus
                  required
                  value={newStockValue}
                  onChange={(e) => setNewStockValue(e.target.value)}
                  className="w-full border border-black bg-white text-black px-3 py-2 text-xs font-mono rounded-none focus:outline-none"
                  placeholder="0"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStockTarget(null)}
                  className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  aria-label={`Guardar nueva cantidad de stock para ${stockTarget.name}`}
                  className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
                >
                  Guardar stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Desactivar / Retirar Producto */}
      {deactivateTarget && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none"
          onClick={() => setDeactivateTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-deactivate-title"
            className="w-full max-w-md bg-white border border-black p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pb-2 flex items-center justify-between">
              <h3 id="modal-deactivate-title" className="text-xs font-mono font-bold uppercase tracking-wider text-black m-0">
                Retirar del catálogo
              </h3>
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                aria-label="Cerrar modal de retiro"
                className="border border-black bg-white px-2 py-0.5 text-[10px] font-mono font-bold uppercase hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-mono text-black uppercase leading-relaxed m-0">
              ¿Confirma el retiro del artículo &quot;{deactivateTarget.name}&quot; del catálogo activo?
            </p>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                className="border border-black bg-white text-black hover:bg-black hover:text-white transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                aria-label={`Confirmar retiro del artículo ${deactivateTarget.name}`}
                className="border border-black bg-black text-white hover:bg-white hover:text-black transition-none px-4 py-2 text-xs font-mono font-bold uppercase cursor-pointer"
              >
                Confirmar retiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear nuevo producto */}
      <ProductModal
        isOpen={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        onSuccess={() => {
          loadProducts();
          setMsg('Producto creado exitosamente.');
        }}
      />
    </main>
  );
}
