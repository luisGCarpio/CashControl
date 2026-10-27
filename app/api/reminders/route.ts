import { NextResponse } from 'next/server';
import {
  createReminder,
  markReminderAsPaid,
  deleteReminder,
} from '@/app/modules/reminders/service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido.' },
        { status: 400 }
      );
    }

    const { title, amount, category, frequency, due_date } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { error: 'El concepto o título del recordatorio es obligatorio.' },
        { status: 400 }
      );
    }

    const validFrequencies = ['UNICO', 'SEMANAL', 'QUINCENAL', 'MENSUAL'];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Frecuencia inválida (debe ser UNICO, SEMANAL, QUINCENAL o MENSUAL).' },
        { status: 400 }
      );
    }

    if (!due_date || isNaN(Date.parse(due_date))) {
      return NextResponse.json(
        { error: 'La fecha de vencimiento es inválida.' },
        { status: 400 }
      );
    }

    const parsedAmount = Number(amount) || 0;
    if (parsedAmount < 0) {
      return NextResponse.json(
        { error: 'El monto no puede ser un valor negativo.' },
        { status: 400 }
      );
    }

    const reminder = await createReminder({
      title: title.trim(),
      amount: parsedAmount,
      category: category ? category.trim() : 'SERVICIOS_ARRIENDO',
      frequency,
      due_date,
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al programar el recordatorio.' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido.' },
        { status: 400 }
      );
    }

    const { id, registerExpense } = body;
    const reminderId = Number(id);

    if (!reminderId || isNaN(reminderId) || reminderId <= 0) {
      return NextResponse.json(
        { error: 'ID de recordatorio inválido.' },
        { status: 400 }
      );
    }

    const res = await markReminderAsPaid(reminderId, Boolean(registerExpense));
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al marcar recordatorio como pagado.' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const id = Number(idParam);

    if (!id || isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: 'ID de recordatorio inválido para eliminación.' },
        { status: 400 }
      );
    }

    const res = await deleteReminder(id);
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al eliminar el recordatorio.' },
      { status: 400 }
    );
  }
}