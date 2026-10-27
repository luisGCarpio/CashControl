import { query } from '@/bd/connection';

export async function getProductsWithMetrics() {
  const res = await query(`
    SELECT 
      p.id,
      p.name,
      p.supply_model,
      p.unit_cost::FLOAT,
      p.extra_cost::FLOAT,
      (p.unit_cost + p.extra_cost)::FLOAT AS total_unit_cost,
      p.sale_price::FLOAT,
      (p.sale_price - (p.unit_cost + p.extra_cost))::FLOAT AS unit_profit,
      CASE 
        WHEN p.sale_price > 0 THEN ROUND(((p.sale_price - (p.unit_cost + p.extra_cost)) / p.sale_price) * 100, 1)::FLOAT
        ELSE 0 
      END AS margin_percent,
      p.stock,
      p.active,
      COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' AND m.category = 'VENTA_PRODUCTO' THEN m.quantity ELSE 0 END), 0)::INT AS units_sold,
      COALESCE(SUM(CASE WHEN m.type = 'ENTRADA' AND m.category = 'VENTA_PRODUCTO' THEN m.amount ELSE 0 END), 0)::FLOAT AS total_revenue,
      COALESCE(SUM(CASE WHEN m.type = 'SALIDA' THEN m.amount ELSE 0 END), 0)::FLOAT AS direct_investment
    FROM products p
    LEFT JOIN movements m ON p.id = m.product_id
    WHERE p.active = TRUE
    GROUP BY p.id
    ORDER BY units_sold DESC, p.name ASC
  `);
  return res.rows;
}

export async function createProduct(data: {
  name: string;
  supply_model: 'REVENTA' | 'PRODUCCION';
  unit_cost: number;
  extra_cost: number;
  sale_price: number;
  stock: number;
}) {
  const name = (data.name || '').trim();
  if (!name) {
    throw new Error('El nombre del producto es obligatorio.');
  }

  if (data.supply_model !== 'REVENTA' && data.supply_model !== 'PRODUCCION') {
    throw new Error('El modelo de suministro debe ser REVENTA o PRODUCCION.');
  }

  const unitCost = Number(data.unit_cost) || 0;
  const extraCost = Number(data.extra_cost) || 0;
  const salePrice = Number(data.sale_price) || 0;
  const stock = Math.max(0, Math.floor(Number(data.stock) || 0));

  if (unitCost < 0 || extraCost < 0 || salePrice < 0) {
    throw new Error('Los valores de costo y precio de venta no pueden ser negativos.');
  }

  const res = await query(
    `
    INSERT INTO products (name, supply_model, unit_cost, extra_cost, sale_price, stock, active)
    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
    RETURNING *
  `,
    [name, data.supply_model, unitCost, extraCost, salePrice, stock]
  );
  return res.rows[0];
}

export async function deactivateProduct(productId: number) {
  const res = await query(
    `UPDATE products SET active = FALSE WHERE id = $1 RETURNING id, name, active`,
    [productId]
  );
  if (res.rowCount === 0) {
    throw new Error('Producto no encontrado.');
  }
  return { ok: true, product: res.rows[0] };
}

export async function updateProductStock(productId: number, newStock: number) {
  if (newStock < 0) {
    throw new Error('El stock no puede ser negativo.');
  }
  const res = await query(
    `UPDATE products SET stock = $1 WHERE id = $2 RETURNING id, name, stock`,
    [newStock, productId]
  );
  if (res.rowCount === 0) {
    throw new Error('Producto no encontrado.');
  }
  return res.rows[0];
}