'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

export interface Movement {
  id: number;
  type: 'ENTRADA' | 'SALIDA';
  category: string;
  amount: number;
  description: string;
  product_id: number | null;
  product_name?: string | null;
  quantity?: number;
  is_unplanned?: boolean;
  movement_date: string;
}

export interface ProductOption {
  id: number;
  name: string;
  stock: number;
  sale_price: number;
  unit_cost: number;
}

const CATEGORIAS_ENTRADA = [
  { value: 'VENTA_PRODUCTO', label: 'Venta de Producto' },
  { value: 'APORTE_CAPITAL', label: 'Inyección / Aporte de Capital' },
  { value: 'OTRO_INGRESO', label: 'Otro Ingreso' },
];

const CATEGORIAS_SALIDA = [
  { value: 'COMPRA_CATALOGO', label: 'Compra Mercancía (Catálogo)' },
  { value: 'MATERIA_PRIMA', label: 'Materia Prima / Insumos' },
  { value: 'EMPAQUES_ENVIOS', label: 'Empaques / Envíos' },
  { value: 'SERVICIOS_ARRIENDO', label: 'Servicios / Arriendo' },
  { value: 'PUBLICIDAD', label: 'Publicidad / Redes' },
  { value: 'GASTO_NO_PLANEADO', label: 'Gasto No Planeado / Imprevisto' },
  { value: 'RETIRO_PERSONAL', label: 'Retiro Personal' },
];

