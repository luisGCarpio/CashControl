'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatCurrency } from '@/lib/formatters';

export interface MovementAuditItem {
  id: number;
  time?: string;
  movement_date?: string;
  type: 'ENTRADA' | 'SALIDA';
  category: string;
  description: string;
  payment_method?: string;
  method?: string;
  amount: number;
}

export interface ReconciliationData {
  date?: string;
  entradas?: {
    total?: number;
    efectivo?: number;
    digital?: number;
  };
  total_entradas?: number;
  total_entradas_efectivo?: number;
  total_entradas_digital?: number;

  salidas?: {
    total?: number;
    efectivo?: number;
    digital?: number;
  };
  total_salidas?: number;
  total_salidas_efectivo?: number;
  total_salidas_digital?: number;

  saldoTeoricoEfectivo?: number;
  saldo_teorico_efectivo?: number;
  saldoDigital?: number;
  saldo_digital?: number;

  movements?: MovementAuditItem[];
}

export interface ArqueoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMovementCreated?: () => void;
}

const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ArqueoModal({
  isOpen,
  onClose,
  onMovementCreated,
}: ArqueoModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString);
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [cashCounted, setCashCounted] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  // Carga de datos de conciliación para la fecha seleccionada
  const fetchReconciliation = useCallback(async (date: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/movements/reconciliation?date=${encodeURIComponent(date)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status}: No se pudo obtener el arqueo.`);
      }
      const json: ReconciliationData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con el servidor.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Efecto al abrir o cambiar de fecha
  useEffect(() => {
    if (isOpen) {
      setError('');
      setCashCounted('');
      setCopied(false);
      fetchReconciliation(selectedDate);

      // Enfocar input de efectivo al abrir
      setTimeout(() => {
        if (cashInputRef.current) {
          cashInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, selectedDate, fetchReconciliation]);

  // Manejo de accesibilidad: Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Normalización y cálculo de métricas financieras
  const entradasEfectivo =
    data?.entradas?.efectivo ??
    data?.total_entradas_efectivo ??
    0;

  const entradasDigital =
    data?.entradas?.digital ??
    data?.total_entradas_digital ??
    0;

  const totalEntradas =
    data?.entradas?.total ??
    data?.total_entradas ??
    (entradasEfectivo + entradasDigital);

  const salidasEfectivo =
    data?.salidas?.efectivo ??
    data?.total_salidas_efectivo ??
    0;

  const salidasDigital =
    data?.salidas?.digital ??
    data?.total_salidas_digital ??
    0;

  const totalSalidas =
    data?.salidas?.total ??
    data?.total_salidas ??
    (salidasEfectivo + salidasDigital);

  const saldoTeoricoEfectivo =
    data?.saldoTeoricoEfectivo ??
    data?.saldo_teorico_efectivo ??
    (entradasEfectivo - salidasEfectivo);

  const saldoDigital =
    data?.saldoDigital ??
    data?.saldo_digital ??
    (entradasDigital - salidasDigital);

  const movements = data?.movements ?? [];

  // Comparación y cálculo de diferencia de arqueo en efectivo
  const hasEnteredCash = cashCounted.trim() !== '' && !isNaN(Number(cashCounted));
  const countedNum = hasEnteredCash ? Number(cashCounted) : 0;
  const difference = countedNum - saldoTeoricoEfectivo;

  // Extraer medio de pago del movimiento si viene en prefijo o campo
  const getPaymentMethod = (item: MovementAuditItem): string => {
    if (item.payment_method) return item.payment_method;
    if (item.method) return item.method;
    const match = item.description?.match(/^\[(.*?)\]/);
    if (match) return match[1];
    return 'EFECTIVO';
  };

  const getCleanDescription = (item: MovementAuditItem): string => {
    return item.description?.replace(/^\[.*?\]\s*/, '') || item.category || '-';
  };

  const getMovementTime = (item: MovementAuditItem): string => {
    if (item.time) return item.time;
    if (item.movement_date) {
      const d = new Date(item.movement_date);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
    }
    return '--:--';
  };

  // Generar y copiar reporte formateado
  const handleCopyReport = async () => {
    let resultadoCuadre = 'INGRESE EL EFECTIVO EN MANO PARA COMPARAR';
    if (hasEnteredCash) {
      if (difference === 0) {
        resultadoCuadre = '[OK] CUADRE EXACTO ($ 0 COP)';
      } else if (difference < 0) {
        const fmtDiff = Math.abs(Math.round(difference)).toLocaleString('es-CO');
        resultadoCuadre = `[!] FALTANTE EN CAJA (-$ ${fmtDiff} COP)`;
      } else {
        const fmtDiff = Math.round(difference).toLocaleString('es-CO');
        resultadoCuadre = `[+] SOBRANTE EN CAJA (+$ ${fmtDiff} COP)`;
      }
    }

    const lines = [
      '========================================',
      '   CASHCONTROL - ARQUEO DIARIO DE CAJA',
      `FECHA: ${selectedDate}`,
      '========================================',
      '',
      '1. RESUMEN DEL DÍA',
      `• Total Entradas:  ${formatCurrency(totalEntradas, true)}`,
      `  - Efectivo:      ${formatCurrency(entradasEfectivo, true)}`,
      `  - Digital:       ${formatCurrency(entradasDigital, true)}`,
      `• Total Salidas:   ${formatCurrency(totalSalidas, true)}`,
      `  - Efectivo:      ${formatCurrency(salidasEfectivo, true)}`,
      `  - Digital:       ${formatCurrency(salidasDigital, true)}`,
      `• Flujo Neto Día:  ${formatCurrency(totalEntradas - totalSalidas, true)}`,
      '',
      '2. CUADRE DE EFECTIVO EN CAJA',
      `• Saldo Teórico Esperado: ${formatCurrency(saldoTeoricoEfectivo, true)}`,
      `• Efectivo Físico Contado: ${hasEnteredCash ? formatCurrency(countedNum, true) : 'NO INGRESADO'}`,
      `• Resultado Cuadre:       ${resultadoCuadre}`,
      '',
      '3. CONCILIACIÓN DIGITAL (BANCOS / NEQUI)',
      `• Saldo Neto Digital:     ${formatCurrency(saldoDigital, true)}`,
      `• Entradas Digitales:     ${formatCurrency(entradasDigital, true)}`,
      `• Salidas Digitales:      ${formatCurrency(salidasDigital, true)}`,
      '',
      `4. TOTAL MOVIMIENTOS AUDITADOS: ${movements.length}`,
      '========================================',
      `Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
    ];

    const reportText = lines.join('\n');

    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar el reporte:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
      aria-hidden={!isOpen}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arqueo-modal-title"
        className="relative w-full max-w-3xl bg-white border border-black p-4 sm:p-6 my-auto shadow-none text-black max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header del Modal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-black gap-2">
          <div>
            <h2
              id="arqueo-modal-title"
              className="text-base sm:text-lg font-mono font-bold uppercase tracking-tight text-black m-0"
            >
              ARQUEO DE CAJA DIARIO
            </h2>
            <div className="text-[10px] font-mono uppercase text-black">
              CONCILIACIÓN DIARIA DE FLUJO FÍSICO Y DIGITAL
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              max={getTodayString()}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Seleccionar fecha para arqueo"
              className="h-9 w-auto px-2 py-1 font-mono text-xs border border-black bg-white text-black cursor-pointer"
            />
            <button
              type="button"
              onClick={() => fetchReconciliation(selectedDate)}
              title="Recargar datos de la fecha"
              aria-label="Recargar arqueo"
              className="h-9 border border-black bg-white text-black hover:bg-black hover:text-white px-3 text-xs font-mono font-bold uppercase transition-none cursor-pointer"
            >
              ↻
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="h-9 border border-black bg-white text-black hover:bg-black hover:text-white px-3 text-xs font-mono font-bold uppercase transition-none cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notificación de error */}
        {error && (
          <div
            role="alert"
            className="border border-black bg-black text-white p-3 mb-4 font-mono text-xs uppercase flex items-center justify-between"
          >
            <span className="font-bold">{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="ml-3 font-mono font-bold text-white hover:underline uppercase text-[10px] shrink-0"
            >
              CERRAR
            </button>
          </div>
        )}

        {/* Indicador de carga */}
        {loading && (
          <div className="border border-black bg-white text-black p-2.5 mb-4 font-mono text-xs uppercase text-center font-bold tracking-wider">
            CARGANDO DATOS DE ARQUEO...
          </div>
        )}

        {/* 2. Tira Métrica de Resumen */}
        <div className="border border-black bg-white flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-black font-mono text-xs mb-4">
          {/* Entradas */}
          <div className="flex-1 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-black mb-1">
              TOTAL ENTRADAS HOY
            </div>
            <div className="text-base font-bold tabular-nums text-black mb-1">
              {formatCurrency(totalEntradas, true)}
            </div>
            <div className="text-[10px] uppercase tabular-nums text-black">
              EFECTIVO: {formatCurrency(entradasEfectivo)} | DIGITAL: {formatCurrency(entradasDigital)}
            </div>
          </div>

          {/* Salidas */}
          <div className="flex-1 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-black mb-1">
              TOTAL SALIDAS HOY
            </div>
            <div className="text-base font-bold tabular-nums text-black mb-1">
              {formatCurrency(totalSalidas, true)}
            </div>
            <div className="text-[10px] uppercase tabular-nums text-black">
              EFECTIVO: {formatCurrency(salidasEfectivo)} | DIGITAL: {formatCurrency(salidasDigital)}
            </div>
          </div>

          {/* Balance Neto */}
          <div className="flex-1 p-3 bg-black text-white">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white mb-1">
              FLUJO NETO DEL DÍA
            </div>
            <div className="text-base font-bold tabular-nums text-white mb-1">
              {formatCurrency(totalEntradas - totalSalidas, true)}
            </div>
            <div className="text-[10px] uppercase tabular-nums text-white">
              {totalEntradas - totalSalidas >= 0 ? '[+] SUPERÁVIT' : '[-] DÉFICIT'}
            </div>
          </div>
        </div>

        {/* 3. Caja Hero de Cuadre */}
        <div className="border border-black bg-white p-4 mb-4">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-black mb-3 border-b border-black pb-2">
            CUADRE DE EFECTIVO EN MANO
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end mb-4">
            <div>
              <label
                htmlFor="cash-counted-input"
                className="block text-[11px] font-mono font-bold uppercase text-black mb-1"
              >
                SALDO TEÓRICO ESPERADO EN EFECTIVO
              </label>
              <div className="h-11 flex items-center px-3 border border-black bg-black text-white font-mono font-bold text-base sm:text-lg tabular-nums">
                {formatCurrency(saldoTeoricoEfectivo, true)}
              </div>
              <div className="text-[10px] font-mono text-black uppercase mt-1">
                ENTRADAS: {formatCurrency(entradasEfectivo)} − SALIDAS: {formatCurrency(salidasEfectivo)}
              </div>
            </div>

            <div>
              <label
                htmlFor="cash-counted-input"
                className="block text-[11px] font-mono font-bold uppercase text-black mb-1"
              >
                EFECTIVO FÍSICO CONTADO EN CAJA ($)
              </label>
              <input
                ref={cashInputRef}
                id="cash-counted-input"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={cashCounted}
                onChange={(e) => setCashCounted(e.target.value)}
                className="h-11 text-base sm:text-lg font-mono font-bold tabular-nums border border-black bg-white text-black px-3 py-2 w-full focus:outline-none"
              />
              <div className="text-[10px] font-mono text-black uppercase mt-1">
                MONTO REAL QUE TIENES FÍSICAMENTE EN CAJA
              </div>
            </div>
          </div>

          {/* Comparador y cálculo de diferencia en tiempo real */}
          <div>
            {!hasEnteredCash ? (
              <div className="border border-black bg-white text-black p-3 text-center font-mono font-bold text-xs uppercase tracking-wider">
                INGRESE EL EFECTIVO EN MANO PARA COMPARAR
              </div>
            ) : difference === 0 ? (
              <div className="border border-black bg-black text-white p-3 text-center font-mono font-bold text-sm uppercase tracking-wider">
                [OK] CUADRE EXACTO ($ 0 COP)
              </div>
            ) : difference < 0 ? (
              <div className="border-2 border-black bg-white text-black p-3 text-center font-mono font-bold text-sm uppercase tracking-wider">
                [!] FALTANTE EN CAJA (-$ {Math.abs(Math.round(difference)).toLocaleString('es-CO')} COP)
              </div>
            ) : (
              <div className="border-2 border-black bg-white text-black p-3 text-center font-mono font-bold text-sm uppercase tracking-wider">
                [+] SOBRANTE EN CAJA (+$ {Math.round(difference).toLocaleString('es-CO')} COP)
              </div>
            )}
          </div>
        </div>

        {/* 4. Sección de Dinero Digital / Bancos */}
        <div className="border border-black bg-white p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                DINERO DIGITAL / CONCILIACIÓN BANCARIA
              </div>
              <div className="text-[10px] font-mono text-black uppercase">
                VERIFICA ESTE SALDO EN TUS APPS (NEQUI, DAVIPLATA, BANCOS)
              </div>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-mono uppercase block text-black">
                SALDO DIGITAL RECIBIDO
              </span>
              <span className="text-base sm:text-lg font-mono font-bold tabular-nums text-black">
                {formatCurrency(saldoDigital, true)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            <div className="border border-black p-2.5 bg-white flex justify-between items-center">
              <span className="uppercase text-[11px] font-bold">ENTRADAS DIGITALES:</span>
              <span className="font-bold tabular-nums">{formatCurrency(entradasDigital, true)}</span>
            </div>
            <div className="border border-black p-2.5 bg-white flex justify-between items-center">
              <span className="uppercase text-[11px] font-bold">SALIDAS DIGITALES:</span>
              <span className="font-bold tabular-nums">{formatCurrency(salidasDigital, true)}</span>
            </div>
          </div>
        </div>

        {/* 5. Auditoría Rápida */}
        <div className="border border-black mb-4">
          <div className="bg-black text-white px-3 py-2 text-xs font-mono font-bold uppercase flex justify-between items-center">
            <span>AUDITORÍA RÁPIDA ({movements.length} MOVIMIENTO{movements.length === 1 ? '' : 'S'})</span>
            <span className="text-[10px]">DETALLE DEL DÍA</span>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {movements.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs uppercase text-black bg-white">
                NO SE REGISTRARON MOVIMIENTOS EN ESTA FECHA.
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs">
                <thead className="sticky top-0 bg-black text-white text-[10px] uppercase border-b border-white">
                  <tr>
                    <th className="py-2 px-3 border-r border-white w-[70px]">HORA</th>
                    <th className="py-2 px-3 border-r border-white w-[90px]">TIPO</th>
                    <th className="py-2 px-3 border-r border-white">CONCEPTO / DETALLE</th>
                    <th className="py-2 px-3 border-r border-white w-[130px]">MÉTODO</th>
                    <th className="py-2 px-3 text-right w-[110px]">MONTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black bg-white text-black">
                  {movements.map((mov, idx) => {
                    const isEntrada = mov.type === 'ENTRADA';
                    const method = getPaymentMethod(mov);
                    const time = getMovementTime(mov);
                    const cleanDesc = getCleanDescription(mov);

                    return (
                      <tr key={mov.id || idx} className="bg-white text-black">
                        <td className="py-1.5 px-3 border-r border-black tabular-nums text-[11px] whitespace-nowrap">
                          {time}
                        </td>
                        <td className="py-1.5 px-3 border-r border-black text-[11px] font-bold uppercase whitespace-nowrap">
                          {isEntrada ? '[+] ENTRADA' : '[-] SALIDA'}
                        </td>
                        <td
                          className="py-1.5 px-3 border-r border-black text-[11px] truncate max-w-[200px]"
                          title={mov.description}
                        >
                          {cleanDesc}
                        </td>
                        <td className="py-1.5 px-3 border-r border-black text-[10px] font-bold uppercase whitespace-nowrap">
                          {method}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-[11px] font-bold whitespace-nowrap">
                          {isEntrada ? `+ ${formatCurrency(mov.amount)}` : `- ${formatCurrency(mov.amount)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 6. Acciones del Pie */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-black">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 border border-black bg-white text-black hover:bg-black hover:text-white font-mono text-xs font-bold uppercase transition-none cursor-pointer"
          >
            CERRAR
          </button>
          <button
            type="button"
            onClick={handleCopyReport}
            className="h-9 px-4 border border-black bg-black text-white hover:bg-white hover:text-black font-mono text-xs font-bold uppercase transition-none cursor-pointer flex items-center justify-center gap-2"
          >
            {copied ? '✓ REPORTE COPIADO' : 'COPIAR REPORTE'}
          </button>
        </div>
      </div>
    </div>
  );
}
