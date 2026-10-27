import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import {
  createReminder,
  markReminderAsPaid,
  deleteReminder,
  getActiveReminders,
} from '@/app/modules/reminders/service';
import { ReminderInputSchema, MarkReminderPaidSchema, EntityIdSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

function sanitizeError(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message) {
    const msg = error.message;
    // Evitar filtrar detalles técnicos o internos de base de datos
    if (
      msg.includes('relation') ||
      msg.includes('syntax error') ||
      msg.includes('connect') ||
      msg.includes('password') ||
      msg.includes('pg_') ||
      msg.includes('ECONN')
    ) {
      return fallbackMessage;
    }
    return msg;
  }
  return fallbackMessage;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const reminders = await getActiveReminders(session.userId);
    return NextResponse.json(reminders);
  } catch (error: any) {
    console.error('Error al obtener recordatorios:', error);
    return NextResponse.json(
      { error: sanitizeError(error, 'Error al obtener recordatorios.') },
      { status: 500 }
    );
  }
}

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
    console.error('Error al programar el recordatorio:', error);
    return NextResponse.json(
      { error: sanitizeError(error, 'Error al programar el recordatorio.') },
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

    const rawBody = await req.json().catch(() => null);
    const validation = MarkReminderPaidSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Datos para marcar recordatorio inválidos.' },
        { status: 400 }
      );
    }

    const res = await markReminderAsPaid(session.userId, validation.data.id, validation.data.registerExpense);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error al procesar el pago del recordatorio:', error);
    return NextResponse.json(
      { error: sanitizeError(error, 'Error al procesar el pago del recordatorio.') },
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
    const validation = EntityIdSchema.safeParse({ id: searchParams.get('id') });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'ID de recordatorio inválido para eliminación.' },
        { status: 400 }
      );
    }

    const res = await deleteReminder(session.userId, validation.data.id);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error al eliminar el recordatorio:', error);
    return NextResponse.json(
      { error: sanitizeError(error, 'Error al eliminar el recordatorio.') },
      { status: 400 }
    );
  }
}
