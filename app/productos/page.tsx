'use client';

import { useEffect, useState } from 'react';

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

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Formulario
  const [name, setName] = useState('');
  const [supplyModel, setSupplyModel] = useState<'REVENTA' | 'PRODUCCION'>('REVENTA');
  const [unitCost, setUnitCost] = useState('');
  const [extraCost, setExtraCost] = useState('0');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('0');

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          supply_model: supplyModel,
          unit_cost: Number(unitCost),
          extra_cost: Number(extraCost),
          sale_price: Number(salePrice),
          stock: Number(stock),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al crear producto');
      }

      setMsg(`Producto "${name.toUpperCase()}" dado de alta con éxito.`);
      setName('');
      setUnitCost('');
      setExtraCost('0');
      setSalePrice('');
      setStock('0');
      loadProducts();
    } catch (err: any) {
      setMsg(err.message || 'Error al guardar producto.');
    }
  };

  const handleStockChange = async (id: number, currentStock: number) => {
    const input = prompt('Ingresa la nueva cantidad exacta de stock:', String(currentStock));
    if (input === null) return;

    const newStock = Number(input);
    if (isNaN(newStock) || newStock < 0) {
      alert('Cantidad inválida. Ingrese un valor numérico positivo.');
      return;
    }

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stock: newStock }),
      });

      if (!res.ok) throw new Error('Error al actualizar el inventario.');
      setMsg('Nivel de stock actualizado correctamente.');
      loadProducts();
    } catch (err: any) {
      setMsg(err.message || 'Error al actualizar inventario.');
    }
  };

  const handleDeactivate = async (id: number, prodName: string) => {
    if (!confirm(`¿Confirma el retiro del artículo "${prodName}" del catálogo activo?`)) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al retirar producto del catálogo.');
      setMsg(`Artículo "${prodName}" retirado exitosamente.`);
      loadProducts();
    } catch (err: any) {
      setMsg(err.message || 'Error al retirar artículo.');
    }
  };

  const totalUnidades = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const valorInventario = products.reduce(
    (acc, p) => acc + (Number(p.unit_cost) + Number(p.extra_cost)) * Number(p.stock || 0),
    0
  );

  return (
    <main className="space-y-8 py-4">
      {/* Encabezado */}
      <header className="border-b-2 border-black pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
              GESTIÓN DE INVENTARIO Y REFERENCIAS
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-black uppercase">
              CATÁLOGO // CONTROL DE PRODUCTOS Y STOCK
            </h1>
          </div>
          <div className="text-[11px] font-mono text-neutral-600 uppercase tracking-wider">
            TOTAL REFERENCIAS: {products.length}
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

      {/* Métricas en cajas rectangulares superiores */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              MÉTRICA // REFERENCIAS
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              {products.length} ARTÍCULOS
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              PRODUCTOS ACTIVOS EN CATÁLOGO
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              MÉTRICA // EXISTENCIAS FÍSICAS
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              {totalUnidades} UNIDADES
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              STOCK TOTAL EN BODEGA
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-600 mb-1">
              MÉTRICA // CAPITAL EN INVENTARIO
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold tracking-tight text-black tabular-nums">
              $ {Math.round(valorInventario).toLocaleString('es-CO')}
            </div>
            <div className="text-[10px] font-mono text-neutral-500 uppercase mt-1">
              VALORIZACIÓN A COSTO BASE
            </div>
          </div>
        </div>
      </section>

      {/* Formulario de alta de productos con marco negro nítido */}
      <section className="border-2 border-black bg-white p-6">
        <div className="border-b border-black pb-3 mb-5">
          <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
            CREACIÓN DE REFERENCIA
          </div>
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-black">
            FORMULARIO DE ALTA // NUEVO ARTÍCULO O INSUMO
          </h2>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                NOMBRE DEL PRODUCTO / REFERENCIA:
              </label>
              <input
                type="text"
                placeholder="EJ. CAMISA DE LINO, CAFÉ ESPECIAL..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                MODELO OPERATIVO:
              </label>
              <select
                value={supplyModel}
                onChange={(e) => setSupplyModel(e.target.value as 'REVENTA' | 'PRODUCCION')}
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
              >
                <option value="REVENTA">REVENTA (COMPRA TERMINADO PARA DISTRIBUCIÓN)</option>
                <option value="PRODUCCION">PRODUCCIÓN (ELABORACIÓN CON INSUMOS)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                COSTO BASE ($):
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                required
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                COSTOS EXTRA ($):
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={extraCost}
                onChange={(e) => setExtraCost(e.target.value)}
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                PRECIO DE VENTA ($):
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                required
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold tracking-wider uppercase mb-1 text-black">
                STOCK INICIAL:
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
                className="w-full border-2 border-black bg-white px-3 py-2 text-xs font-mono rounded-none focus:outline-none focus:bg-neutral-50"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full border-2 border-black bg-black text-white hover:bg-white hover:text-black transition-none py-3 px-4 text-xs font-mono font-bold uppercase tracking-wider rounded-none cursor-pointer"
            >
              [+] CREAR PRODUCTO
            </button>
          </div>
        </form>
      </section>

      {/* Tabla geométrica de productos con columnas claras y botones de acción rectangulares */}
      <section className="space-y-4">
        <div className="border-b border-black pb-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-neutral-600 uppercase mb-1">
              LISTADO DISPONIBLE
            </div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-black">
              CATÁLOGO ACTUAL // INVENTARIO EN VIGENCIA
            </h2>
          </div>
          <span className="text-[11px] font-mono text-neutral-600 uppercase">
            REGISTROS: {products.length}
          </span>
        </div>

        {loading ? (
          <div className="border-2 border-black p-8 text-center bg-white font-mono text-xs uppercase">
            [...] CARGANDO PRODUCTOS...
          </div>
        ) : products.length === 0 ? (
          <div className="border-2 border-black p-8 text-center bg-white font-mono text-xs uppercase text-neutral-500">
            NO EXISTEN PRODUCTOS EN EL CATÁLOGO ACTUALMENTE.
          </div>
        ) : (
          <div className="border-2 border-black overflow-x-auto bg-white">
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead>
                <tr className="bg-black text-white border-b-2 border-black">
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    ARTÍCULO
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider">
                    MODELO
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider text-right">
                    COSTO TOTAL
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider text-right">
                    PRECIO VENTA
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider text-right">
                    MARGEN EST.
                  </th>
                  <th className="p-3 border-r border-black font-bold uppercase tracking-wider text-center">
                    STOCK
                  </th>
                  <th className="p-3 font-bold uppercase tracking-wider text-center">
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {products.map((p) => {
                  const totalCost = Number(p.unit_cost) + Number(p.extra_cost);
                  const margin = Number(p.sale_price) - totalCost;
                  const marginPct =
                    Number(p.sale_price) > 0
                      ? Math.round((margin / Number(p.sale_price)) * 100)
                      : 0;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-neutral-100 transition-none border-b border-black last:border-b-0"
                    >
                      <td className="p-3 border-r border-black font-bold uppercase">
                        {p.name}
                      </td>
                      <td className="p-3 border-r border-black text-[11px] whitespace-nowrap">
                        <span className="inline-block px-1.5 py-0.5 border border-black bg-white text-black text-[10px]">
                          {p.supply_model}
                        </span>
                      </td>
                      <td className="p-3 border-r border-black text-right tabular-nums whitespace-nowrap">
                        $ {Math.round(totalCost).toLocaleString('es-CO')}
                      </td>
                      <td className="p-3 border-r border-black text-right tabular-nums font-bold whitespace-nowrap">
                        $ {Math.round(p.sale_price).toLocaleString('es-CO')}
                      </td>
                      <td className="p-3 border-r border-black text-right tabular-nums whitespace-nowrap text-[11px]">
                        $ {Math.round(margin).toLocaleString('es-CO')} ({marginPct}%)
                      </td>
                      <td className="p-3 border-r border-black text-center tabular-nums whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 border border-black font-bold text-xs ${
                            p.stock <= 2 ? 'bg-black text-white' : 'bg-white text-black'
                          }`}
                        >
                          {p.stock} UDS
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStockChange(p.id, p.stock)}
                            className="border border-black bg-white hover:bg-black hover:text-white transition-none px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                          >
                            [STOCK]
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(p.id, p.name)}
                            className="border border-black bg-white hover:bg-black hover:text-white transition-none px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                          >
                            [RETIRAR]
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
    </main>
  );
}
