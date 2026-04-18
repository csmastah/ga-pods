/**
 * G&A Pods — Manager Dashboard
 * Stack: Vite + React + TypeScript + Tailwind v4 + Motion + Supabase
 */

import { useState, useEffect, ReactNode } from 'react';
import {
  Bell, LogIn, LogOut, Moon, DoorOpen,
  Banknote, Plus, LayoutDashboard, BookText,
  CalendarDays, Bed, ChevronRight, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import BookingsTab  from './components/BookingsTab';
import RoomsTab     from './components/RoomsTab';
import PaymentsTab  from './components/PaymentsTab';
import CalendarTab  from './components/CalendarTab';
import BookingPage  from './BookingPage';

import { getDashboardSummary, getBookings } from './lib/api';
import type { Booking } from './lib/types';

type Tab = 'dashboard' | 'bookings' | 'calendar' | 'rooms' | 'payments';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Show guest booking flow when ?mode=booking is in the URL
  const isBookingMode = new URLSearchParams(window.location.search).get('mode') === 'booking';
  if (isBookingMode) return <BookingPage />;

  return (
    <div className="min-h-screen bg-surface flex flex-col font-body">
      {/* Top App Bar */}
      <header className="bg-surface sticky top-0 z-40 px-6 py-4 flex justify-between items-center w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high border-2 border-primary-container">
            <img
              alt="Manager"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1gOFz1t-n-Pt4RU3nN-dVxv3rKrPi4S1Zqb2xCNYGLcmFeIDSVwy0MJ2f0MzsLYRL5_onjS_V31qKb4rqZn-MUrm2BP3mFFDtZzsAJ6PlAjnXPGY8vPmIahoWKv0P1y_5YVAvlemdE2TOEysUer68lwrRKlfETrR0UfsMQ_-zjZoMO7Ik9iWmpSRP9wQvgZYvtU4Q9J9Ih6EMgLuEeO3pwxQip92Dd3W2LZku4EudyoxeGR5aNnv4qzAau0wr4ShJZ06jycxjxOaj"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-xl font-bold text-primary font-headline tracking-tight">G&A Pods</h1>
        </div>
        <button className="p-2 text-outline hover:bg-surface-container-high transition-colors rounded-full active:scale-95 duration-150">
          <Bell size={24} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-32 pt-4 max-w-5xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <DashboardView onTabChange={setActiveTab} />}
            {activeTab === 'bookings'  && <BookingsTab />}
            {activeTab === 'calendar'  && <CalendarTab />}
            {activeTab === 'rooms'     && <RoomsTab />}
            {activeTab === 'payments'  && <PaymentsTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FAB — opens guest booking form in new tab */}
      <button
        onClick={() => window.open('?mode=booking', '_blank')}
        className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-primary to-primary-container text-white rounded-full shadow-fab flex items-center justify-center active:scale-95 transition-transform z-50"
        title="New Booking"
      >
        <Plus size={32} />
      </button>

      {/* Bottom Nav */}
      <nav className="bg-surface/80 backdrop-blur-xl fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-8 pt-2 rounded-t-3xl shadow-[0_-10px_30px_rgba(26,28,30,0.06)] border-t border-gray-100">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
        <NavButton active={activeTab === 'bookings'}  onClick={() => setActiveTab('bookings')}  icon={<BookText size={20} />}        label="Bookings"  />
        <NavButton active={activeTab === 'calendar'}  onClick={() => setActiveTab('calendar')}  icon={<CalendarDays size={20} />}    label="Calendar"  />
        <NavButton active={activeTab === 'rooms'}     onClick={() => setActiveTab('rooms')}     icon={<Bed size={20} />}             label="Rooms"     />
        <NavButton active={activeTab === 'payments'}  onClick={() => setActiveTab('payments')}  icon={<Banknote size={20} />}        label="Payments"  />
      </nav>
    </div>
  );
}

