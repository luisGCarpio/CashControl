import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import {
  getExecutiveDashboardData,
  ExecutivePeriod,
  ExecutiveDashboardDTO,
} from '@/app/modules/movements/service';

export const dynamic = 'force-dynamic';

const VALID_PERIODS: readonly ExecutivePeriod[] = [
  'ESTE_MES',
  'MES_ANTERIOR',
  'ULTIMOS_30_DIAS',
  'ESTE_ANO',
] as const;

export async function GET(
  request: NextRequest
): Promise<NextResponse<ExecutiveDashboardDTO | { error: string }>> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawPeriod = (searchParams.get('period') || searchParams.get('periodo') || '')
      .toUpperCase()
      .replace(/-/g, '_');

    let period: ExecutivePeriod = 'ESTE_MES';
    if (rawPeriod && VALID_PERIODS.includes(rawPeriod as ExecutivePeriod)) {
      period = rawPeriod as ExecutivePeriod;
    }

    const data: ExecutiveDashboardDTO = await getExecutiveDashboardData(session.userId, period);

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno al consultar dashboard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
