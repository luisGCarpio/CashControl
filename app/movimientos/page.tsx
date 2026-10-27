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
      setMsg('Error al cargar datos.');
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
        throw new Error(err.error || 'Error al guardar');
      }

      setMsg('Movimiento guardado con éxito.');
      setAmount('');
      setDescription('');
      setProductId('');
      loadData();
    } catch (err: any) {
      setMsg(err.message || 'Error al guardar.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que deseas eliminar este movimiento?')) return;
    try {
      const res = await fetch(`/api/movements?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setMsg('Movimiento eliminado.');
      loadData();
    } catch (err: any) {
      setMsg(err.message || 'Error al eliminar.');
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
    <main>
      <h1>Movimientos de Caja</h1>
      <p>Registra entradas (ventas, ingresos) y salidas (compras, gastos).</p>

      {msg && <p className="success">{msg}</p>}

      {/* Resumen numérico básico */}
      <section>
        <p>
          <strong>Total Entradas:</strong> ${Math.round(entradasTotal).toLocaleString()} |{' '}
          <strong>Total Salidas:</strong> ${Math.round(salidasTotal).toLocaleString()} |{' '}
          <strong>Balance:</strong> ${Math.round(balance).toLocaleString()}
        </p>
      </section>

      {/* Formulario simple */}
      <form onSubmit={handleCreate}>
        <fieldset>
          <legend>Registrar Nuevo Movimiento</legend>
          <p>
            <label>Tipo:</label>
            <br />
            <select
              value={type}
              onChange={(e) => {
                const newType = e.target.value as 'ENTRADA' | 'SALIDA';
                setType(newType);
                setCategory(newType === 'ENTRADA' ? 'VENTA_PRODUCTO' : 'GASTO_GENERAL');
              }}
            >
              <option value="ENTRADA">Entrada (+ Dinero)</option>
              <option value="SALIDA">Salida (- Dinero)</option>
            </select>
          </p>

          <p>
            <label>Categoría:</label>
            <br />
            {type === 'ENTRADA' ? (
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="VENTA_PRODUCTO">Venta de Producto</option>
                <option value="APORTE_CAPITAL">Aporte de Capital</option>
                <option value="OTRO_INGRESO">Otro Ingreso</option>
              </select>
            ) : (
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="GASTO_GENERAL">Gasto General</option>
                <option value="COMPRA_CATALOGO">Compra de Mercancía</option>
                <option value="MATERIA_PRIMA">Materia Prima</option>
                <option value="SERVICIOS_ARRIENDO">Servicios o Arriendo</option>
                <option value="GASTO_NO_PLANEADO">Gasto Imprevisto</option>
                <option value="RETIRO_PERSONAL">Retiro Personal</option>
              </select>
            )}
          </p>

          {products.length > 0 && (
            <p>
              <label>Producto Relacionado (Opcional):</label>
              <br />
              <select value={productId} onChange={(e) => handleProductSelect(e.target.value)}>
                <option value="">-- Ninguno --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </p>
          )}

          <p>
            <label>Monto ($):</label>
            <br />
            <input
              type="number"
              step="any"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </p>

          <p>
            <label>Descripción / Concepto:</label>
            <br />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </p>

          <p>
            <button type="submit">Guardar Movimiento</button>
          </p>
        </fieldset>
      </form>

      {/* Filtro básico */}
      <section>
        <h2>Historial</h2>
        <p>
          Filtrar:{' '}
          <button type="button" onClick={() => setFilter('TODOS')}>
            Todos ({movements.length})
          </button>{' '}
          <button type="button" onClick={() => setFilter('ENTRADA')}>
            Solo Entradas
          </button>{' '}
          <button type="button" onClick={() => setFilter('SALIDA')}>
            Solo Salidas
          </button>
        </p>

        {loading ? (
          <p>Cargando movimientos...</p>
        ) : listaFiltrada.length === 0 ? (
          <p>No hay movimientos para mostrar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.movement_date).toLocaleDateString()}</td>
                  <td>{m.type}</td>
                  <td>{m.category}</td>
                  <td>{m.description}</td>
                  <td>
                    {m.type === 'ENTRADA' ? '+' : '-'}${Math.round(m.amount).toLocaleString()}
                  </td>
                  <td>
                    <button type="button" onClick={() => handleDelete(m.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
