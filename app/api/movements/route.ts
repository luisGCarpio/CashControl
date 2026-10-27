import { NextResponse } from 'next/server';
import { createMovement, deleteMovement, getRecentMovements } from '@/app/modules/movements/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(500, Math.max(1, Number(limitParam) || 100)) : 100;

    const movements = await getRecentMovements(limit);
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
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido.' },
        { status: 400 }
      );
    }

    const { type, category, amount, description, product_id, quantity, is_unplanned, movement_date } = body;

    if (type !== 'ENTRADA' && type !== 'SALIDA') {
      return NextResponse.json(
        { error: 'El tipo de movimiento debe ser ENTRADA o SALIDA.' },
        { status: 400 }
      );
    }

    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json(
        { error: 'La categoría del movimiento es obligatoria.' },
        { status: 400 }
      );
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'El monto debe ser un número válido mayor a 0.' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json(
        { error: 'La descripción o detalle del movimiento es obligatoria.' },
        { status: 400 }
      );
    }

    const parsedQuantity = quantity !== undefined && quantity !== null ? Number(quantity) : 1;
    if (isNaN(parsedQuantity) || parsedQuantity < 1 || !Number.isInteger(parsedQuantity)) {
      return NextResponse.json(
        { error: 'La cantidad debe ser un número entero mayor o igual a 1.' },
        { status: 400 }
      );
    }

    const created = await createMovement({
      type,
      category: category.trim(),
      amount: parsedAmount,
      description: description.trim(),
      product_id: product_id ? Number(product_id) : null,
      quantity: parsedQuantity,
      is_unplanned: Boolean(is_unplanned),
      movement_date: movement_date || undefined,
    });

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
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const id = Number(idParam);

    if (!id || isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: 'ID de movimiento inválido para eliminación.' },
        { status: 400 }
      );
    }

    const result = await deleteMovement(id);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al eliminar el movimiento.' },
      { status: 400 }
    );
  }
}