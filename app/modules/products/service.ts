import { query, withTransaction } from '@/bd/connection';
import { ProductInput } from '@/lib/schemas';

export interface ProductMetricRow {
  id: number;
  user_id: number;
  name: string;
  supply_model: 'REVENTA' | 'PRODUCCION';
  unit_cost: number;
  extra_cost: number;
  total_unit_cost: number;
  sale_price: number;
  unit_profit: number;
  margin_percent: number;
  stock: number;
  active: boolean;
  units_sold: number;
  total_revenue: number;
  direct_investment: number;
}

export async function getProductsWithMetrics(userId: number): Promise<ProductMetricRow[]> {
  const res = await query<ProductMetricRow>(
    `
    SELECT 
      p.id,
      p.user_id,
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
    LEFT JOIN movements m ON p.id = m.product_id AND m.user_id = $1
    WHERE p.user_id = $1 AND p.active = TRUE
    GROUP BY p.id
    ORDER BY units_sold DESC, p.name ASC
  `,
    [userId]
  );
  return res.rows;
}

export async function createProduct(userId: number, data: ProductInput) {
  const res = await query(
    `
    INSERT INTO products (user_id, name, supply_model, unit_cost, extra_cost, sale_price, stock, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
    RETURNING *
  `,
    [
      userId,
      data.name.trim(),
      data.supply_model,
      data.unit_cost,
      data.extra_cost,
      data.sale_price,
      data.stock,
    ]
  );
  return res.rows[0];
}

export async function deactivateProduct(userId: number, productId: number) {
  const res = await query(
    `UPDATE products SET active = FALSE WHERE id = $1 AND user_id = $2 RETURNING id, name, active`,
    [productId, userId]
  );
  if (res.rowCount === 0) {
    throw new Error('Producto no encontrado o no autorizado.');
  }
  return { ok: true, product: res.rows[0] };
}

export async function updateProductStock(userId: number, productId: number, newStock: number) {
  if (!Number.isInteger(newStock) || newStock < 0) {
    throw new Error('El stock debe ser un número entero mayor o igual a cero.');
  }

  return await withTransaction(async (client) => {
    const checkRes = await client.query(
      `SELECT id, name, stock FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [productId, userId]
    );

    if (checkRes.rowCount === 0) {
      throw new Error('Producto no encontrado o no autorizado.');
    }

    const res = await client.query(
      `UPDATE products SET stock = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, stock`,
      [newStock, productId, userId]
    );

    return res.rows[0];
  });
}
