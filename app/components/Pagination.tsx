'use client';

import React from 'react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  itemName?: string;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  itemName = 'registros',
  className = '',
}: PaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-black font-mono text-xs select-none ${className}`}
    >
      <div className="text-black">
        Mostrando <span className="font-bold text-black tabular-nums">{startItem}</span> a{' '}
        <span className="font-bold text-black tabular-nums">{endItem}</span> de{' '}
        <span className="font-bold text-black tabular-nums">{totalItems}</span> {itemName}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Ir a la página anterior"
          className="border border-black bg-white text-black px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black hover:text-white disabled:hover:bg-white disabled:hover:text-black transition-none cursor-pointer"
        >
          ← Anterior
        </button>

        <span className="font-bold text-black tabular-nums px-2.5 py-1 border border-black bg-white text-[11px]">
          Página {currentPage} de {Math.max(1, totalPages)}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Ir a la página siguiente"
          className="border border-black bg-white text-black px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black hover:text-white disabled:hover:bg-white disabled:hover:text-black transition-none cursor-pointer"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
