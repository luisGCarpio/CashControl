import { NextResponse } from 'next/server';
import { getCashVision, getBarChartStats, getRecentMovements } from '@/app/modules/movements/service';
import { getProductsWithMetrics } from '@/app/modules/products/service';
import { getActiveReminders } from '@/app/modules/reminders/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [vision, chartStats, movements, products, reminders] = await Promise.all([
      getCashVision(),
      getBarChartStats(),
      getRecentMovements(40),
      getProductsWithMetrics(),
      getActiveReminders(),
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