// ── Dashboard View ────────────────────────────────────────────────────────────
function DashboardView({ onTabChange }: { onTabChange: (t: Tab) => void }) {
  const [summary, setSummary] = useState({ todayCheckIns: 0, todayCheckOuts: 0, activeStays: 0, availableRooms: 0 });
  const [recent, setRecent]   = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [s, bookings] = await Promise.all([getDashboardSummary(), getBookings()]);
      setSummary(s);
      setRecent(bookings.slice(0, 3));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <section className="mb-10">
        <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Overview</p>
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Dashboard</h2>
          <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors active:scale-95">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {/* Live Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <SummaryCard icon={<LogIn className="text-primary" />}    label="Today's Check-ins"  value={loading ? '—' : String(summary.todayCheckIns)}  className="bg-surface-container-lowest border border-outline-variant/15" />
        <SummaryCard icon={<LogOut className="text-secondary" />} label="Today's Check-outs" value={loading ? '—' : String(summary.todayCheckOuts)} className="bg-surface-container-low" />
        <SummaryCard icon={<Moon className="text-primary" />}     label="Active Stays"       value={loading ? '—' : String(summary.activeStays)}    className="bg-primary-container/10"  valueClassName="text-primary"  labelClassName="text-on-primary-fixed-variant" />
        <SummaryCard icon={<DoorOpen className="text-tertiary" />} label="Available Rooms"   value={loading ? '—' : String(summary.availableRooms)} className="bg-tertiary-fixed/30"     valueClassName="text-tertiary" labelClassName="text-on-tertiary-fixed-variant" />
      </div>

      {/* Recent Activity */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold font-headline tracking-tight">Recent Activity</h3>
          <button onClick={() => onTabChange('bookings')} className="text-primary text-sm font-semibold hover:underline">View All</button>
        </div>

        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-surface-container-low animate-pulse" />)}</div>
        ) : recent.length === 0 ? (
          <p className="text-outline text-sm text-center py-8 italic">No bookings yet</p>
        ) : (
          <div className="space-y-4">
            {recent.map(b => {
              const statusColors: Record<string, string> = {
                pending_payment: 'bg-amber-500 text-white',
                confirmed:       'bg-blue-500 text-white',
                checked_in:      'bg-primary text-white',
                checked_out:     'bg-slate-500 text-white',
                cancelled:       'bg-red-500 text-white',
              };
              return (
                <div key={b.id} className="bg-surface-container-low rounded-2xl p-5 flex items-center gap-4 border border-transparent hover:bg-surface-container-high hover:border-outline-variant/30 transition-all">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shadow-fab shrink-0 font-extrabold text-sm font-headline">
                    {b.room?.room_number ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`${statusColors[b.status] ?? 'bg-slate-400 text-white'} text-[10px] px-2 py-0.5 rounded-full font-label uppercase tracking-tighter`}>
                        {b.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-outline font-label">{b.created_at.split('T')[0]}</span>
                    </div>
                    <p className="text-on-surface font-semibold font-body mt-1 truncate">
                      {b.guest_name} · <span className="text-primary">{b.booking_ref}</span>
                    </p>
                  </div>
                  <ChevronRight className="text-outline shrink-0" size={20} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Quick Access */}
      <section>
        <h3 className="text-2xl font-bold font-headline tracking-tight mb-4">Quick Access</h3>
        <div className="grid grid-cols-2 gap-3">
          {([
            { label: 'Manage Bookings', tab: 'bookings', icon: <BookText size={20} className="text-primary" /> },
            { label: 'Room Status',     tab: 'rooms',    icon: <Bed size={20} className="text-tertiary" /> },
            { label: 'Calendar View',   tab: 'calendar', icon: <CalendarDays size={20} className="text-secondary" /> },
            { label: 'Payment History', tab: 'payments', icon: <Banknote size={20} className="text-emerald-600" /> },
          ] as { label: string; tab: Tab; icon: ReactNode }[]).map(item => (
            <button
              key={item.tab}
              onClick={() => onTabChange(item.tab)}
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4 flex items-center gap-3 hover:bg-surface-container-high active:scale-95 transition-all shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center">{item.icon}</div>
              <span className="font-semibold text-sm text-on-surface flex-1 text-left">{item.label}</span>
              <ChevronRight size={16} className="text-outline" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────
function SummaryCard({ icon, label, value, className = '', valueClassName = 'text-on-surface', labelClassName = 'text-outline' }: {
  icon: ReactNode; label: string; value: string;
  className?: string; valueClassName?: string; labelClassName?: string;
}) {
  return (
    <div className={`p-6 rounded-[2rem] flex flex-col justify-between aspect-square md:aspect-auto md:h-48 group hover:scale-[1.02] transition-all duration-300 ${className}`}>
      <div className="p-2 w-fit rounded-full">{icon}</div>
      <div>
        <p className={`text-[10px] font-label uppercase tracking-widest mb-1 ${labelClassName}`}>{label}</p>
        <p className={`text-5xl font-extrabold font-headline ${valueClassName}`}>{value}</p>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 px-4 transition-all duration-300 rounded-2xl ${
        active ? 'bg-gradient-to-br from-primary to-primary-container text-white scale-100' : 'text-outline hover:text-primary scale-90'
      }`}
    >
      <div className="mb-1">{icon}</div>
      <span className="font-headline text-[10px] uppercase tracking-wider font-semibold">{label}</span>
    </button>
  );
}
