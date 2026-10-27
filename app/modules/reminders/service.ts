import { query, withTransaction } from '@/bd/connection';

export async function getActiveReminders() {
  const res = await query(`
    SELECT 
      id, title, amount::FLOAT, category, frequency, 
      TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
      is_completed,
      (due_date - CURRENT_DATE) AS days_remaining
    FROM reminders
    WHERE is_completed = FALSE
    ORDER BY due_date ASC
  `);
  return res.rows;
}

export async function createReminder(data: {
  title: string;
  amount: number;
  category: string;
  frequency: 'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';
  due_date: string;
}) {
  const title = (data.title || '').trim();
  if (!title) {
    throw new Error('El concepto o título del recordatorio es obligatorio.');
  }

  const validFrequencies = ['UNICO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'];
  if (!validFrequencies.includes(data.frequency)) {
    throw new Error('Frecuencia inválida (debe ser UNICO, SEMANAL, QUINCENAL o MENSUAL).');
  }

  const dueDate = data.due_date ? data.due_date.trim() : '';
  if (!dueDate || isNaN(Date.parse(dueDate))) {
    throw new Error('Fecha de vencimiento inválida.');
  }

  const amount = Number(data.amount) || 0;
  if (amount < 0) {
    throw new Error('El monto no puede ser negativo.');
  }

  const category = (data.category || 'SERVICIOS_ARRIENDO').trim();

  const res = await query(
    `
    INSERT INTO reminders (title, amount, category, frequency, due_date)
    VALUES ($1, $2, $3, $4, $5::DATE)
    RETURNING *
  `,
    [title, amount, category, data.frequency, dueDate]
  );
  return res.rows[0];
}

export async function markReminderAsPaid(reminderId: number, registerExpense: boolean) {
  return await withTransaction(async (client) => {
    const remRes = await client.query(
      `SELECT * FROM reminders WHERE id = $1 FOR UPDATE`,
      [reminderId]
    );

    if (remRes.rowCount === 0) {
      throw new Error('Recordatorio no encontrado.');
    }

    const rem = remRes.rows[0];

    // 1. Si el usuario confirma pago y el monto > 0, registrar automáticamente la salida en caja
    if (registerExpense && Number(rem.amount) > 0) {
      await client.query(
        `
        INSERT INTO movements (type, category, amount, description, is_unplanned, movement_date)
        VALUES ('SALIDA', $1, $2, $3, FALSE, CURRENT_TIMESTAMP)
      `,
        [
          rem.category || 'SERVICIOS_ARRIENDO',
          Number(rem.amount),
          `Pago de recordatorio: ${rem.title}`,
        ]
      );
    }

    // 2. Si es único se marca completado; si es recurrente se reprograma la próxima fecha
    if (rem.frequency === 'UNICO') {
      await client.query(`UPDATE reminders SET is_completed = TRUE WHERE id = $1`, [
        reminderId,
      ]);
    } else {
      let intervalSql = "INTERVAL '1 month'";
      if (rem.frequency === 'SEMANAL') intervalSql = "INTERVAL '7 days'";
      if (rem.frequency === 'QUINCENAL') intervalSql = "INTERVAL '15 days'";

      await client.query(
        `UPDATE reminders SET due_date = (due_date + ${intervalSql})::DATE WHERE id = $1`,
        [reminderId]
      );
    }

    return { ok: true, reminderId };
  });
}

export async function deleteReminder(reminderId: number) {
  const res = await query(`DELETE FROM reminders WHERE id = $1 RETURNING id`, [reminderId]);
  if (res.rowCount === 0) {
    throw new Error('Recordatorio no encontrado.');
  }
  return { ok: true, deletedId: reminderId };
}