import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import { getBusinessAlerts } from '@/app/modules/analytics/alerts';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const alertsData = await getBusinessAlerts(session.userId);
    return NextResponse.json(alertsData, { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error interno al consultar las alertas del negocio.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
