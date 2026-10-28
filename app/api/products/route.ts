import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import {
  createProduct,
  deactivateProduct,
  updateProductStock,
  getProductsWithMetrics,
} from '@/app/modules/products/service';
import { ProductInputSchema, UpdateStockSchema, EntityIdSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const products = await getProductsWithMetrics(session.userId);
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al obtener productos.' },
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
    const validation = ProductInputSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Datos del producto inválidos' },
        { status: 422 }
      );
    }

    const product = await createProduct(session.userId, validation.data);
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al crear el producto.' },
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
        { error: validation.error.issues[0]?.message || 'ID de producto inválido para desactivación.' },
        { status: 400 }
      );
    }

    const res = await deactivateProduct(session.userId, validation.data.id);
    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al desactivar el producto.' },
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
    const validation = UpdateStockSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'ID de producto o nuevo stock inválido.' },
        { status: 400 }
      );
    }

    const updated = await updateProductStock(session.userId, validation.data.id, validation.data.stock);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el stock.' },
      { status: 400 }
    );
  }
}
