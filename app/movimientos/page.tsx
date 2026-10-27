'use client';

import { useEffect, useState } from 'react';

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
}

export default function MovimientosPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'TODOS' | 'ENTRADA' | 'SALIDA'>('TODOS');
  const [msg, setMsg] = useState('');

  // Formulario
  const [type, setType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [category, setCategory] = useState('VENTA_PRODUCTO');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [productId, setProductId] = useState('');

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

  const handleProductSelect = (id: string) => {
    setProductId(id);
    const prod = products.find((p) => String(p.id) === id);
    if (prod) {
      const price = type === 'ENTRADA' ? prod.sale_price : prod.unit_cost;
      setAmount(String(price));
      if (!description) {
        setDescription(`${type === 'ENTRADA' ? 'Venta' : 'Compra'}: ${prod.name}`);
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');

    try {
      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          category,
          amount: Number(amount),
          description,
          product_id: productId ? Number(productId) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al registrar movimiento');
      }

      setMsg('Movimiento registrado exitosamente.');
      setAmount('');
      setDescription('');
      setProductId('');
      loadData();
    } catch (err: any) {
      setMsg(err.message || 'Error al guardar.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Confirma que desea eliminar este movimiento de forma permanente?')) return;
    try {
      const res = await fetch(`/api/movements?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setMsg('Movimiento eliminado correctamente.');
      loadData();
    } catch (err: any) {
      setMsg(err.message || 'Error al eliminar movimiento.');
    }
  };

  const entradasTotal = movements
    .filter((m) => m.type === 'ENTRADA')
    .reduce((acc, m) => acc + Number(m.amount), 0);
  const salidasTotal = movements
    .filter((m) => m.type === 'SALIDA')
    .reduce((acc, m) => acc + Number(m.amount), 0);
  const balance = entradasTotal - salidasTotal;

  const listaFiltrada = movements.filter((m) => {
    if (filter === 'TODOS') return true;
    return m.type === filter;
  });

  return (
    <main className="space-y-8 py-4">
      {/* Encabezado con línea negra */}
      <header className="border-b-2 border-black pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
              GESTIÓN DE FLUJO Y LIQUIDEZ
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-black uppercase">
              MOVIMIENTOS // CONTROL DE CAJA
            </h1>
          </div>
          <div className="text-[11px] font-mono text-neutral-600 uppercase tracking-wider">
            TOTAL MOVIMIENTOS: {movements.length}
          </div>
        </div>
      </header>

      {/* Notificaciones */}
      {msg && (
        <div className="border-2 border-black bg-black text-white p-3 font-mono text-xs uppercase flex items-center justify-between">
          <span>[SISTEMA]: {msg}</span>
          <button
            type="button"
            onClick={() => setMsg('')}
            className="text-[10px] underline hover:text-neutral-300 font-mono uppercase"
          >
            [CERRAR]
          </button>
        </div>
      )}

      {/* Resumen numérico en cajas rectangulares de datos */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              RESUMEN // ENTRADAS
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              + $ {Math.round(entradasTotal).toLocaleString('es-CO')}
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              INGRESOS TOTALES
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              RESUMEN // SALIDAS
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              - $ {Math.round(salidasTotal).toLocaleString('es-CO')}
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              GASTOS Y EGRESOS
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              RESUMEN // BALANCE
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              $ {Math.round(balance).toLocaleString('es-CO')}
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              FLUJO NETO DISPONIBLE
            </div>
          </div>
        </div>
      </section>

      {/* Formulario de Registro estructurado en un marco rectangular negro */}
      <section className="border-2 border-black bg-white p-6">
        <div className="border-b border-black pb-3 mb-5">
          <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
            NUEVA TRANSACCIÓN
          </div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-black">
            FORMULARIO DE REGISTRO // ASIGNACIÓN DE CAJA
          </h2>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                TIPO DE MOVIMIENTO:
              </label>
              <select
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as 'ENTRADA' | 'SALIDA';
                  setType(newType);
                  setCategory(newType === 'ENTRADA' ? 'VENTA_PRODUCTO' : 'GASTO_GENERAL');
                }}
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
              >
                <option value="ENTRADA">ENTRADA (+ INGRESO DE DINERO)</option>
                <option value="SALIDA">SALIDA (- EGRESO / GASTO)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                CATEGORÍA CONTABLE:
              </label>
              {type === 'ENTRADA' ? (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
                >
                  <option value="VENTA_PRODUCTO">VENTA DE PRODUCTO</option>
                  <option value="APORTE_CAPITAL">APORTE DE CAPITAL</option>
                  <option value="OTRO_INGRESO">OTRO INGRESO</option>
                </select>
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
                >
                  <option value="GASTO_GENERAL">GASTO GENERAL</option>
                  <option value="COMPRA_CATALOGO">COMPRA DE MERCANCÍA</option>
                  <option value="MATERIA_PRIMA">MATERIA PRIMA</option>
                  <option value="SERVICIOS_ARRIENDO">SERVICIOS O ARRIENDO</option>
                  <option value="GASTO_NO_PLANEADO">GASTO IMPREVISTO</option>
                  <option value="RETIRO_PERSONAL">RETIRO PERSONAL</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.length > 0 && (
              <div>
                <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                  PRODUCTO RELACIONADO (OPCIONAL):
                </label>
                <select
                  value={productId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
                >
                  <option value="">-- NINGUNO (TRANSACCIÓN MANUAL) --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name.toUpperCase()} (P. VENTA: ${Math.round(p.sale_price)} | COSTO: ${Math.round(p.unit_cost)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={products.length > 0 ? '' : 'sm:col-span-2'}>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                MONTO ($ COP / NUMÉRICO):
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
              DESCRIPCIÓN / CONCEPTO:
            </label>
            <input
              type="text"
              placeholder="DETALLE DE LA OPERACIÓN..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-none py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-none cursor-pointer"
            >
              [+] REGISTRAR MOVIMIENTO
            </button>
          </div>
        </form>
      </section>

      {/* Historial con pestañas de filtro tipo tabs y tabla estricta */}
      <section className="space-y-4">
        <div className="border-b border-black pb-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
              REGISTRO AUDITABLE
            </div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
              HISTORIAL DE TRANSACCIONES
            </h2>
          </div>

          {/* Botones de filtro rectangulares tipo tabs */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setFilter('TODOS')}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border-2 border-black transition-none cursor-pointer ${
                filter === 'TODOS'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-neutral-100'
              }`}
            >
              [TODOS: {movements.length}]
            </button>
            <button
              type="button"
              onClick={() => setFilter('ENTRADA')}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border-2 border-black transition-none cursor-pointer ${
                filter === 'ENTRADA'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-neutral-100'
              }`}
            >
              [ENTRADAS]
            </button>
            <button
              type="button"
              onClick={() => setFilter('SALIDA')}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border-2 border-black transition-none cursor-pointer ${
                filter === 'SALIDA'
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-neutral-100'
              }`}
            >
              [SALIDAS]
            </button>
          </div>
        </div>

        {loading ? (
          <div className="border-2 border-black p-8 text-center bg-white font-mono text-xs uppercase">
            [...] CARGANDO MOVIMIENTOS...
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div className="border-2 border-black p-8 text-center bg-white font-mono text-xs uppercase text-neutral-500">
            NO HAY MOVIMIENTOS PARA EL FILTRO SELECCIONADO.
          </div>
        ) : (
          <div className="border-2 border-black overflow-x-auto bg-white">
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead>
                <tr className="bg-black text-white border-b-2 border-black">
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    FECHA
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    TIPO
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    CATEGORÍA
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    DESCRIPCIÓN
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider text-right">
                    MONTO ($)
                  </th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center">
                    ACCIÓN
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {listaFiltrada.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-neutral-100 transition-none border-b border-black last:border-b-0"
                  >
                    <td className="p-3 border-r border-black tabular-nums whitespace-nowrap">
                      {new Date(m.movement_date).toLocaleDateString('es-CO')}
                    </td>
                    <td className="p-3 border-r border-black whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 border border-black text-[10px] font-bold tracking-wider ${
                          m.type === 'ENTRADA'
                            ? 'bg-white text-black'
                            : 'bg-black text-white'
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td className="p-3 border-r border-black whitespace-nowrap text-[11px]">
                      {m.category}
                    </td>
                    <td className="p-3 border-r border-black font-medium">
                      {m.description}
                    </td>
                    <td className="p-3 border-r border-black text-right tabular-nums font-bold whitespace-nowrap">
                      {m.type === 'ENTRADA' ? '+' : '-'} $
                      {Math.round(m.amount).toLocaleString('es-CO')}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        className="border border-black bg-white hover:bg-black hover:text-white transition-none px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                      >
                        [X] ELIMINAR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
