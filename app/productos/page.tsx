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
      setMsg('Error al cargar productos.');
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

      setMsg(`Producto "${name}" creado exitosamente.`);
      setName('');
      setUnitCost('');
      setExtraCost('0');
      setSalePrice('');
      setStock('0');
      loadProducts();
    } catch (err: any) {
      setMsg(err.message || 'Error al guardar.');
    }
  };

  const handleStockChange = async (id: number, currentStock: number) => {
    const input = prompt('Ingresa la nueva cantidad de stock:', String(currentStock));
    if (input === null) return;

    const newStock = Number(input);
    if (isNaN(newStock) || newStock < 0) {
      alert('Cantidad inválida.');
      return;
    }

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stock: newStock }),
      });

      if (!res.ok) throw new Error('Error al actualizar stock');
      setMsg('Stock actualizado.');
      loadProducts();
    } catch (err: any) {
      setMsg(err.message || 'Error al actualizar.');
    }
  };

  const handleDeactivate = async (id: number, prodName: string) => {
    if (!confirm(`¿Deseas retirar "${prodName}" del catálogo?`)) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al retirar producto');
      setMsg('Producto retirado.');
      loadProducts();
    } catch (err: any) {
      setMsg(err.message || 'Error al retirar.');
    }
  };

  const totalUnidades = products.reduce((acc, p) => acc + (p.stock || 0), 0);

  return (
    <main>
      <h1>Productos y Catálogo</h1>
      <p>Administra los artículos de tu negocio, sus costos, precios y existencias.</p>

      {msg && <p className="success">{msg}</p>}

      {/* Resumen básico */}
      <section>
        <p>
          <strong>Total Productos:</strong> {products.length} artículos |{' '}
          <strong>Unidades Físicas en Stock:</strong> {totalUnidades} uds
        </p>
      </section>

      {/* Formulario simple */}
      <form onSubmit={handleCreate}>
        <fieldset>
          <legend>Crear Nuevo Producto</legend>
          <p>
            <label>Nombre del Producto:</label>
            <br />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </p>

          <p>
            <label>Modelo:</label>
            <br />
            <select
              value={supplyModel}
              onChange={(e) => setSupplyModel(e.target.value as 'REVENTA' | 'PRODUCCION')}
            >
              <option value="REVENTA">Reventa (Comprar hecho para vender)</option>
              <option value="PRODUCCION">Producción (Insumos o elaboración)</option>
            </select>
          </p>

          <p>
            <label>Costo de Compra / Insumo ($):</label>
            <br />
            <input
              type="number"
              step="any"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              required
            />
          </p>

          <p>
            <label>Costo Extra (Empaque, flete) ($):</label>
            <br />
            <input
              type="number"
              step="any"
              min="0"
              value={extraCost}
              onChange={(e) => setExtraCost(e.target.value)}
            />
          </p>

          <p>
            <label>Precio de Venta al Público ($):</label>
            <br />
            <input
              type="number"
              step="any"
              min="0"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
            />
          </p>

          <p>
            <label>Stock Inicial (Unidades):</label>
            <br />
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
            />
          </p>

          <p>
            <button type="submit">Crear Producto</button>
          </p>
        </fieldset>
      </form>

      {/* Lista simple de productos */}
      <section>
        <h2>Catálogo Actual</h2>
        {loading ? (
          <p>Cargando productos...</p>
        ) : products.length === 0 ? (
          <p>No tienes productos registrados aún.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Modelo</th>
                <th>Costo Total</th>
                <th>Precio Venta</th>
                <th>Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const totalCost = Number(p.unit_cost) + Number(p.extra_cost);
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{p.supply_model}</td>
                    <td>${Math.round(totalCost).toLocaleString()}</td>
                    <td>${Math.round(p.sale_price).toLocaleString()}</td>
                    <td>{p.stock} unidades</td>
                    <td>
                      <button type="button" onClick={() => handleStockChange(p.id, p.stock)}>
                        Cambiar Stock
                      </button>{' '}
                      <button type="button" onClick={() => handleDeactivate(p.id, p.name)}>
                        Retirar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
