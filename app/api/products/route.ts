import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import {
  createProduct,
  deactivateProduct,
  updateProductStock,
  getProductsWithMetrics,
} from '@/app/modules/products/service';
import { ProductInputSchema } from '@/lib/schemas';

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
    const idParam = searchParams.get('id');
    const id = Number(idParam);

    if (!id || isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: 'ID de producto inválido para desactivación.' },
        { status: 400 }
      );
    }

    const res = await deactivateProduct(session.userId, id);
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido.' },
        { status: 400 }
      );
    }

    const { id, stock } = body;
    const prodId = Number(id);
    const newStock = Number(stock);

    if (!prodId || isNaN(prodId) || isNaN(newStock) || newStock < 0) {
      return NextResponse.json(
        { error: 'ID de producto o nuevo stock inválido.' },
        { status: 400 }
      );
    }

    const updated = await updateProductStock(session.userId, prodId, newStock);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el stock.' },
      { status: 400 }
    );
  }
}
