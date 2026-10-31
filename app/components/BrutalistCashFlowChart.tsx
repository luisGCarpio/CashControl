'use client';

import React, { useState, useRef } from 'react';
import { formatCurrency } from '@/lib/formatters';

export interface ChartDataPoint {
  fecha: string;
  etiqueta: string;
  entradas: number;
  salidas: number;
  neto: number;
}

export interface BrutalistCashFlowChartProps {
  data: ChartDataPoint[];
  height?: number;
}

function formatYAxis(value: number): string {
  if (value === 0) return '$ 0';
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `$ ${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$ ${(value / 1_000).toFixed(0)}K`;
  }
  return `$ ${Math.round(value)}`;
}

function getNiceMax(val: number): number {
  if (val <= 0) return 10000;
  const exp = Math.floor(Math.log10(val));
  const base = Math.pow(10, exp);
  const fraction = val / base;
  let niceFraction = 10;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * base;
}

export default function BrutalistCashFlowChart({
  data,
  height = 280,
}: BrutalistCashFlowChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Verificación estricta de datos vacíos o sin movimientos reales
  const hasNoData =
    !data ||
    data.length === 0 ||
    data.every((d) => (d.entradas || 0) === 0 && (d.salidas || 0) === 0);

  if (hasNoData) {
    return (
      <div className="border border-black bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-black">
          <div className="flex items-center gap-6 font-mono text-xs font-bold uppercase text-black">
            <span className="flex items-center gap-2">
              <span className="inline-block w-3.5 h-3.5 bg-black border border-black" />
              <span>[■] ENTRADAS (INGRESOS)</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3.5 h-3.5 bg-white border border-black" />
              <span>[□] SALIDAS (EGRESOS)</span>
            </span>
          </div>
          <span className="font-mono text-[10px] text-black uppercase font-bold tracking-widest">
            HISTÓRICO 0 PUNTOS
          </span>
        </div>
        <div className="p-12 text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-black">
            NO HAY MOVIMIENTOS EN EL PERÍODO SELECCIONADO
          </p>
        </div>
      </div>
    );
  }

  // Dimensiones del gráfico SVG
  const paddingLeft = 75;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 42;

  // Calculamos ancho responsivo para permitir scroll si hay muchos días
  const minGroupWidth = data.length > 20 ? 32 : 44;
  const svgWidth = Math.max(760, paddingLeft + paddingRight + data.length * minGroupWidth);
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = Math.max(160, height - paddingTop - paddingBottom);

  // Escala Y
  const maxAmount = Math.max(
    ...data.map((d) => Math.max(Number(d.entradas) || 0, Number(d.salidas) || 0)),
    100
  );
  const niceMax = getNiceMax(maxAmount * 1.05);

  const ticksCount = 4;
  const ticks = Array.from({ length: ticksCount + 1 }, (_, i) => (niceMax / ticksCount) * i);

  const groupSlot = plotWidth / data.length;
  const barWidth = Math.min(22, Math.max(6, Math.floor((groupSlot - 8) / 2)));
  const barGap = 2;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>, index: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoveredIndex(index);
    setTooltipPos({ x, y });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltipPos(null);
  };

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  // Filtro de etiquetas para evitar superposición en períodos largos (>16 puntos)
  const labelStep = data.length > 20 ? Math.ceil(data.length / 12) : data.length > 14 ? 2 : 1;

  return (
    <div
      ref={containerRef}
      className="relative border border-black bg-white select-none"
      role="region"
      aria-label="Gráfica de Flujo de Caja Monetario Brutalista"
    >
      {/* Cabecera y Leyenda Brutalista */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-black">
        <div className="flex items-center gap-6 font-mono text-xs font-bold uppercase text-black">
          <span className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 bg-black border border-black" />
            <span>[■] ENTRADAS (INGRESOS)</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-3.5 h-3.5 bg-white border border-black" />
            <span>[□] SALIDAS (EGRESOS)</span>
          </span>
        </div>
        <span className="font-mono text-[10px] text-black uppercase font-bold tracking-widest">
          {data.length} REGISTROS
        </span>
      </div>

      {/* Contenedor desplazable horizontalmente si sobrepasa el viewport */}
      <div className="w-full overflow-x-auto overflow-y-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="w-full h-auto block min-w-[640px]"
          style={{ maxHeight: height }}
          aria-hidden="true"
        >
          {/* Líneas horizontales de referencia del Eje Y */}
          {ticks.map((tickVal, i) => {
            const y = paddingTop + plotHeight - (tickVal / niceMax) * plotHeight;
            const isZero = i === 0;
            return (
              <g key={`tick-${i}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="black"
                  strokeWidth={isZero ? 1.5 : 1}
                  strokeDasharray={isZero ? undefined : '3 3'}
                  strokeOpacity={isZero ? 1 : 0.25}
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="font-mono text-[10px] font-bold fill-black tabular-nums select-none"
                >
                  {formatYAxis(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Columnas y barras emparejadas */}
          {data.map((point, index) => {
            const groupCenterX = paddingLeft + index * groupSlot + groupSlot / 2;

            const entradasAmount = Number(point.entradas) || 0;
            const salidasAmount = Number(point.salidas) || 0;

            const heightEntradas = (entradasAmount / niceMax) * plotHeight;
            const heightSalidas = (salidasAmount / niceMax) * plotHeight;

            const yEntradas = paddingTop + plotHeight - heightEntradas;
            const ySalidas = paddingTop + plotHeight - heightSalidas;

            const xEntradas = groupCenterX - barWidth - barGap / 2;
            const xSalidas = groupCenterX + barGap / 2;

            const isHovered = hoveredIndex === index;
            const shouldShowLabel =
              index % labelStep === 0 || index === data.length - 1;

            return (
              <g key={`data-group-${point.fecha || index}`}>
                {/* Zona de resalto en hover */}
                {isHovered && (
                  <rect
                    x={paddingLeft + index * groupSlot}
                    y={paddingTop}
                    width={groupSlot}
                    height={plotHeight}
                    fill="black"
                    opacity={0.06}
                  />
                )}

                {/* Barra de Entradas: Rectángulo negro sólido */}
                {heightEntradas > 0 && (
                  <rect
                    x={xEntradas}
                    y={yEntradas}
                    width={barWidth}
                    height={Math.max(1, heightEntradas)}
                    fill="black"
                  />
                )}

                {/* Barra de Salidas: Rectángulo blanco con contorno negro nítido */}
                {heightSalidas > 0 && (
                  <rect
                    x={xSalidas}
                    y={ySalidas}
                    width={barWidth}
                    height={Math.max(1, heightSalidas)}
                    fill="white"
                    stroke="black"
                    strokeWidth="1.5"
                  />
                )}

                {/* Etiqueta del Eje X */}
                {shouldShowLabel && (
                  <text
                    x={groupCenterX}
                    y={paddingTop + plotHeight + 18}
                    textAnchor="middle"
                    className="font-mono text-[10px] font-bold fill-black uppercase select-none tabular-nums"
                  >
                    {point.etiqueta}
                  </text>
                )}

                {/* Hitbox transparente para interactividad fluida */}
                <rect
                  x={paddingLeft + index * groupSlot}
                  y={paddingTop}
                  width={groupSlot}
                  height={plotHeight + 28}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseMove={(e) => handleMouseMove(e, index)}
                  onMouseLeave={handleMouseLeave}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip interactivo brutalista en B&W puro */}
      {hoveredItem && tooltipPos && (
        <div
          className="pointer-events-none absolute z-30 border border-black bg-black text-white p-3 font-mono text-xs uppercase shadow-none transition-none"
          style={{
            left: `${Math.max(110, Math.min(tooltipPos.x, (containerRef.current?.clientWidth || 300) - 130))}px`,
            top: `${Math.max(10, tooltipPos.y - 12)}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="border-b border-white pb-1 mb-1.5 font-bold tracking-wider text-[11px] text-white">
            {hoveredItem.fecha || hoveredItem.etiqueta}
          </div>
          <div className="space-y-1 text-[11px] tabular-nums">
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/80">[■] ENTRADAS:</span>
              <span className="font-bold text-white">
                + {formatCurrency(hoveredItem.entradas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/80">[□] SALIDAS:</span>
              <span className="font-bold text-white">
                - {formatCurrency(hoveredItem.salidas)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-white/40">
              <span className="font-bold text-white">BALANCE NETO:</span>
              <span className="font-bold text-white">
                {hoveredItem.neto >= 0 ? '+' : '-'} {formatCurrency(Math.abs(hoveredItem.neto))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
