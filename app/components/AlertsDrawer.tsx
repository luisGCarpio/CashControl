'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';

export interface BusinessAlert {
  id: string;
  level: 'DANGER' | 'WARNING' | 'INFO';
  scope: 'INVENTARIO' | 'GASTOS' | 'LIQUIDEZ';
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
}

export interface AlertsResponseDTO {
  totalCount: number;
  dangerCount: number;
  warningCount: number;
  infoCount: number;
  alerts: BusinessAlert[];
}

export interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAlertCountChange?: (count: number) => void;
}

export type FilterScope = 'TODAS' | 'INVENTARIO' | 'GASTOS' | 'LIQUIDEZ';

export default function AlertsDrawer({
  isOpen,
  onClose,
  onAlertCountChange,
}: AlertsDrawerProps) {
  const [alertsData, setAlertsData] = useState<AlertsResponseDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<FilterScope>('TODAS');

  const drawerRef = useRef<HTMLDivElement>(null);
  const onAlertCountChangeRef = useRef(onAlertCountChange);

  // Mantener referencia actualizada del callback sin romper memoización
  useEffect(() => {
    onAlertCountChangeRef.current = onAlertCountChange;
  }, [onAlertCountChange]);

  // Consulta al endpoint centralizado GET /api/alerts
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error || `Error ${res.status}: No se pudo consultar el centro de alertas.`
        );
      }
      const data: AlertsResponseDTO = await res.json();
      setAlertsData(data);
      if (onAlertCountChangeRef.current) {
        onAlertCountChangeRef.current(data.totalCount ?? 0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el servidor.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial al montar el componente (para alimentar el contador de alertas si aplica)
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Re-consultar cuando se abra el panel deslizable
  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, fetchAlerts]);

  // Accesibilidad: Focus trap, tecla Escape y bloqueo de scroll en el body
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!drawerRef.current) return;
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Foco inicial accesible dentro del drawer
    const timer = setTimeout(() => {
      if (drawerRef.current) {
        const firstFocusable = drawerRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input, select'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          drawerRef.current.focus();
        }
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  // Alertas filtradas según pestaña seleccionada
  const filteredAlerts = useMemo(() => {
    if (!alertsData?.alerts) return [];
    if (selectedScope === 'TODAS') return alertsData.alerts;
    return alertsData.alerts.filter((a) => a.scope === selectedScope);
  }, [alertsData, selectedScope]);

  // Si no está abierto, no renderizar elementos en el DOM
  if (!isOpen) {
    return null;
  }

  const totalCount = alertsData?.totalCount ?? 0;

  const tabs: { key: FilterScope; label: string }[] = [
    { key: 'TODAS', label: `TODAS (${totalCount})` },
    { key: 'INVENTARIO', label: 'INVENTARIO' },
    { key: 'GASTOS', label: 'GASTOS' },
    { key: 'LIQUIDEZ', label: 'LIQUIDEZ' },
  ];

  return (
    <>
      {/* Backdrop con oscurecimiento monocromático y clic para cerrar */}
      <div
        className="fixed inset-0 bg-black/50 z-50 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer deslizable Brutalista */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerts-drawer-title"
        tabIndex={-1}
        className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white border-l border-black z-50 flex flex-col justify-between font-mono select-none outline-none"
      >
        {/* 1. Header Brutalista */}
        <div className="p-4 border-b border-black bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2
              id="alerts-drawer-title"
              className="font-mono font-bold text-sm uppercase tracking-wider text-black m-0 truncate"
            >
              CENTRO DE ALERTAS
            </h2>
            <span
              className="font-mono font-bold text-xs bg-black text-white px-2 py-0.5 tabular-nums shrink-0"
              aria-label={`${totalCount} alertas activas`}
            >
              [{totalCount}]
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchAlerts}
              disabled={loading}
              className="h-9 px-3 border border-black bg-white text-black hover:bg-black hover:text-white font-mono text-xs font-bold uppercase transition-none cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center"
              title="Recargar alertas del sistema"
              aria-label="Recargar alertas del sistema"
            >
              {loading ? '...' : '[↻]'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 border border-black bg-white text-black hover:bg-black hover:text-white font-mono text-xs font-bold uppercase transition-none cursor-pointer flex items-center justify-center"
              title="Cerrar panel de alertas"
              aria-label="Cerrar panel de alertas"
            >
              [✕]
            </button>
          </div>
        </div>

        {/* 2. Pestañas de Filtrado (h-9) */}
        <div className="p-4 border-b border-black bg-white shrink-0">
          <div
            className="h-9 flex border border-black divide-x divide-black"
            role="tablist"
            aria-label="Filtrar alertas por ámbito"
          >
            {tabs.map((tab) => {
              const isActive = selectedScope === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedScope(tab.key)}
                  className={`h-full flex-1 px-1 sm:px-2 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-none cursor-pointer flex items-center justify-center text-center ${
                    isActive
                      ? 'bg-black text-white hover:bg-black hover:text-white'
                      : 'bg-white text-black hover:bg-black hover:text-white'
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Lista de Alertas / Estados */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {/* Estado de Carga */}
          {loading && !alertsData && (
            <div className="border border-black bg-white p-8 text-center">
              <p className="font-mono font-bold text-xs uppercase tracking-wider text-black m-0 animate-pulse">
                CONSULTANDO SENSORES DEL SISTEMA...
              </p>
            </div>
          )}

          {/* Estado de Error */}
          {error && !alertsData && (
            <div className="border border-black bg-white p-6 text-center space-y-3">
              <div className="font-mono font-bold text-xs uppercase tracking-wider bg-black text-white inline-block px-2 py-1">
                [ERROR DE CONEXIÓN]
              </div>
              <p className="font-mono text-xs text-black m-0 uppercase leading-relaxed">
                {error}
              </p>
              <button
                type="button"
                onClick={fetchAlerts}
                className="h-9 px-4 border border-black bg-white text-black hover:bg-black hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-none cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Estado Vacío */}
          {(!loading || alertsData) && filteredAlerts.length === 0 && (
            <div className="border border-black bg-white p-8 text-center space-y-2">
              <div className="font-mono font-bold text-xs uppercase tracking-wider text-black">
                [✓]
              </div>
              <p className="font-mono font-bold text-xs uppercase tracking-wider text-black m-0">
                TODO EN ORDEN - NO SE REGISTRAN ALERTAS ACTIVAS
              </p>
            </div>
          )}

          {/* Lista de Tarjetas de Alerta */}
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="border border-black bg-white p-4 space-y-3"
            >
              {/* Cabecera de la tarjeta: Badge de severidad + Scope */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border border-black ${
                      alert.level === 'DANGER'
                        ? 'bg-black text-white'
                        : 'bg-white text-black'
                    }`}
                  >
                    [{alert.level}]
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-white text-black border border-black">
                    [{alert.scope}]
                  </span>
                </div>
              </div>

              {/* Título en mayúsculas font-mono font-bold text-xs */}
              <h3 className="font-mono font-bold text-xs uppercase text-black m-0 leading-snug">
                {alert.title}
              </h3>

              {/* Detalle descriptivo en font-mono text-xs */}
              <p className="font-mono text-xs text-black leading-relaxed m-0">
                {alert.detail}
              </p>

              {/* Botón de acción directo con inversión al hover */}
              <div>
                <Link
                  href={alert.actionHref}
                  onClick={onClose}
                  className="w-full h-9 border border-black bg-white text-black hover:bg-black hover:text-white px-3 text-xs font-mono font-bold uppercase tracking-wider transition-none no-underline cursor-pointer flex items-center justify-center text-center"
                >
                  <span>
                    {alert.scope === 'LIQUIDEZ'
                      ? '→ Ver Pagos Recurrentes'
                      : alert.actionLabel
                      ? `→ ${alert.actionLabel}`
                      : '→ VER DETALLE'}
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* 4. Footer Brutalista */}
        <div className="p-4 border-t border-black bg-white space-y-3 shrink-0">
          <div className="flex items-center justify-between font-mono text-[10px] sm:text-xs uppercase tracking-wider border border-black p-2.5 bg-white">
            <span className="font-bold">SENSORES ACTIVOS:</span>
            <span className="tabular-nums font-bold">
              CRÍTICAS: {alertsData?.dangerCount ?? 0} | ADVERTENCIAS: {alertsData?.warningCount ?? 0} | INFO: {alertsData?.infoCount ?? 0}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-9 border border-black bg-black text-white hover:bg-white hover:text-black font-mono text-xs font-bold uppercase tracking-wider transition-none cursor-pointer flex items-center justify-center text-center"
          >
            Cerrar Panel [ESC]
          </button>
        </div>
      </div>
    </>
  );
}
