import { NextResponse } from 'next/server';
import { createProduct, deactivateProduct, updateProductStock } from '@/app/modules/products/service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Cuerpo de solicitud inválido.' },
        { status: 400 }
      );
    }

    const { name, supply_model, unit_cost, extra_cost, sale_price, stock } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'El nombre del producto es obligatorio.' },
        { status: 400 }
      );
    }

    if (supply_model !== 'REVENTA' && supply_model !== 'PRODUCCION') {
      return NextResponse.json(
        { error: 'El modelo de suministro debe ser REVENTA o PRODUCCION.' },
        { status: 400 }
      );
    }

    const parsedUnitCost = Number(unit_cost) || 0;
    const parsedExtraCost = Number(extra_cost) || 0;
    const parsedSalePrice = Number(sale_price) || 0;
    const parsedStock = Math.max(0, Math.floor(Number(stock) || 0));

    if (parsedUnitCost < 0 || parsedExtraCost < 0 || parsedSalePrice < 0) {
      return NextResponse.json(
        { error: 'Los valores de costo y precio no pueden ser negativos.' },
        { status: 400 }
      );
    }

    const product = await createProduct({
      name: name.trim(),
      supply_model,
      unit_cost: parsedUnitCost,
      extra_cost: parsedExtraCost,
      sale_price: parsedSalePrice,
      stock: parsedStock,
    });

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
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const id = Number(idParam);

    if (!id || isNaN(id) || id <= 0) {
      return NextResponse.json(
        { error: 'ID de producto inválido para desactivación.' },
        { status: 400 }
      );
    }

    const res = await deactivateProduct(id);
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

    const updated = await updateProductStock(prodId, newStock);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al actualizar el stock.' },
      { status: 400 }
    );
  }
}