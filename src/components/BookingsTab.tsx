import { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, BedDouble, CalendarRange, ChevronRight, CircleDollarSign, UserCheck, UserX, Clock, RefreshCw, AlertCircle, Trash2, Eye, EyeOff, ShieldAlert, Image as ImageIcon, ExternalLink, X, Users, PlusCircle } from 'lucide-react';
import { getBookings, updateBookingStatus, createRebooking, extendStay, deleteBooking, confirmPayment } from '../lib/api';
import type { Booking, BookingStatus, BookingSnapshot } from '../lib/types';

const STATUS_FILTERS: { label: string; value: BookingStatus | 'All' }[] = [
  { label: 'All',             value: 'All' },
  { label: 'Awaiting Pymnt',  value: 'awaiting_payment' },
  { label: 'Screenshot Up',   value: 'payment_submitted' },
  { label: 'Under Review',    value: 'under_review' },
  { label: 'Confirmed',       value: 'confirmed' },
  { label: 'Checked In',      value: 'checked_in' },
  { label: 'Checked Out',     value: 'checked_out' },
  { label: 'Cancelled',       value: 'cancelled' },
  { label: 'Rebooked',        value: 'rebooked' },
  { label: 'Expired',         value: 'expired' },
  { label: 'No Show',         value: 'no_show' },
  // Legacy filters (hidden from primary UI but kept for existing data)
  { label: 'Pending (old)',   value: 'pending_payment' },
  { label: 'On Hold (old)',   value: 'on_hold' },
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment:   'Pending Payment',
  on_hold:           'On Hold',
  awaiting_payment:  'Awaiting Payment',
  payment_submitted: 'Screenshot Uploaded',
  under_review:      'Under Review',
  confirmed:         'Confirmed',
  checked_in:        'Checked In',
  checked_out:       'Checked Out',
  cancelled:         'Cancelled',
  rebooked:          'Rebooked',
  expired:           'Expired',
  no_show:           'No Show',
};

const STATUS_CONFIG: Record<BookingStatus, { color: string; bg: string; icon: ReactNode }> = {
  pending_payment:   { color: 'text-amber-700',   bg: 'bg-amber-100',   icon: <Clock size={12} /> },
  on_hold:           { color: 'text-primary',     bg: 'bg-primary/10',  icon: <CircleDollarSign size={12} /> },
  awaiting_payment:  { color: 'text-amber-700',   bg: 'bg-amber-100',   icon: <Clock size={12} /> },
  payment_submitted: { color: 'text-blue-700',    bg: 'bg-blue-100',    icon: <CircleDollarSign size={12} /> },
  under_review:      { color: 'text-indigo-700',  bg: 'bg-indigo-100',  icon: <ShieldAlert size={12} /> },
  confirmed:         { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <CircleDollarSign size={12} /> },
  checked_in:        { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <UserCheck size={12} /> },
  checked_out:       { color: 'text-slate-600',   bg: 'bg-slate-100',   icon: <UserX size={12} /> },
  cancelled:         { color: 'text-red-700',     bg: 'bg-red-100',     icon: <UserX size={12} /> },
  rebooked:          { color: 'text-violet-700',  bg: 'bg-violet-100',  icon: <RefreshCw size={12} /> },
  expired:           { color: 'text-red-700',     bg: 'bg-red-100',     icon: <AlertCircle size={12} /> },
  no_show:           { color: 'text-orange-700',  bg: 'bg-orange-100',  icon: <AlertCircle size={12} /> },
};

