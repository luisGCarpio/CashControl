'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Wallet,
  LayoutDashboard,
  ArrowUpRight,
  Package,
  Bell,
  LogOut,
  Plus,
  Menu,
  X,
  Loader2,
} from 'lucide-react';
import MovementModal from './MovementModal';
import RemindersModal, { ReminderItem } from './RemindersModal';
import { ProductItem } from './MovementModal';

export interface NavbarProps {
  products?: ProductItem[];
  reminders?: ReminderItem[];
  onDataChange?: () => void;
}

export default function Navbar({
  products: initialProducts,
  reminders: initialReminders,
  onDataChange,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isMovementOpen, setIsMovementOpen] = useState(false);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Internal data state if not provided via props
  const [internalProducts, setInternalProducts] = useState<ProductItem[]>(initialProducts || []);
  const [internalReminders, setInternalReminders] = useState<ReminderItem[]>(initialReminders || []);

  // Update internal state when props change
  useEffect(() => {
    if (initialProducts) setInternalProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (initialReminders) setInternalReminders(initialReminders);
  }, [initialReminders]);

  // Fetch lightweight data if props are missing
  const fetchLightweightData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        // Not authenticated, ignore or let middleware handle it
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.products && (!initialProducts || initialProducts.length === 0)) {
          setInternalProducts(json.products);
        }
        if (json.reminders && (!initialReminders || initialReminders.length === 0)) {
          setInternalReminders(json.reminders);
        }
      }
    } catch {
      // Ignore background sync errors
    }
  }, [initialProducts, initialReminders]);

  useEffect(() => {
    if (pathname !== '/login') {
      fetchLightweightData();
    }
  }, [pathname, fetchLightweightData]);

  // Don't render Navbar on login page
  if (pathname === '/login') {
    return null;
  }

  const effectiveProducts = initialProducts && initialProducts.length > 0 ? initialProducts : internalProducts;
  const effectiveReminders = initialReminders && initialReminders.length > 0 ? initialReminders : internalReminders;

  // Count active / pending reminders
  const pendingRemindersCount = effectiveReminders.filter((r) => !r.is_completed).length;

  // Handle data updates from modals
  const handleDataChange = async () => {
    // Re-fetch internal data
    await fetchLightweightData();

    // Call prop callback if provided
    if (onDataChange) {
      onDataChange();
    }

    // Broadcast event for any listeners on the page
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pulso:datachanged'));
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Error during logout:', e);
    } finally {
      window.location.href = '/login';
    }
  };

  const navLinks = [
    {
      href: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      href: '/movimientos',
      label: 'Movimientos',
      icon: ArrowUpRight,
      active: pathname.startsWith('/movimientos'),
    },
    {
      href: '/productos',
      label: 'Productos / Stock',
      icon: Package,
      active: pathname.startsWith('/productos'),
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand Logo */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 group-hover:border-emerald-500/40 transition-all shadow-inner">
                  <Wallet size={20} className="text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-base tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                    Pulso <span className="text-emerald-400">Financiero</span>
                  </span>
                  <span className="text-[10px] text-slate-400 -mt-0.5 tracking-wide uppercase font-semibold">
                    Control de Caja Real
                  </span>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-1.5 ml-4">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        link.active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <Icon size={15} className={link.active ? 'text-emerald-400' : 'text-slate-400'} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2.5">
              {/* Botón "+ Registrar" (Abre MovementModal) */}
              <button
                type="button"
                onClick={() => setIsMovementOpen(true)}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus size={16} />
                <span className="hidden xs:inline sm:inline">+ Registrar</span>
                <span className="xs:hidden sm:hidden">+</span>
              </button>

              {/* Botón Campana de Recordatorios (Abre RemindersModal) */}
              <button
                type="button"
                onClick={() => setIsRemindersOpen(true)}
                className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800/80 hover:border-slate-700"
                title={
                  pendingRemindersCount > 0
                    ? `${pendingRemindersCount} recordatorios pendientes`
                    : 'Recordatorios de pago'
                }
              >
                <Bell size={18} />
                {pendingRemindersCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full border border-slate-900 shadow-sm animate-pulse">
                    {pendingRemindersCount}
                  </span>
                )}
              </button>

              {/* Botón Salir (LogOut) */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800/80 hover:border-rose-500/30 transition-colors disabled:opacity-50"
                title="Cerrar sesión"
              >
                {loggingOut ? (
                  <Loader2 size={15} className="animate-spin text-slate-400" />
                ) : (
                  <LogOut size={15} />
                )}
                <span>Salir</span>
              </button>

              {/* Mobile Menu Hamburger Toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 md:hidden border border-slate-800"
                title="Abrir menú"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900/95 px-4 pt-3 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-150">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    link.active
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon size={18} className={link.active ? 'text-emerald-400' : 'text-slate-400'} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                disabled={loggingOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut size={18} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Movement Modal */}
      <MovementModal
        isOpen={isMovementOpen}
        onClose={() => setIsMovementOpen(false)}
        onMovementSaved={handleDataChange}
        products={effectiveProducts}
      />

      {/* Reminders Modal */}
      <RemindersModal
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
        onReminderUpdated={handleDataChange}
        reminders={effectiveReminders}
      />
    </>
  );
}
