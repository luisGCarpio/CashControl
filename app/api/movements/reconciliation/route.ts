import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import { getCashReconciliation } from '@/app/modules/movements/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date') || undefined;

    const reconciliation = await getCashReconciliation(session.userId, dateParam);
    return NextResponse.json(reconciliation, { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error al obtener el arqueo de caja.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
