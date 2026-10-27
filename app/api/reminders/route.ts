import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import {
  createReminder,
  markReminderAsPaid,
  deleteReminder,
} from '@/app/modules/reminders/service';
import { ReminderInputSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => null);
    const validation = ReminderInputSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Datos de recordatorio inválidos' },
        { status: 422 }
      );
    }

    const reminder = await createReminder(session.userId, validation.data);
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

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

    const res = await markReminderAsPaid(session.userId, reminderId, Boolean(registerExpense));
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al procesar el pago del recordatorio.' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const id = Number(idParam);

    if (!id || isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: 'ID de recordatorio inválido para eliminación.' },
        { status: 400 }
      );
    }

    const res = await deleteReminder(session.userId, id);
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al eliminar el recordatorio.' },
      { status: 400 }
    );
  }
}
