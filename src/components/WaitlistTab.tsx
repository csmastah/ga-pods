/**
 * WaitlistTab — shows all waitlist entries, matched to any linked booking
 * by phone number (last 10 digits) + overlapping dates.
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, Link2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Booking } from '../lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaitlistEntry {
  id: string;
  room_id: string;
  priority_rank: number;
  status: 'waiting' | 'notified' | 'claimed' | 'expired' | 'cancelled';
  check_in: string;
  check_out: string;
  guest_name: string | null;
  mobile: string | null;
  email: string | null;
  guest_count: number | null;
  created_at: string;
}

interface EnrichedEntry extends WaitlistEntry {
  linkedBooking: Booking | null;
  deltaAmount: number | null; // >0 means waitlisted room costs more, <0 means it's cheaper
}

// ── Room rate lookup (approximate, based on current base rates) ───────────────
// room_id here matches the slug stored in waitlist_entries (policy-side IDs)
const ROOM_BASE_RATES: Record<string, number> = {
  'fan':             1250,
  'ac-quad':         1350,
  'ac-small-family': 1350,
  'ac-big-family':   1650,
};

// Also accept frontend IDs in case they differ
const ROOM_RATE_ALIASES: Record<string, string> = {
  'fan-room':        'fan',
  'ac-quad-room':    'ac-quad',
  'ac-small-family': 'ac-small-family',
  'ac-big-family':   'ac-big-family',
};

function getRoomRate(roomId: string): number | null {
  const canonical = ROOM_RATE_ALIASES[roomId] ?? roomId;
  return ROOM_BASE_RATES[canonical] ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeMobile(raw: string | null): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '').slice(-10);
}

function datesOverlap(
  aIn: string, aOut: string,
  bIn: string, bOut: string,
): boolean {
  return aIn < bOut && aOut > bIn;
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function formatWlRef(id: string) {
  return `WL-${id.replace(/-/g, '').slice(-8).toUpperCase()}`;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_META: Record<WaitlistEntry['status'], { label: string; color: string; icon: React.ReactNode }> = {
  waiting:   { label: 'Waiting',   color: 'bg-amber-100   text-amber-800',   icon: <Clock size={12} /> },
  notified:  { label: 'Notified',  color: 'bg-blue-100    text-blue-800',    icon: <AlertCircle size={12} /> },
  claimed:   { label: 'Claimed',   color: 'bg-green-100   text-green-800',   icon: <CheckCircle2 size={12} /> },
  expired:   { label: 'Expired',   color: 'bg-gray-100    text-gray-500',    icon: <XCircle size={12} /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-50      text-red-600',     icon: <XCircle size={12} /> },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function WaitlistTab() {
  const [entries, setEntries]   = useState<EnrichedEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState<'all' | 'waiting' | 'notified' | 'claimed' | 'expired' | 'cancelled'>('all');

  async function load() {
    setLoading(true);
    setError('');
    try {
      // Fetch waitlist entries
      const { data: wlData, error: wlError } = await supabase
        .from('waitlist_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (wlError) throw wlError;
      const waitlistRows = (wlData ?? []) as WaitlistEntry[];

      // Fetch recent bookings to cross-link
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('id, booking_ref, guest_name, guest_phone, check_in_date, check_out_date, total_price, selected_rooms, status, booking_snapshot, num_nights')
        .order('created_at', { ascending: false })
        .limit(500);

      if (bookingError) throw bookingError;
      const bookings = (bookingData ?? []) as Booking[];

      // Enrich each waitlist entry
      const enriched: EnrichedEntry[] = waitlistRows.map((entry) => {
        const normalizedWlPhone = normalizeMobile(entry.mobile);

        // Find a booking whose phone matches and dates overlap
        const linked = bookings.find((b) => {
          const normalizedBPhone = normalizeMobile(b.guest_phone);
          if (!normalizedBPhone || !normalizedWlPhone) return false;
          if (normalizedBPhone !== normalizedWlPhone) return false;
          return datesOverlap(entry.check_in, entry.check_out, b.check_in_date, b.check_out_date);
        }) ?? null;

        // Compute delta: waitlisted room total vs what they already booked
        let deltaAmount: number | null = null;
        if (linked) {
          const nights = nightsBetween(entry.check_in, entry.check_out);
          const waitlistRate = getRoomRate(entry.room_id);

          // Get the booked room rate from selected_rooms snapshot (first room entry)
          const bookedRoomRate: number | null = (() => {
            const sel = linked.selected_rooms;
            if (sel && sel.length > 0) return sel[0].rate_per_night;
            // fallback: total / nights
            if (linked.num_nights && linked.total_price) {
              return linked.total_price / linked.num_nights;
            }
            return null;
          })();

          if (waitlistRate !== null && bookedRoomRate !== null) {
            deltaAmount = (waitlistRate - bookedRoomRate) * nights;
          }
        }

        return { ...entry, linkedBooking: linked, deltaAmount };
      });

      setEntries(enriched);
    } catch (err) {
      setError((err as Error).message || 'Could not load waitlist entries.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter);
  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold font-headline text-on-surface">Waitlist</h2>
          <p className="mt-1 text-sm text-outline">
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
            {counts['waiting'] ? ` · ${counts['waiting']} waiting` : ''}
            {counts['notified'] ? ` · ${counts['notified']} notified` : ''}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'waiting', 'notified', 'claimed', 'expired', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors',
              filter === f
                ? 'bg-primary text-white'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high',
            ].join(' ')}
          >
            {f === 'all' ? `All (${entries.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f] ?? 0})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && entries.length === 0 && (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-8 text-center text-sm text-outline">
          Loading waitlist...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-8 text-center text-sm text-outline">
          No waitlist entries{filter !== 'all' ? ` with status "${filter}"` : ''}.
        </div>
      )}

      {/* Entry cards */}
      <div className="space-y-3">
        {filtered.map((entry) => {
          const meta = STATUS_META[entry.status] ?? STATUS_META.waiting;
          const wlRef = formatWlRef(entry.id);
          const nights = nightsBetween(entry.check_in, entry.check_out);

          return (
            <div
              key={entry.id}
              className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface shadow-card"
            >
              {/* Top bar */}
              <div className="flex items-center justify-between gap-3 border-b border-outline-variant/20 bg-surface-container px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.color}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="font-mono text-xs font-bold text-outline">{wlRef}</span>
                </div>
                <span className="text-xs text-outline">
                  #{entry.priority_rank} in queue
                </span>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Left: waitlist details */}
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Room requested</p>
                      <p className="font-bold text-on-surface capitalize">{entry.room_id.replace(/-/g, ' ')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Dates</p>
                      <p className="font-bold text-on-surface">
                        {formatDateShort(entry.check_in)} → {formatDateShort(entry.check_out)}
                        <span className="ml-1 font-normal text-outline">({nights} night{nights === 1 ? '' : 's'})</span>
                      </p>
                    </div>
                    {entry.guest_name && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Guest</p>
                        <p className="font-bold text-on-surface">{entry.guest_name}</p>
                        {entry.mobile && <p className="text-sm text-outline">{entry.mobile}</p>}
                        {entry.email && <p className="text-xs text-outline">{entry.email}</p>}
                      </div>
                    )}
                    {entry.guest_count != null && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Guest count</p>
                        <p className="font-bold text-on-surface">{entry.guest_count}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Joined waitlist</p>
                      <p className="text-sm text-on-surface">
                        {new Date(entry.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Right: linked booking */}
                  <div>
                    {entry.linkedBooking ? (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
                          <Link2 size={11} /> Linked booking found
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Booking ref</p>
                          <p className="font-mono font-bold text-on-surface">{entry.linkedBooking.booking_ref}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Booked room</p>
                          <p className="text-sm font-bold text-on-surface">
                            {entry.linkedBooking.selected_rooms && entry.linkedBooking.selected_rooms.length > 0
                              ? entry.linkedBooking.selected_rooms.map((r) => `${r.quantity > 1 ? r.quantity + '× ' : ''}${r.room_name}`).join(', ')
                              : 'See booking details'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Amount paid / to pay</p>
                          <p className="font-bold text-on-surface">{peso.format(entry.linkedBooking.total_price)}</p>
                        </div>
                        {entry.deltaAmount !== null && (
                          <div className={`rounded-lg p-2.5 ${entry.deltaAmount > 0 ? 'bg-amber-50 border border-amber-200' : entry.deltaAmount < 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-outline">
                              {entry.deltaAmount > 0 ? 'Additional payment to switch' : entry.deltaAmount < 0 ? 'Refund if switched' : 'Same price — no change'}
                            </p>
                            {entry.deltaAmount !== 0 && (
                              <p className={`mt-1 font-extrabold text-base font-headline ${entry.deltaAmount > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                {entry.deltaAmount > 0 ? '+ ' : '− '}{peso.format(Math.abs(entry.deltaAmount))}
                              </p>
                            )}
                            <p className="mt-0.5 text-[10px] text-outline">
                              Estimate based on base rates · {nights} night{nights === 1 ? '' : 's'}
                            </p>
                          </div>
                        )}
                        <a
                          href={`/bookings?ref=${entry.linkedBooking.booking_ref}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                          onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/bookings'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                        >
                          View booking <ArrowRight size={11} />
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-3 text-sm text-outline">
                        <p className="font-bold text-on-surface/60">No linked booking found</p>
                        <p className="mt-1 text-xs">
                          {entry.mobile
                            ? 'No booking with this phone number and overlapping dates.'
                            : 'No phone number provided — cannot match.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
