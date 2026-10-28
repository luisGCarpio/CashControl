import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import {
  createMovement,
  createMovementsBatch,
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
    if (!rawBody) {
      return NextResponse.json({ error: 'Payload inválido o vacío' }, { status: 400 });
    }

    const isBatch =
      Array.isArray(rawBody) ||
      (typeof rawBody === 'object' &&
        (Array.isArray(rawBody.items) || rawBody.is_free_sale === true || rawBody.isFreeSale === true));

    if (isBatch) {
      const items = Array.isArray(rawBody)
        ? rawBody
        : Array.isArray(rawBody.items)
        ? rawBody.items
        : [rawBody];

      if (!items || items.length === 0) {
        return NextResponse.json(
          { error: 'La lista de ítems no puede estar vacía' },
          { status: 422 }
        );
      }

      for (const item of items) {
        if (!item || typeof item !== 'object') {
          return NextResponse.json(
            { error: 'Cada ítem de la venta debe ser un objeto válido' },
            { status: 422 }
          );
        }
        const itemAmount = Number(item.amount);
        if (isNaN(itemAmount) || itemAmount <= 0) {
          return NextResponse.json(
            { error: 'El monto de cada ítem debe ser un valor mayor a cero' },
            { status: 422 }
          );
        }
      }

      const batchPayload = Array.isArray(rawBody) ? items : { ...rawBody, items };
      const createdMovements = await createMovementsBatch(session.userId, batchPayload);

      if (Array.isArray(rawBody)) {
        return NextResponse.json(createdMovements, { status: 201 });
      }

      if (rawBody.is_free_sale === true || rawBody.isFreeSale === true) {
        return NextResponse.json(createdMovements[0], { status: 201 });
      }

      return NextResponse.json(
        {
          ok: true,
          count: createdMovements.length,
          movements: createdMovements,
          items: createdMovements,
        },
        { status: 201 }
      );
    }

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
