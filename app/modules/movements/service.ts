import { query, withTransaction } from '@/bd/connection';

export interface CreateMovementDTO {
  type: 'ENTRADA' | 'SALIDA';
  category: string;
  amount: number;
  description: string;
  product_id?: number | null;
  quantity?: number;
  is_unplanned?: boolean;
  movement_date?: string;
}

export async function getCashVision() {
  const res = await query(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ENTRADA' THEN amount ELSE 0 END), 0)::FLOAT AS total_entradas,
      COALESCE(SUM(CASE WHEN type = 'SALIDA' THEN amount ELSE 0 END), 0)::FLOAT AS total_salidas,
      COALESCE(SUM(CASE WHEN type = 'ENTRADA' AND movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS entradas_mes,
      COALESCE(SUM(CASE WHEN type = 'SALIDA' AND movement_date >= date_trunc('month', CURRENT_DATE) THEN amount ELSE 0 END), 0)::FLOAT AS salidas_mes
    FROM movements
  `);

  const row = res.rows[0];
  return {
    total_entradas: row.total_entradas,
    total_salidas: row.total_salidas,
    disponible_actual: row.total_entradas - row.total_salidas,
    entradas_mes: row.entradas_mes,
    salidas_mes: row.salidas_mes,
  };
}

export async function getRecentMovements(limit = 50) {
  const res = await query(
    `
    SELECT 
      m.id, m.type, m.category, m.amount::FLOAT, m.description,
      m.product_id, m.quantity, m.is_unplanned, m.movement_date,
      p.name AS product_name
    FROM movements m
    LEFT JOIN products p ON m.product_id = p.id
    ORDER BY m.movement_date DESC, m.id DESC
    LIMIT $1
  `,
    [limit]
  );
  return res.rows;
}

export async function getBarChartStats() {
  // Genera series continuas de 6 meses y 6 semanas para evitar huecos en la gráfica
  const monthly = await query(`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
        date_trunc('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS m_date
    )
    SELECT
      TO_CHAR(m.m_date, 'YYYY-MM') AS periodo,
      TO_CHAR(m.m_date, 'Mon YYYY') AS etiqueta,
      COALESCE(SUM(CASE WHEN mov.type = 'ENTRADA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS entradas,
      COALESCE(SUM(CASE WHEN mov.type = 'SALIDA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS salidas
    FROM months m
    LEFT JOIN movements mov 
      ON date_trunc('month', mov.movement_date) = m.m_date
    GROUP BY m.m_date
    ORDER BY m.m_date ASC
  `);

  const weekly = await query(`
    WITH weeks AS (
      SELECT generate_series(
        date_trunc('week', CURRENT_DATE) - INTERVAL '5 weeks',
        date_trunc('week', CURRENT_DATE),
        INTERVAL '1 week'
      ) AS w_date
    )
    SELECT
      TO_CHAR(w.w_date, 'DD Mon') AS etiqueta,
      COALESCE(SUM(CASE WHEN mov.type = 'ENTRADA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS entradas,
      COALESCE(SUM(CASE WHEN mov.type = 'SALIDA' THEN mov.amount ELSE 0 END), 0)::FLOAT AS salidas
    FROM weeks w
    LEFT JOIN movements mov 
      ON date_trunc('week', mov.movement_date) = w.w_date
    GROUP BY w.w_date
    ORDER BY w.w_date ASC
  `);

  return {
    mensual: monthly.rows,
    semanal: weekly.rows,
  };
}

export async function createMovement(data: CreateMovementDTO) {
  const {
    type,
    category,
    amount,
    description,
    product_id = null,
    quantity = 1,
    is_unplanned = false,
    movement_date,
  } = data;

  return await withTransaction(async (client) => {
    // Si está asociado a un producto, verificar existencia y bloquear fila para evitar condiciones de carrera
    if (product_id) {
      const prodRes = await client.query(
        `SELECT id, name, stock, active FROM products WHERE id = $1 FOR UPDATE`,
        [product_id]
      );

      if (prodRes.rowCount === 0) {
        throw new Error(`El producto con ID ${product_id} no existe.`);
      }

      const product = prodRes.rows[0];

      // Verificación estricta de stock para ventas
      if (type === 'ENTRADA' && category === 'VENTA_PRODUCTO') {
        if (product.stock < quantity) {
          throw new Error(
            `Stock insuficiente: "${product.name}" solo tiene ${product.stock} unidad(es) disponible(s) e intentas registrar la venta de ${quantity}.`
          );
        }
        await client.query(`UPDATE products SET stock = stock - $1 WHERE id = $2`, [
          quantity,
          product_id,
        ]);
      } else if (
        type === 'SALIDA' &&
        (category === 'COMPRA_CATALOGO' || category === 'MATERIA_PRIMA')
      ) {
        // Incremento de stock por reabastecimiento o compra de mercancía
        await client.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [
          quantity,
          product_id,
        ]);
      }
    }

    const movRes = await client.query(
      `
      INSERT INTO movements (type, category, amount, description, product_id, quantity, is_unplanned, movement_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::TIMESTAMPTZ, CURRENT_TIMESTAMP))
      RETURNING *
    `,
      [
        type,
        category,
        amount,
        description,
        product_id || null,
        quantity,
        is_unplanned,
        movement_date || null,
      ]
    );

    return movRes.rows[0];
  });
}

export async function deleteMovement(movementId: number) {
  return await withTransaction(async (client) => {
    const movRes = await client.query(
      `SELECT * FROM movements WHERE id = $1 FOR UPDATE`,
      [movementId]
    );

    if (movRes.rowCount === 0) {
      throw new Error('Movimiento no encontrado.');
    }

    const mov = movRes.rows[0];

    // Revertir efecto en inventario si estaba vinculado a un producto
    if (mov.product_id) {
      const prodRes = await client.query(
        `SELECT id, stock FROM products WHERE id = $1 FOR UPDATE`,
        [mov.product_id]
      );

      if (prodRes.rowCount && prodRes.rowCount > 0) {
        if (mov.type === 'ENTRADA' && mov.category === 'VENTA_PRODUCTO') {
          // Devolver el stock vendido
          await client.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [
            mov.quantity,
            mov.product_id,
          ]);
        } else if (
          mov.type === 'SALIDA' &&
          (mov.category === 'COMPRA_CATALOGO' || mov.category === 'MATERIA_PRIMA')
        ) {
          // Retirar el stock ingresado por la compra
          await client.query(
            `UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2`,
            [mov.quantity, mov.product_id]
          );
        }
      }
    }

    await client.query(`DELETE FROM movements WHERE id = $1`, [movementId]);
    return { ok: true, deletedId: movementId };
  });
}