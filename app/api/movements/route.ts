import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import {
  createMovement,
  deleteMovement,
  getRecentMovements,
} from '@/app/modules/movements/service';
import { MovementInputSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(500, Math.max(1, Number(limitParam) || 100)) : 100;

    const movements = await getRecentMovements(session.userId, limit);
    return NextResponse.json(movements);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener los movimientos.' },
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
    const validation = MovementInputSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Datos del movimiento inválidos' },
        { status: 422 }
      );
    }

    const created = await createMovement(session.userId, validation.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al procesar el movimiento.' },
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
        { error: 'ID de movimiento inválido para eliminación.' },
        { status: 400 }
      );
    }

    const result = await deleteMovement(session.userId, id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al eliminar el movimiento.' },
      { status: 400 }
    );
  }
}
