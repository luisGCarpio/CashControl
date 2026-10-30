import type {
  ExecutivePeriod,
  ExecutiveDashboardDTO,
  ExpenseCategoryBreakdown,
  UnplannedExpensesSummary,
  CashFlowPoint,
} from '@/app/modules/movements/service';
import type { ReminderRow } from '@/app/modules/reminders/service';

export type DashboardPeriod =
  | 'este-mes'
  | 'mes-anterior'
  | 'ultimos-30-dias'
  | 'este-ano'
  | ExecutivePeriod;

export interface DesgloseGastoItem {
  categoria: string;
  category: string;
  nombre: string;
  label: string;
  monto: number;
  amount: number;
  porcentaje: number;
  percentage: number;
}

export interface AlertaFugaNoPlaneados {
  hay_fuga: boolean;
  total_no_planeado: number;
  porcentaje_sobre_salidas: number;
  conteo: number;
}

export interface ObligacionesPendientesResumen {
  total_urgentes: number;
  vencidas_conteo: number;
  monto_total: number;
  items: ReminderRow[];
}

export interface DashboardResponseDTO extends ExecutiveDashboardDTO {
  disponible_hoy: number;
  rendimiento_neto: number;
  total_entradas_periodo: number;
  total_salidas_periodo: number;
  alerta_fuga_no_planeados: AlertaFugaNoPlaneados;
  obligaciones_pendientes: ObligacionesPendientesResumen;
  desglose_gastos: (ExpenseCategoryBreakdown & {
    categoria: string;
    nombre: string;
    monto: number;
    porcentaje: number;
  })[];
}

export { getExecutiveDashboardData } from '@/app/modules/movements/service';
export type {
  ExecutivePeriod,
  ExecutiveDashboardDTO,
  ExpenseCategoryBreakdown,
  UnplannedExpensesSummary,
  CashFlowPoint,
} from '@/app/modules/movements/service';
