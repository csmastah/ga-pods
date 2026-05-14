import { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, BedDouble, CalendarRange, ChevronRight, CircleDollarSign, UserCheck, UserX, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { getBookings, updateBookingStatus } from '../lib/api';
import type { Booking, BookingStatus } from '../lib/types';

const STATUS_FILTERS: { label: string; value: BookingStatus | 'All' }[] = [
  { label: 'All',          value: 'All' },
  { label: 'Pending',      value: 'pending_payment' },
  { label: 'Confirmed',    value: 'confirmed' },
  { label: 'Checked In',   value: 'checked_in' },
  { label: 'Checked Out',  value: 'checked_out' },
  { label: 'Cancelled',    value: 'cancelled' },
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: 'Pending Payment',
  confirmed:       'Confirmed',
  checked_in:      'Checked In',
  checked_out:     'Checked Out',
  cancelled:       'Cancelled',
};

const STATUS_CONFIG: Record<BookingStatus, { color: string; bg: string; icon: ReactNode }> = {
  pending_payment: { color: 'text-amber-700',   bg: 'bg-amber-100',   icon: <Clock size={12} /> },
  confirmed:       { color: 'text-blue-700',    bg: 'bg-blue-100',    icon: <CircleDollarSign size={12} /> },
  checked_in:      { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <UserCheck size={12} /> },
  checked_out:     { color: 'text-slate-600',   bg: 'bg-slate-100',   icon: <UserX size={12} /> },
  cancelled:       { color: 'text-red-700',     bg: 'bg-red-100',     icon: <UserX size={12} /> },
};

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatPeso(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH');
}

export default function BookingsTab() {
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [filter, setFilter]         = useState<BookingStatus | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating]     = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setBookings(await getBookings()); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === 'All' ? bookings : bookings.filter(b => b.status === filter);

  async function handleStatusUpdate(id: string, status: BookingStatus) {
    setUpdating(id);
    try {
      await updateBookingStatus(id, status);
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
      setExpandedId(null);
    } catch (e: unknown) {
      alert('Failed to update: ' + (e as Error).message);
    } finally { setUpdating(null); }
  }

  return (
    <div>
      <section className="mb-8">
        <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Manage</p>
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Bookings</h2>
          <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors active:scale-95">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {/* Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold font-label uppercase tracking-wider border transition-all duration-200 ${
              filter === f.value
                ? 'bg-primary text-white border-primary'
                : 'bg-surface-container-low text-outline border-outline-variant/40 hover:border-primary hover:text-primary'
            }`}
          >
            {f.label}
            {f.value !== 'All' && (
              <span className="ml-1.5 opacity-70">
                {bookings.filter(b => b.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* States */}
      {loading && <LoadingCards count={3} />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {/* Booking Cards */}
      {!loading && !error && (
        <div className="space-y-4">
          <AnimatePresence>
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-outline">
                <p className="font-headline italic text-lg">No bookings found</p>
              </motion.div>
            ) : (
              filtered.map(booking => {
                const cfg = STATUS_CONFIG[booking.status];
                const isExpanded = expandedId === booking.id;
                const isUpdating = updating === booking.id;
                const roomNum = booking.room?.room_number ?? '—';
                const balance = booking.total_price - (booking.payment_confirmed_at ? booking.total_price : 0);

                return (
                  <motion.div
                    key={booking.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm"
                  >
                    <button
                      className="w-full text-left p-5 flex items-start gap-4"
                      onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <BedDouble size={14} className="text-primary mb-0.5" />
                        <span className="text-xs font-extrabold text-primary leading-none">{roomNum}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-on-surface truncate">{booking.guest_name}</span>
                          <span className={`inline-flex items-center gap-1 ${cfg.bg} ${cfg.color} text-[10px] px-2 py-0.5 rounded-full font-label uppercase tracking-tight shrink-0`}>
                            {cfg.icon}{STATUS_LABELS[booking.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-outline">
                          <CalendarRange size={12} />
                          <span>{formatDate(booking.check_in_date)} → {formatDate(booking.check_out_date)}</span>
                          <span className="font-semibold text-on-surface">· {booking.num_nights}n</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-sm font-bold text-on-surface">{formatPeso(booking.total_price)}</span>
                          {booking.payment_confirmed_at
                            ? <span className="text-xs text-emerald-600 font-medium">Fully paid</span>
                            : <span className="text-xs text-amber-600 font-medium">Balance: {formatPeso(balance)}</span>
                          }
                        </div>
                      </div>

                      <ChevronRight size={18} className={`text-outline shrink-0 mt-1 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 border-t border-outline-variant/15 pt-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <DetailRow label="Booking Ref"  value={booking.booking_ref} />
                              <DetailRow label="Room Type"    value={booking.room_type?.name ?? '—'} />
                              <DetailRow label="Guests"       value={`${booking.num_guests} pax`} />
                              <DetailRow label="Rate/Night"   value={formatPeso(booking.price_per_night)} />
                              <DetailRow label="Payment"      value={booking.payment_method?.toUpperCase() ?? 'N/A'} />
                              <DetailRow label="Booked On"    value={formatDate(booking.created_at)} />
                            </div>

                            <a href={`tel:${booking.guest_phone}`} className="flex items-center gap-2 text-sm text-primary font-semibold">
                              <Phone size={14} />{booking.guest_phone}
                            </a>

                            {booking.notes && (
                              <p className="text-xs text-outline italic bg-surface-container-low px-3 py-2 rounded-xl">
                                📝 {booking.notes}
                              </p>
                            )}

                            <ActionButtons booking={booking} onUpdate={handleStatusUpdate} isUpdating={isUpdating} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-outline font-label mb-0.5">{label}</p>
      <p className={`font-semibold text-sm ${highlight ? 'text-amber-600' : 'text-on-surface'}`}>{value}</p>
    </div>
  );
}