export default function MovimientosPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtros
  const [filterType, setFilterType] = useState<'TODOS' | 'ENTRADA' | 'SALIDA'>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Formulario nuevo movimiento
  const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const [categoria, setCategoria] = useState<string>('VENTA_PRODUCTO');
  const [monto, setMonto] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [productoId, setProductoId] = useState<string>('');
  const [gastoNoPlaneado, setGastoNoPlaneado] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resMovs, resProds] = await Promise.all([
        fetch('/api/movements?limit=200'),
        fetch('/api/products'),
      ]);

      if (resMovs.ok) {
        const dataMovs = await resMovs.json();
        if (Array.isArray(dataMovs)) {
          setMovements(dataMovs);
        }
      }

      if (resProds.ok) {
        const dataProds = await resProds.json();
        if (Array.isArray(dataProds)) {
          setProducts(dataProds);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al cargar los datos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTipoChange = (newTipo: 'ENTRADA' | 'SALIDA') => {
    setTipo(newTipo);
    if (newTipo === 'ENTRADA') {
      setCategoria('VENTA_PRODUCTO');
      setGastoNoPlaneado(false);
    } else {
      setCategoria('COMPRA_CATALOGO');
    }
  };

  const handleCategoriaChange = (newCat: string) => {
    setCategoria(newCat);
    if (newCat === 'GASTO_NO_PLANEADO') {
      setGastoNoPlaneado(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(monto);
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: 'error', text: 'El monto debe ser un número mayor a cero.' });
      return;
    }

    if (!descripcion.trim()) {
      setMessage({ type: 'error', text: 'La descripción es obligatoria.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        type: tipo,
        category: categoria,
        amount: amountNum,
        description: descripcion.trim(),
        product_id: productoId ? parseInt(productoId, 10) : null,
        quantity: 1,
        is_unplanned: gastoNoPlaneado || categoria === 'GASTO_NO_PLANEADO',
      };

      const res = await fetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al guardar el movimiento.');
      }

      setMessage({ type: 'success', text: 'Movimiento registrado exitosamente.' });
      setMonto('');
      setDescripcion('');
      setProductoId('');
      setGastoNoPlaneado(false);
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al registrar movimiento.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`¿Estás seguro de eliminar el movimiento #${id}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/movements?id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al eliminar el movimiento.');
      }

      setMessage({ type: 'success', text: `Movimiento #${id} eliminado correctamente.` });
      await fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error al eliminar movimiento.' });
    }
  };

  // Totales
  const totalEntradas = useMemo(() => {
    return movements
      .filter((m) => m.type === 'ENTRADA')
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);
  }, [movements]);

  const totalSalidas = useMemo(() => {
    return movements
      .filter((m) => m.type === 'SALIDA')
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);
  }, [movements]);

  const balance = totalEntradas - totalSalidas;

  // Filtrado reactivo
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (filterType !== 'TODOS' && m.type !== filterType) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchDesc = (m.description || '').toLowerCase().includes(q);
      const matchCat = (m.category || '').toLowerCase().includes(q);
      const matchProd = (m.product_name || '').toLowerCase().includes(q);
      const matchMonto = String(Math.round(m.amount)).includes(q);

      return matchDesc || matchCat || matchProd || matchMonto;
    });
  }, [movements, filterType, searchQuery]);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <nav style={{ marginBottom: '16px' }}>
        <Link href="/">← Volver al Dashboard</Link> | <Link href="/productos">Ir a Productos</Link>
      </nav>

      <h1>Historial de Movimientos de Caja</h1>

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

      {/* Totales en texto */}
      <section style={{ border: '1px solid #334155', padding: '16px', borderRadius: '4px', marginBottom: '24px' }}>
        <p style={{ margin: '4px 0' }}>
          <strong>Total Entradas:</strong> ${Math.round(totalEntradas).toLocaleString('es-CO')}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Total Salidas:</strong> ${Math.round(totalSalidas).toLocaleString('es-CO')}
        </p>
        <p style={{ margin: '4px 0' }}>
          <strong>Balance:</strong> ${Math.round(balance).toLocaleString('es-CO')}
        </p>
      </section>

      {/* Formulario Registrar Movimiento */}
      <section style={{ border: '1px solid #334155', padding: '16px', borderRadius: '4px', marginBottom: '24px' }}>
        <h2>Registrar Movimiento</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', maxWidth: '600px' }}>
          <div>
            <label htmlFor="tipo" style={{ display: 'block', marginBottom: '4px' }}>
              Tipo de Movimiento:
            </label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => handleTipoChange(e.target.value as 'ENTRADA' | 'SALIDA')}
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            >
              <option value="ENTRADA">ENTRADA (Ingreso)</option>
              <option value="SALIDA">SALIDA (Gasto / Egreso)</option>
            </select>
          </div>

          <div>
            <label htmlFor="categoria" style={{ display: 'block', marginBottom: '4px' }}>
              Categoría:
            </label>
            <select
              id="categoria"
              value={categoria}
              onChange={(e) => handleCategoriaChange(e.target.value)}
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            >
              {(tipo === 'ENTRADA' ? CATEGORIAS_ENTRADA : CATEGORIAS_SALIDA).map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="monto" style={{ display: 'block', marginBottom: '4px' }}>
              Monto ($):
            </label>
            <input
              id="monto"
              type="number"
              step="any"
              min="0.01"
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Ej: 50000"
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <label htmlFor="descripcion" style={{ display: 'block', marginBottom: '4px' }}>
              Descripción:
            </label>
            <input
              id="descripcion"
              type="text"
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Venta al mostrador o pago de internet"
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            />
          </div>

          <div>
            <label htmlFor="producto" style={{ display: 'block', marginBottom: '4px' }}>
              Producto (Opcional):
            </label>
            <select
              id="producto"
              value={productoId}
              onChange={(e) => {
                const pId = e.target.value;
                setProductoId(pId);
                if (pId) {
                  const sel = products.find((p) => String(p.id) === pId);
                  if (sel) {
                    if (tipo === 'ENTRADA') {
                      if (!monto) setMonto(String(sel.sale_price));
                      if (!descripcion) setDescripcion(`Venta: ${sel.name}`);
                    } else {
                      if (!monto) setMonto(String(sel.unit_cost));
                      if (!descripcion) setDescripcion(`Compra: ${sel.name}`);
                    }
                  }
                }
              }}
              style={{ width: '100%', padding: '8px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
            >
              <option value="">-- Sin producto vinculado --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.stock})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={gastoNoPlaneado}
                onChange={(e) => setGastoNoPlaneado(e.target.checked)}
              />
              Gasto no planeado / imprevisto
            </label>
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
              {submitting ? 'Guardando...' : 'Guardar Movimiento'}
            </button>
          </div>
        </form>
      </section>

      {/* Filtros y Búsqueda */}
      <section style={{ marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <span>Filtrar por tipo:{' '}</span>
          <button
            type="button"
            onClick={() => setFilterType('TODOS')}
            style={{
              padding: '6px 12px',
              marginRight: '6px',
              fontWeight: filterType === 'TODOS' ? 'bold' : 'normal',
              background: filterType === 'TODOS' ? '#334155' : '#0f172a',
              color: '#fff',
              border: '1px solid #475569',
              cursor: 'pointer',
            }}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFilterType('ENTRADA')}
            style={{
              padding: '6px 12px',
              marginRight: '6px',
              fontWeight: filterType === 'ENTRADA' ? 'bold' : 'normal',
              background: filterType === 'ENTRADA' ? '#334155' : '#0f172a',
              color: '#fff',
              border: '1px solid #475569',
              cursor: 'pointer',
            }}
          >
            Entradas
          </button>
          <button
            type="button"
            onClick={() => setFilterType('SALIDA')}
            style={{
              padding: '6px 12px',
              fontWeight: filterType === 'SALIDA' ? 'bold' : 'normal',
              background: filterType === 'SALIDA' ? '#334155' : '#0f172a',
              color: '#fff',
              border: '1px solid #475569',
              cursor: 'pointer',
            }}
          >
            Salidas
          </button>
        </div>

        <div style={{ flex: '1', minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Buscar por descripción, categoría, producto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155',
            }}
          />
        </div>
      </section>

      {/* Tabla de Movimientos */}
      <section>
        {loading ? (
          <p>Cargando movimientos...</p>
        ) : filteredMovements.length === 0 ? (
          <p>No se encontraron movimientos registrados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid #334155' }}>
              <thead>
                <tr style={{ background: '#1e293b' }}>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>ID</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Fecha</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Tipo</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Categoría</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Descripción</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Producto</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Monto</th>
                  <th style={{ border: '1px solid #334155', padding: '8px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ border: '1px solid #334155', padding: '8px' }}>{m.id}</td>
                    <td style={{ border: '1px solid #334155', padding: '8px', whiteSpace: 'nowrap' }}>
                      {m.movement_date ? new Date(m.movement_date).toLocaleDateString('es-CO') : '-'}
                    </td>
                    <td style={{ border: '1px solid #334155', padding: '8px', fontWeight: 'bold' }}>
                      {m.type}
                    </td>
                    <td style={{ border: '1px solid #334155', padding: '8px' }}>{m.category}</td>
                    <td style={{ border: '1px solid #334155', padding: '8px' }}>
                      {m.description}
                      {m.is_unplanned && <span style={{ color: '#f87171', marginLeft: '6px' }}>(Imprevisto)</span>}
                    </td>
                    <td style={{ border: '1px solid #334155', padding: '8px' }}>
                      {m.product_name ? `${m.product_name} (x${m.quantity || 1})` : '-'}
                    </td>
                    <td style={{ border: '1px solid #334155', padding: '8px' }}>
                      ${Math.round(m.amount).toLocaleString('es-CO')}
                    </td>
                    <td style={{ border: '1px solid #334155', padding: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          borderRadius: '3px',
                        }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
