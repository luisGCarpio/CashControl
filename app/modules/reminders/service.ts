import { query, withTransaction } from '@/bd/connection';
import { ReminderInput } from '@/lib/schemas';

export interface ReminderRow {
  id: number;
  user_id: number;
  title: string;
  amount: number;
  category: string;
  frequency: 'UNICO' | 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';
  due_date: string;
  is_completed: boolean;
  days_remaining: number;
}

export async function getActiveReminders(userId: number): Promise<ReminderRow[]> {
  const res = await query<ReminderRow>(
    `
    SELECT 
      id, user_id, title, amount::FLOAT, category, frequency, 
      TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
      is_completed,
      (due_date - CURRENT_DATE) AS days_remaining
    FROM reminders
    WHERE user_id = $1 AND is_completed = FALSE
    ORDER BY due_date ASC
  `,
    [userId]
  );
  return res.rows;
}

export async function createReminder(userId: number, data: ReminderInput) {
  const res = await query(
    `
    INSERT INTO reminders (user_id, title, amount, category, frequency, due_date)
    VALUES ($1, $2, $3, $4, $5, $6::DATE)
    RETURNING *
  `,
    [userId, data.title.trim(), data.amount, data.category, data.frequency, data.due_date]
  );
  return res.rows[0];
}

export async function markReminderAsPaid(userId: number, reminderId: number, registerExpense: boolean) {
  return await withTransaction(async (client) => {
    const remRes = await client.query(
      `SELECT * FROM reminders WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [reminderId, userId]
    );

    if (remRes.rowCount === 0) {
      throw new Error('Recordatorio no encontrado o no autorizado.');
    }

    const rem = remRes.rows[0];

    // Idempotencia: Si el recordatorio único ya fue completado, impedir pago duplicado
    if (rem.frequency === 'UNICO' && rem.is_completed) {
      throw new Error('El recordatorio ya ha sido completado y pagado previamente.');
    }

    // 1. Si el usuario confirma pago y el monto > 0, registrar automáticamente la salida en caja
    if (registerExpense && Number(rem.amount) > 0) {
      await client.query(
        `
        INSERT INTO movements (user_id, type, category, amount, description, is_unplanned, movement_date)
        VALUES ($1, 'SALIDA', $2, $3, $4, FALSE, CURRENT_TIMESTAMP)
      `,
        [
          userId,
          rem.category || 'SERVICIOS_ARRIENDO',
          Number(rem.amount),
          `Pago de obligación: ${rem.title}`,
        ]
      );
    }

    // 2. Si es único se marca completado; si es recurrente se reprograma la próxima fecha de forma atómica
    if (rem.frequency === 'UNICO') {
      await client.query(
        `UPDATE reminders SET is_completed = TRUE WHERE id = $1 AND user_id = $2`,
        [reminderId, userId]
      );
    } else {
      await client.query(
        `UPDATE reminders SET due_date = (due_date + CASE frequency WHEN 'SEMANAL' THEN INTERVAL '7 days' WHEN 'QUINCENAL' THEN INTERVAL '15 days' ELSE INTERVAL '1 month' END)::DATE, is_completed = FALSE WHERE id = $1 AND user_id = $2`,
        [reminderId, userId]
      );
    }

    const updated = await client.query(
      `SELECT *, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date FROM reminders WHERE id = $1 AND user_id = $2`,
      [reminderId, userId]
    );
    return updated.rows[0];
  });
}

export async function deleteReminder(userId: number, reminderId: number) {
  const res = await query(
    `DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id`,
    [reminderId, userId]
  );
  if (res.rowCount === 0) {
    throw new Error('Recordatorio no encontrado o no autorizado.');
  }
  return { ok: true, id: reminderId };
}