function ActionButtons({ booking, onUpdate, isUpdating }: {
  booking: Booking;
  onUpdate: (id: string, s: BookingStatus) => void;
  isUpdating: boolean;
}) {
  const { id, status } = booking;
  if (isUpdating) return (
    <div className="flex items-center justify-center py-3 text-outline text-sm gap-2">
      <RefreshCw size={14} className="animate-spin" /> Updating…
    </div>
  );

  if (status === 'pending_payment') return (
    <div className="flex gap-2">
      <ActionBtn color="blue"  onClick={() => onUpdate(id, 'confirmed')}  label="Confirm Booking" />
      <ActionBtn color="red"   onClick={() => onUpdate(id, 'cancelled')}  label="Cancel" outline />
    </div>
  );
  if (status === 'confirmed') return (
    <div className="flex gap-2">
      <ActionBtn color="green" onClick={() => onUpdate(id, 'checked_in')} label="Check In" />
      <ActionBtn color="red"   onClick={() => onUpdate(id, 'cancelled')}  label="Cancel" outline />
    </div>
  );
  if (status === 'checked_in') return (
    <ActionBtn color="slate" onClick={() => onUpdate(id, 'checked_out')} label="Check Out" />
  );
  return null;
}

function ActionBtn({ label, color, onClick, outline = false }: {
  label: string; color: 'blue' | 'green' | 'slate' | 'red'; onClick: () => void; outline?: boolean;
}) {
  const base = 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95';
  const variants = {
    blue:  outline ? 'border border-blue-400 text-blue-600 hover:bg-blue-50'  : 'bg-blue-600 text-white hover:bg-blue-700',
    green: outline ? 'border border-emerald-400 text-emerald-600'             : 'bg-emerald-600 text-white hover:bg-emerald-700',
    slate: outline ? 'border border-slate-400 text-slate-600'                 : 'bg-slate-700 text-white hover:bg-slate-800',
    red:   outline ? 'border border-red-300 text-red-500 hover:bg-red-50'     : 'bg-red-600 text-white hover:bg-red-700',
  };
  return <button onClick={onClick} className={`${base} ${variants[color]}`}>{label}</button>;
}

function LoadingCards({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-container-low rounded-2xl h-24 animate-pulse" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
      <p className="text-sm text-outline mb-4">{message}</p>
      <button onClick={onRetry} className="text-primary font-semibold text-sm hover:underline">Try again</button>
    </div>
  );
}
