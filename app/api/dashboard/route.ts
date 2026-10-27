import { NextResponse } from 'next/server';
import { getSession } from '@/app/modules/auth/session';
import { getCashVision, getBarChartStats, getRecentMovements } from '@/app/modules/movements/service';
import { getProductsWithMetrics } from '@/app/modules/products/service';
import { getActiveReminders } from '@/app/modules/reminders/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { userId } = session;

    const [vision, chartStats, movements, products, reminders] = await Promise.all([
      getCashVision(userId),
      getBarChartStats(userId),
      getRecentMovements(userId, 40),
      getProductsWithMetrics(userId),
      getActiveReminders(userId),
    ]);

    return NextResponse.json({
      vision,
      chartStats,
      movements,
      products,
      reminders,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
