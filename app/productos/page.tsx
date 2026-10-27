'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

export interface Product {
  id: number;
  name: string;
  supply_model: 'REVENTA' | 'PRODUCCION';
  unit_cost: number;
  extra_cost: number;
  total_unit_cost?: number;
  sale_price: number;
  unit_profit?: number;
  margin_percent?: number;
  stock: number;
  active: boolean;
  units_sold?: number;
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulario nuevo producto
  const [name, setName] = useState<string>('');
  const [supplyModel, setSupplyModel] = useState<'REVENTA' | 'PRODUCCION'>('REVENTA');
  const [unitCost, setUnitCost] = useState<string>('');
  const [extraCost, setExtraCost] = useState<string>('0');
  const [salePrice, setSalePrice] = useState<string>('');
  const [stock, setStock] = useState<string>('0');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Edición rápida de stock por fila
  const [stockDrafts, setStockDrafts] = useState<Record<number, number>>({});
  const [updatingStockId, setUpdatingStockId] = useState<number | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data);
          const initialDrafts: Record<number, number> = {};
          data.forEach((p: Product) => {
            initialDrafts[p.id] = p.stock;
          });
          setStockDrafts(initialDrafts);
        }
      } else {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'Error al obtener productos.');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error de conexión.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'El nombre del producto es obligatorio.' });
      return;
    }

    const uCost = parseFloat(unitCost);
    const eCost = parseFloat(extraCost || '0');
    const sPrice = parseFloat(salePrice);
    const initialStock = parseInt(stock || '0', 10);

    if (isNaN(uCost) || uCost < 0) {
      setMessage({ type: 'error', text: 'El costo unitario no puede ser negativo.' });
      return;
    }

    if (isNaN(sPrice) || sPrice < 0) {
      setMessage({ type: 'error', text: 'El precio de venta no puede ser negativo.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        name: name.trim(),
        supply_model: supplyModel,
        unit_cost: uCost,
        extra_cost: isNaN(eCost) ? 0 : eCost,
        sale_price: sPrice,
        stock: isNaN(initialStock) ? 0 : Math.max(0, initialStock),
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al crear el producto.');
      }

      setMessage({ type: 'success', text: `Producto "${json.name}" creado con éxito.` });
      setName('');
      setSupplyModel('REVENTA');
      setUnitCost('');
      setExtraCost('0');
      setSalePrice('');
      setStock('0');
      await fetchProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al crear producto.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStock = async (id: number) => {
    const currentDraft = stockDrafts[id];
    if (currentDraft === undefined || isNaN(currentDraft) || currentDraft < 0) {
      setMessage({ type: 'error', text: 'El stock debe ser un número entero mayor o igual a 0.' });
      return;
    }

    setUpdatingStockId(id);
    setMessage(null);

    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          stock: Math.floor(currentDraft),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al actualizar el stock.');
      }

      setMessage({ type: 'success', text: `Stock del producto #${id} actualizado a ${currentDraft}.` });
      await fetchProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al actualizar stock.' });
    } finally {
      setUpdatingStockId(null);
    }
  };

  const handleDeactivate = async (id: number, prodName: string) => {
    if (!window.confirm(`¿Estás seguro de desactivar el producto "${prodName}"? Dejará de aparecer en el catálogo.`)) {
      return;
    }

    setMessage(null);
    try {
      const res = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al desactivar el producto.');
      }

      setMessage({ type: 'success', text: `Producto "${prodName}" desactivado con éxito.` });
      await fetchProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al desactivar producto.' });
    }
  };

  const totalProductos = products.length;
  const totalStock = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  }, [products]);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <nav style={{ marginBottom: '16px' }}>
        <Link href="/">← Volver al Dashboard</Link> | <Link href="/movimientos">Ir a Movimientos</Link>
      </nav>

      <h1>Control de Productos y Catálogo</h1>

      {message && (
        <p
          style={{
            padding: '10px',
            backgroundColor: message.type === 'success' ? '#064e3b' : '#7f1d1d',
            color: '#ffffff',
            borderRadius: '4px',
          }}
        >
          {message.text}
        </p>
      )}

      {/* Métricas en texto simple */}
      <section style={{ border: '1px solid #334155', padding: '16px', borderRadius: '4px', marginBottom: '24px' }}>
        <p style={{ margin: '4px 0' }}>
          <strong>Total productos:</strong> {totalProductos}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Unidades en stock:</strong> {totalStock}
        </p>
      </section>

      {/* Formulario Crear Producto */}
      <section style={{ border: '1px solid #334155', padding: '16px', borderRadius: '4px', marginBottom: '24px' }}>
        <h2>Crear Producto</h2>
        <form onSubmit={handleCreateProduct} style={{ display: 'grid', gap: '12px', maxWidth: '600px' }}>
          <div>
            <label htmlFor="nombre" style={{ display: 'block', marginBottom: '4px' }}>
              Nombre del Producto:
            </label>
            <input
              id="nombre"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Camiseta básica negra"
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <label htmlFor="modelo" style={{ display: 'block', marginBottom: '4px' }}>
              Modelo de Abastecimiento:
            </label>
            <select
              id="modelo"
              value={supplyModel}
              onChange={(e) => setSupplyModel(e.target.value as 'REVENTA' | 'PRODUCCION')}
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            >
              <option value="REVENTA">REVENTA (Compra mercancía ya terminada)</option>
              <option value="PRODUCCION">PRODUCCION (Fabricación con materia prima)</option>
            </select>
          </div>

          <div>
            <label htmlFor="costoUnitario" style={{ display: 'block', marginBottom: '4px' }}>
              Costo Unitario ($):
            </label>
            <input
              id="costoUnitario"
              type="number"
              step="any"
              min="0"
              required
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="Ej: 20000"
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <label htmlFor="costoExtra" style={{ display: 'block', marginBottom: '4px' }}>
              Costo Extra / Indirecto ($):
            </label>
            <input
              id="costoExtra"
              type="number"
              step="any"
              min="0"
              value={extraCost}
              onChange={(e) => setExtraCost(e.target.value)}
              placeholder="Ej: 2000 (empaque o flete)"
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <label htmlFor="precioVenta" style={{ display: 'block', marginBottom: '4px' }}>
              Precio de Venta ($):
            </label>
            <input
              id="precioVenta"
              type="number"
              step="any"
              min="0"
              required
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="Ej: 45000"
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <label htmlFor="stockInicial" style={{ display: 'block', marginBottom: '4px' }}>
              Stock Inicial:
            </label>
            <input
              id="stockInicial"
              type="number"
              step="1"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="Ej: 10"
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '4px',
              }}
            >
              {submitting ? 'Creando...' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </section>

      {/* Tabla de Productos */}
      <section>
        {loading ? (
          <p>Cargando productos...</p>
        ) : products.length === 0 ? (
          <p>No hay productos activos en el catálogo.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid #334155' }}>
              <thead>
                <tr style={{ background: '#1e293b' }}>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Nombre</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Modelo</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Costo</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Precio</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Ganancia</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Stock</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const cost = p.total_unit_cost ?? (Number(p.unit_cost) + Number(p.extra_cost || 0));
                  const profit = p.unit_profit ?? (Number(p.sale_price) - cost);
                  const margin = p.margin_percent ?? (p.sale_price > 0 ? Math.round((profit / p.sale_price) * 100) : 0);

                  return (
                    <tr key={p.id}>
                      <td style={{ border: '1px solid #334155', padding: '8px', fontWeight: 'bold' }}>
                        {p.name}
                      </td>
                      <td style={{ border: '1px solid #334155', padding: '8px' }}>{p.supply_model}</td>
                      <td style={{ border: '1px solid #334155', padding: '8px' }}>
                        ${Math.round(cost).toLocaleString('es-CO')}
                      </td>
                      <td style={{ border: '1px solid #334155', padding: '8px' }}>
                        ${Math.round(p.sale_price).toLocaleString('es-CO')}
                      </td>
                      <td style={{ border: '1px solid #334155', padding: '8px' }}>
                        ${Math.round(profit).toLocaleString('es-CO')} ({margin}%)
                      </td>
                      <td style={{ border: '1px solid #334155', padding: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={stockDrafts[p.id] ?? p.stock}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setStockDrafts((prev) => ({
                                ...prev,
                                [p.id]: isNaN(val) ? 0 : val,
                              }));
                            }}
                            style={{
                              width: '70px',
                              padding: '4px',
                              background: '#0f172a',
                              color: '#fff',
                              border: '1px solid #334155',
                            }}
                          />
                          <button
                            type="button"
                            disabled={updatingStockId === p.id}
                            onClick={() => handleUpdateStock(p.id)}
                            style={{
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              borderRadius: '3px',
                              fontSize: '12px',
                            }}
                          >
                            {updatingStockId === p.id ? '...' : 'Actualizar'}
                          </button>
                        </div>
                      </td>
                      <td style={{ border: '1px solid #334155', padding: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(p.id, p.name)}
                          style={{
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            borderRadius: '3px',
                            fontSize: '12px',
                          }}
                        >
                          Desactivar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