function formatDate(iso: string) {
  // created_at is a full ISO timestamp (e.g. "2026-05-07T10:00:00+08:00"),
  // while check_in_date / check_out_date are plain "YYYY-MM-DD" strings.
  // Only append T00:00:00 for the plain date form to avoid "Invalid Date".
  const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatPeso(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH');
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return 'N/A';
  const map: Record<string, string> = {
    gcash_maya: 'GCash / Maya',
    gcash: 'GCash',
    maya: 'Maya',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
  };
  return map[method.toLowerCase()] ?? method;
}

export default function BookingsTab() {
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [filter, setFilter]         = useState<BookingStatus | 'All'>('All');
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [updating, setUpdating]           = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

  function refreshAndCollapse() {
    setExpandedId(null);
    load();
  }

  async function handleDelete(id: string) {
    try {
      await deleteBooking(id);
      setBookings(prev => prev.filter(b => b.id !== id));
      setExpandedId(null);
    } catch (e: unknown) {
      alert('Delete failed: ' + (e as Error).message);
    }
  }

  return (
    <div>
      <section className="mb-8">
        <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Manage</p>
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Bookings</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.href = '?mode=booking'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-full text-xs font-label font-semibold hover:bg-primary/90 active:scale-95 transition-all"
              title="Add manual or OTA booking"
            >
              <PlusCircle size={14} /> Add Booking
            </button>
            <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors active:scale-95">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
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
                const cfg = STATUS_CONFIG[booking.status] ?? { color: 'text-slate-600', bg: 'bg-slate-100', icon: <Clock size={12} /> };
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
                            {cfg.icon}{STATUS_LABELS[booking.status] ?? booking.status.replace(/_/g, ' ')}
                          </span>
                          {booking.payment_screenshot_url && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-label font-bold uppercase tracking-tight text-emerald-700">
                              <ImageIcon size={11} />
                              Proof
                            </span>
                          )}
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
                              <DetailRow label="Room Type"    value={booking.room_type?.name ?? booking.selected_rooms?.[0]?.room_name ?? '—'} />
                              <DetailRow label="Guests"       value={`${booking.num_guests} pax`} />
                              <DetailRow label="Rate/Night"   value={formatPeso(booking.price_per_night || booking.selected_rooms?.[0]?.rate_per_night || 0)} />
                              <DetailRow label="Payment"      value={formatPaymentMethod(booking.payment_method)} />
                              <DetailRow label="Booked On"    value={formatDate(booking.created_at)} />
                              {booking.guest_email && (
                                <div className="col-span-2">
                                  <DetailRow label="Email" value={booking.guest_email} />
                                </div>
                              )}
                            </div>

                            {/* Selected rooms breakdown for website bookings */}
                            {!booking.room_type && booking.selected_rooms && booking.selected_rooms.length > 0 && (
                              <div className="bg-surface-container-low rounded-xl px-3 py-2 space-y-1">
                                <p className="text-[10px] uppercase tracking-widest text-outline font-label mb-1">Rooms Booked</p>
                                {booking.selected_rooms.map((r, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="text-on-surface font-medium">{r.room_name} × {r.quantity}</span>
                                    <span className="text-outline">{formatPeso(r.total)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <a href={`tel:${booking.guest_phone}`} className="flex items-center gap-2 text-sm text-primary font-semibold">
                              <Phone size={14} />{booking.guest_phone}
                            </a>

                            {booking.other_guests && <GuestRoster raw={booking.other_guests} />}

                            {booking.notes && <NotesWithEmergency notes={booking.notes} />}

                            {booking.payment_screenshot_url && (
                              <PaymentProof
                                url={booking.payment_screenshot_url}
                                uploadedAt={booking.payment_uploaded_at}
                              />
                            )}

                            <ActionButtons booking={booking} onUpdate={handleStatusUpdate} onRefresh={refreshAndCollapse} isUpdating={isUpdating} />

                            {/* Admin delete — always available at the bottom */}
                            <div className="pt-2 border-t border-outline-variant/15">
                              <button
                                onClick={() => setPendingDeleteId(booking.id)}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={13} /> Admin: Delete Record
                              </button>
                            </div>
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

      {/* Admin delete modal */}
      {pendingDeleteId && (
        <AdminDeleteModal
          bookingRef={bookings.find(b => b.id === pendingDeleteId)?.booking_ref ?? ''}
          onConfirm={() => { handleDelete(pendingDeleteId); setPendingDeleteId(null); }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}

// ── Guest & Emergency Contact Helpers ────────────────────────────────────────

function parseNotes(raw: string): { message: string; emergency: string } {
  const marker = '\n\nEmergency contact:';
  const idx = raw.indexOf(marker);
  if (idx !== -1) {
    return {
      message: raw.slice(0, idx).trim(),
      emergency: raw.slice(idx + 2).trim(),
    };
  }
  if (raw.trimStart().startsWith('Emergency contact:')) {
    return { message: '', emergency: raw.trim() };
  }
  return { message: raw, emergency: '' };
}

function parseEmergency(text: string): { name: string; relationship: string; phone: string } {
  const lines = text.split('\n');
  const get = (prefix: string) =>
    lines.find(l => l.startsWith(prefix))?.replace(prefix, '').trim() ?? '';
  return {
    name: get('Name:'),
    relationship: get('Relationship:'),
    phone: get('Phone:'),
  };
}

function GuestRoster({ raw }: { raw: string }) {
  const lines = raw.split('\n').filter(Boolean);
  return (
    <div className="bg-surface-container-low rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Users size={12} className="text-outline" />
        <p className="text-[10px] uppercase tracking-widest text-outline font-label font-bold">Guest List</p>
      </div>
      {lines.map((line, i) => {
        const dashIdx = line.lastIndexOf(' - ');
        const label = line.includes(':') ? line.split(':')[0] + ':' : '';
        const nameAge = dashIdx !== -1
          ? { name: line.slice(label.length).slice(0, dashIdx - label.length).trim(), age: line.slice(dashIdx + 3).trim() }
          : { name: line.slice(label.length).trim(), age: '' };
        return (
          <div key={i} className="flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-outline font-label uppercase tracking-wide mr-1.5">{label}</span>
              <span className="font-semibold text-on-surface">{nameAge.name}</span>
            </div>
            {nameAge.age && (
              <span className="text-outline shrink-0">{nameAge.age}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NotesWithEmergency({ notes }: { notes: string }) {
  const { message, emergency } = parseNotes(notes);
  const ec = emergency ? parseEmergency(emergency) : null;
  return (
    <>
      {message && (
        <p className="text-xs text-outline italic bg-surface-container-low px-3 py-2 rounded-xl">
          📝 {message}
        </p>
      )}
      {ec && (ec.name || ec.phone) && (
        <div className="rounded-xl border border-red-200/60 bg-red-50/50 px-3 py-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <ShieldAlert size={12} className="text-red-500" />
            <p className="text-[10px] uppercase tracking-widest text-red-600/70 font-label font-bold">Emergency Contact</p>
          </div>
          {ec.name && (
            <p className="text-sm font-semibold text-on-surface">
              {ec.name}
              {ec.relationship && <span className="text-xs font-normal text-outline ml-1.5">({ec.relationship})</span>}
            </p>
          )}
          {ec.phone && (
            <a href={`tel:${ec.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 text-sm text-red-600 font-semibold">
              <Phone size={13} />{ec.phone}
            </a>
          )}
        </div>
      )}
    </>
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

function PaymentProof({ url, uploadedAt }: { url: string; uploadedAt?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-emerald-700/70 font-label font-bold">Proof of payment</p>
            <p className="text-xs font-semibold text-emerald-800">
              {uploadedAt ? `Uploaded ${formatDateTime(uploadedAt)}` : 'Screenshot uploaded by guest'}
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700"
          >
            Open <ExternalLink size={12} />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-white p-2 text-left transition hover:border-emerald-400 hover:shadow-sm"
        >
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-emerald-100">
            <img src={url} alt="Payment screenshot preview" className="h-full w-full object-cover" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-on-surface">Payment screenshot attached</span>
            <span className="block text-xs text-outline">Click to expand. Hover shows a larger preview.</span>
          </span>
          <ImageIcon className="h-5 w-5 shrink-0 text-emerald-700" />

          <span className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] left-2 z-20 hidden w-64 overflow-hidden rounded-2xl border border-outline-variant/25 bg-white p-2 shadow-xl group-hover:block">
            <img src={url} alt="" className="max-h-72 w-full rounded-xl object-contain" />
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white p-3 shadow-2xl"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white"
                aria-label="Close payment screenshot"
              >
                <X size={18} />
              </button>
              <img src={url} alt="Payment screenshot" className="max-h-[86vh] w-full rounded-2xl object-contain" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ActionButtons({ booking, onUpdate, onRefresh, isUpdating }: {
  booking: Booking;
  onUpdate: (id: string, s: BookingStatus) => void;
  onRefresh: () => void;
  isUpdating: boolean;
}) {
  const [mode, setMode]               = useState<'default' | 'rebook' | 'extend'>('default');
  const [showPayModal, setShowPayModal] = useState(false);
  const [rebookCheckIn, setRebookCI]  = useState('');
  const [rebookCheckOut, setRebookCO] = useState('');
  const [extendCheckOut, setExtendCO] = useState('');
  const [working, setWorking]         = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const { id, status, check_in_date, check_out_date } = booking;
  const isCheckInToday  = check_in_date  === today;
  const isCheckOutToday = check_out_date === today;

  async function handleRebook() {
    if (!rebookCheckIn || !rebookCheckOut) return alert('Please select both dates.');
    if (rebookCheckIn < today)                return alert('Check-in must be today or in the future.');
    if (rebookCheckOut <= rebookCheckIn)      return alert('Check-out must be after check-in.');
    setWorking(true);
    try {
      await createRebooking(booking, rebookCheckIn, rebookCheckOut);
      onRefresh();
    } catch (e: unknown) {
      alert('Rebook failed: ' + (e as Error).message);
    } finally { setWorking(false); }
  }

  async function handleExtend() {
    if (!extendCheckOut)                    return alert('Please select a date.');
    if (extendCheckOut <= check_out_date)   return alert('New check-out must be after the current check-out.');
    setWorking(true);
    try {
      await extendStay(booking, extendCheckOut);
      onRefresh();
    } catch (e: unknown) {
      alert('Extend failed: ' + (e as Error).message);
    } finally { setWorking(false); }
  }

  if (isUpdating || working) return (
    <div className="flex items-center justify-center py-3 text-outline text-sm gap-2">
      <RefreshCw size={14} className="animate-spin" /> {working ? 'Processing…' : 'Updating…'}
    </div>
  );

  /* ── Rebook inline form ── */
  if (mode === 'rebook') return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-on-surface">📅 Select new booking dates</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-outline font-label mb-1">Check-in</p>
          <input
            type="date" min={today} value={rebookCheckIn}
            onChange={e => setRebookCI(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-outline font-label mb-1">Check-out</p>
          <input
            type="date" min={rebookCheckIn || today} value={rebookCheckOut}
            onChange={e => setRebookCO(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
      </div>
      <p className="text-[10px] text-outline italic">New booking will be created as Confirmed (payment already received).</p>
      <div className="flex gap-2">
        <ActionBtn color="primary"  onClick={handleRebook}              label="Confirm Rebook" />
        <ActionBtn color="slate" onClick={() => setMode('default')}  label="Go Back" outline />
      </div>
    </div>
  );

  /* ── Extend stay inline form ── */
  if (mode === 'extend') return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-on-surface">📅 Extend until when?</p>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-outline font-label mb-1">New check-out date</p>
        <input
          type="date" min={check_out_date} value={extendCheckOut}
          onChange={e => setExtendCO(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-2">
        <ActionBtn color="green" onClick={handleExtend}              label="Extend Stay" />
        <ActionBtn color="slate" onClick={() => setMode('default')}  label="Go Back" outline />
      </div>
    </div>
  );

  /* ── Default action buttons per status ── */

  // New: awaiting_payment — hold active, no screenshot yet
  if (status === 'awaiting_payment') return (
    <>
      {showPayModal && <PaymentConfirmModal booking={booking} onClose={() => setShowPayModal(false)} onConfirmed={() => { setShowPayModal(false); onRefresh(); }} />}
      <div className="flex flex-col gap-2">
        <ActionBtn color="green" onClick={() => setShowPayModal(true)} label="✓ Payment Received" />
        <ActionBtn color="primary" onClick={() => onUpdate(id, 'payment_submitted')} label="Screenshot Uploaded (Verify)" outline />
        <div className="flex gap-2">
          <ActionBtn color="red" onClick={() => onUpdate(id, 'expired')}   label="Expire Hold" outline />
          <ActionBtn color="red" onClick={() => onUpdate(id, 'cancelled')} label="Cancel" outline />
        </div>
      </div>
    </>
  );

  // New: payment_submitted — screenshot uploaded, needs review
  if (status === 'payment_submitted') return (
    <>
      {showPayModal && <PaymentConfirmModal booking={booking} onClose={() => setShowPayModal(false)} onConfirmed={() => { setShowPayModal(false); onRefresh(); }} />}
      <div className="flex flex-col gap-2">
        <ActionBtn color="green"   onClick={() => setShowPayModal(true)}           label="✓ Verify & Confirm Payment" />
        <ActionBtn color="primary" onClick={() => onUpdate(id, 'under_review')}    label="Mark Under Review" outline />
        <div className="flex gap-2">
          <ActionBtn color="red" onClick={() => onUpdate(id, 'expired')}   label="Expire" outline />
          <ActionBtn color="red" onClick={() => onUpdate(id, 'cancelled')} label="Cancel" outline />
        </div>
      </div>
    </>
  );

  // New: under_review — operator has flagged for review
  if (status === 'under_review') return (
    <>
      {showPayModal && <PaymentConfirmModal booking={booking} onClose={() => setShowPayModal(false)} onConfirmed={() => { setShowPayModal(false); onRefresh(); }} />}
      <div className="flex flex-col gap-2">
        <ActionBtn color="green" onClick={() => setShowPayModal(true)}         label="✓ Confirm Payment" />
        <div className="flex gap-2">
          <ActionBtn color="red" onClick={() => onUpdate(id, 'cancelled')} label="Cancel" outline />
        </div>
      </div>
    </>
  );

  // Legacy: pending_payment
  if (status === 'pending_payment') return (
    <>
      {showPayModal && <PaymentConfirmModal booking={booking} onClose={() => setShowPayModal(false)} onConfirmed={() => { setShowPayModal(false); onRefresh(); }} />}
      <div className="flex flex-col gap-2">
        <ActionBtn color="green"   onClick={() => setShowPayModal(true)}           label="✓ Payment Received" />
        <ActionBtn color="primary" onClick={() => onUpdate(id, 'on_hold')}         label="Mark On Hold (Verify First)" outline />
        <div className="flex gap-2">
          <ActionBtn color="red" onClick={() => onUpdate(id, 'expired')}   label="Expire (No Payment)" outline />
          <ActionBtn color="red" onClick={() => onUpdate(id, 'cancelled')} label="Cancel" outline />
        </div>
      </div>
    </>
  );

  // Legacy: on_hold
  if (status === 'on_hold') return (
    <>
      {showPayModal && <PaymentConfirmModal booking={booking} onClose={() => setShowPayModal(false)} onConfirmed={() => { setShowPayModal(false); onRefresh(); }} />}
      <div className="flex gap-2">
        <ActionBtn color="primary" onClick={() => setShowPayModal(true)}         label="Acknowledge Payment" />
        <ActionBtn color="red"     onClick={() => onUpdate(id, 'cancelled')}     label="Cancel" outline />
      </div>
    </>
  );

  if (status === 'confirmed') return (
    <div className="flex flex-col gap-2">
      {isCheckInToday && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-3 py-2 text-xs font-semibold">
          🏨 Guest is due to check in today!
        </div>
      )}
      <div className="flex gap-2">
        <ActionBtn color="green" onClick={() => onUpdate(id, 'checked_in')}  label={isCheckInToday ? '✓ Check In Now' : 'Check In'} />
        <ActionBtn color="primary"  onClick={() => setMode('rebook')}            label="Rebook" outline />
      </div>
      <ActionBtn color="red" onClick={() => onUpdate(id, 'cancelled')} label="Cancel" outline />
    </div>
  );

  if (status === 'checked_in') return (
    <div className="flex flex-col gap-2">
      {isCheckOutToday && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-3 py-2 text-xs font-semibold">
          📦 Guest is due to check out today!
        </div>
      )}
      <div className="flex gap-2">
        <ActionBtn color="slate" onClick={() => onUpdate(id, 'checked_out')}  label={isCheckOutToday ? '✓ Check Out Now' : 'Check Out'} />
        <ActionBtn color="green" onClick={() => setMode('extend')}             label="Extend Stay" outline />
      </div>
      <ActionBtn color="red" onClick={() => onUpdate(id, 'cancelled')} label="Cancel" outline />
    </div>
  );

  if (status === 'no_show') return (
    <div className="flex gap-2">
      <ActionBtn color="primary" onClick={() => onUpdate(id, 'confirmed')}  label="Guest Arrived (Undo No-Show)" outline />
      <ActionBtn color="red"     onClick={() => onUpdate(id, 'cancelled')}  label="Cancel Booking" outline />
    </div>
  );

  return null;
}

function ActionBtn({ label, color, onClick, outline = false }: {
  label: string; color: 'primary' | 'green' | 'slate' | 'red'; onClick: () => void; outline?: boolean;
}) {
  const base = 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95';
  const variants = {
    primary: outline ? 'border border-primary text-primary hover:bg-primary/10'  : 'bg-primary text-white hover:opacity-90',
    green:   outline ? 'border border-emerald-400 text-emerald-600 hover:bg-emerald-50' : 'bg-emerald-600 text-white hover:bg-emerald-700',
    slate:   outline ? 'border border-slate-400 text-slate-600 hover:bg-slate-50'       : 'bg-slate-700 text-white hover:bg-slate-800',
    red:     outline ? 'border border-red-300 text-red-500 hover:bg-red-50'             : 'bg-red-600 text-white hover:bg-red-700',
  };
  return <button onClick={onClick} className={`${base} ${variants[color]}`}>{label}</button>;
}

// ─── Payment Confirmation Modal ────────────────────────────────────────────────
function PaymentConfirmModal({
  booking,
  onClose,
  onConfirmed,
}: {
  booking: Booking;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const snap = booking.booking_snapshot as BookingSnapshot | null;
  const amountRequired = snap?.amount_required_now ?? booking.total_price;
  const bookingTotal   = snap?.booking_total       ?? booking.total_price;
  const balanceAmount  = snap?.balance_amount       ?? 0;
  const balanceDue     = snap?.balance_due_date;
  const screenshotUrl  = booking.payment_screenshot_url;

  const [amountPaid, setAmountPaid] = useState<string>(String(amountRequired));
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const paid       = Number(amountPaid) || 0;
  const isShortfall = paid < amountRequired;
  const isFullPay  = paid >= bookingTotal;
  const payType    = isFullPay ? 'full' : 'deposit';

  async function handleConfirm() {
    if (paid <= 0) { setError('Enter the amount paid.'); return; }
    setSubmitting(true);
    setError('');
    try {
      // Find the existing payment_proofs row for this booking, if any
      const { data: proofs } = await (await import('../lib/supabase')).supabase
        .from('payment_proofs')
        .select('id')
        .eq('booking_id', booking.id)
        .order('uploaded_at', { ascending: false })
        .limit(1);

      await confirmPayment({
        bookingId:       booking.id,
        paymentProofId:  proofs?.[0]?.id ?? null,
        paymentType:     payType,
        amountRequired,
        amountPaid:      paid,
        notes,
      });
      onConfirmed();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to confirm payment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-base">Confirm Payment Received</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Screenshot */}
        {screenshotUrl && (
          <div className="px-5 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Payment Screenshot</p>
            <img
              src={screenshotUrl}
              alt="Payment screenshot"
              className="w-full rounded-xl border border-slate-200 object-contain max-h-48"
            />
            <a href={screenshotUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600">
              <ExternalLink size={11} /> Open full size
            </a>
          </div>
        )}

        {/* Amount summary */}
        <div className="px-5 pt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Booking Summary</p>
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-500">Full booking total</span>
              <span className="font-semibold">₱{bookingTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-slate-500">Required now ({snap?.stay_tier ?? '—'} stay)</span>
              <span className="font-semibold text-amber-700">₱{amountRequired.toLocaleString()}</span>
            </div>
            {balanceAmount > 0 && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-slate-500">
                  Balance due{balanceDue ? ` by ${new Date(balanceDue + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}` : ''}
                </span>
                <span className="font-semibold text-slate-600">₱{balanceAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Amount input */}
        <div className="px-5 pt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">
              How much did the guest actually send?
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
              <input
                type="number"
                min="0"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {isShortfall && paid > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              ⚠ Amount is ₱{(amountRequired - paid).toLocaleString()} short of the required amount. Confirm only if you've agreed to a partial payment.
            </div>
          )}
          {isFullPay && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              ✓ Full booking amount received — no balance due.
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">
              Operator notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. GCash ref 1234, guest split payment…"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm resize-none focus:outline-none focus:border-primary"
            />
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || paid <= 0}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Confirming…' : isShortfall ? 'Confirm Partial ⚠' : '✓ Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
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

// ── Admin Delete Modal ────────────────────────────────────────────────────────
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN ?? '2244';

function AdminDeleteModal({
  bookingRef,
  onConfirm,
  onCancel,
}: {
  bookingRef: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin]           = useState('');
  const [showPin, setShowPin]   = useState(false);
  const [error, setError]       = useState('');
  const [step, setStep]         = useState<'auth' | 'confirm'>('auth');

  function handleAuth() {
    if (pin === ADMIN_PIN) {
      setError('');
      setStep('confirm');
    } else {
      setError('Incorrect PIN. Access denied.');
      setPin('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container-lowest rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5"
      >
        {step === 'auth' ? (
          <>
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <ShieldAlert size={24} className="text-red-600" />
              </div>
              <h2 className="text-lg font-extrabold font-headline text-on-surface">Admin Access Required</h2>
              <p className="text-xs text-outline text-center">Enter the admin PIN to permanently delete booking <span className="font-bold text-on-surface">{bookingRef}</span>.</p>
            </div>

            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter admin PIN"
                value={pin}
                onChange={e => { setPin(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                className="w-full px-4 py-3 pr-11 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm text-on-surface focus:outline-none focus:border-red-400 tracking-widest font-bold"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline"
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-600 font-semibold text-center">{error}</p>
            )}

            <div className="flex gap-2">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-outline-variant/40 text-sm font-semibold text-outline hover:bg-surface-container-low transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAuth}
                disabled={!pin}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                Authenticate
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h2 className="text-lg font-extrabold font-headline text-on-surface">Delete Booking?</h2>
              <p className="text-xs text-outline text-center">
                This will <span className="font-bold text-red-600">permanently delete</span> booking <span className="font-bold text-on-surface">{bookingRef}</span> from the database. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-outline-variant/40 text-sm font-semibold text-outline hover:bg-surface-container-low transition-colors">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Delete Forever
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
