import { NextResponse } from 'next/server';
import { getCashVision, getBarChartStats, getRecentMovements } from '@/app/modules/movements/service';
import { getProductsWithMetrics } from '@/app/modules/products/service';
import { getActiveReminders } from '@/app/modules/reminders/service';
import { generateSmartAlerts } from '@/app/modules/analytics/alerts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [vision, chartStats, movements, products, reminders, smartAnalysis] = await Promise.all([
      getCashVision(),
      getBarChartStats(),
      getRecentMovements(40),
      getProductsWithMetrics(),
      getActiveReminders(),
      generateSmartAlerts(),
    ]);

    return NextResponse.json({
      vision,
      chartStats,
      movements,
      products,
      reminders,
      alerts: smartAnalysis.alerts,
      productInsights: smartAnalysis.productInsights,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}