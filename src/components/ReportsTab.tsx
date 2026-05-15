import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, Users, Repeat2, Clock, TrendingUp } from 'lucide-react';
import { getBookings } from '../lib/api';
import type { Booking } from '../lib/types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const TOTAL_ROOMS = 7;
const REVENUE_STATUSES = new Set(['confirmed', 'checked_in', 'checked_out', 'rebooked']);
const DAYS_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
}
function pct(n: number, total: number) {
  if (!total) return '0%';
  return Math.round((n / total) * 100) + '%';
}

const STATUS_COLORS: Record<string, string> = {
  confirmed:       '#378ADD',
  checked_in:      '#639922',
  checked_out:     '#888780',
  pending_payment: '#EF9F27',
  on_hold:         '#D85A30',
  cancelled:       '#E24B4A',
  expired:         '#E24B4A',
  rebooked:        '#7F77DD',
};

// ─── types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'quarter' | 'year' | 'all';

// ─── component ────────────────────────────────────────────────────────────────

export default function ReportsTab() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  // Specific month view: tracks year + month index
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  async function load() {
    setLoading(true);
    try { setBookings(await getBookings()); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  // ── filter bookings to the selected period (by created_at) ──────────────────
  const filtered = useMemo(() => {
    let start: Date, end: Date;
    const now = new Date();
    if (viewMode === 'month') {
      start = new Date(viewYear, viewMonth, 1);
      end   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59);
    } else if (viewMode === 'quarter') {
      const qStart = viewMonth - (viewMonth % 3);
      start = new Date(viewYear, qStart, 1);
      end   = new Date(viewYear, qStart + 3, 0, 23, 59, 59);
    } else if (viewMode === 'year') {
      start = new Date(viewYear, 0, 1);
      end   = new Date(viewYear, 11, 31, 23, 59, 59);
    } else {
      return bookings; // all time
    }
    return bookings.filter(b => {
      const d = new Date(b.created_at);
      return d >= start && d <= end;
    });
  }, [bookings, viewMode, viewYear, viewMonth]);

  // ── key metrics ───────────────────────────────────────────────────────────────
  const revenue        = filtered.filter(b => REVENUE_STATUSES.has(b.status)).reduce((s, b) => s + (b.total_price ?? 0), 0);
  const pending        = filtered.filter(b => b.status === 'pending_payment' || b.status === 'on_hold').reduce((s, b) => s + (b.total_price ?? 0), 0);
  const cancelled      = filtered.filter(b => b.status === 'cancelled' || b.status === 'expired').length;
  const cancelRate     = pct(cancelled, filtered.length);
  const avgValue       = filtered.length ? Math.round(revenue / Math.max(filtered.filter(b => REVENUE_STATUSES.has(b.status)).length, 1)) : 0;
  const avgNights      = filtered.length ? +(filtered.reduce((s, b) => s + (b.num_nights ?? 0), 0) / filtered.length).toFixed(1) : 0;
  const activeStays    = bookings.filter(b => b.status === 'checked_in').length;
  const occupancyRate  = Math.round((activeStays / TOTAL_ROOMS) * 100);

  // ── returning guests (across ALL bookings, not just filtered period) ──────────
  const guestMap: Record<string, { name: string; count: number; lastBooking: string }> = {};
  bookings.forEach(b => {
    const key = b.guest_phone?.trim() || b.guest_name;
    if (!guestMap[key]) {
      guestMap[key] = { name: b.guest_name, count: 0, lastBooking: b.created_at };
    }
    guestMap[key].count++;
    if (b.created_at > guestMap[key].lastBooking) guestMap[key].lastBooking = b.created_at;
  });
  const returningGuests = Object.values(guestMap)
    .filter(g => g.count >= 2)
    .sort((a, b) => b.count - a.count);

  // ── when do guests book? (day-of-week + hour from created_at) ────────────────
  const dowCounts  = Array(7).fill(0);
  const hourCounts = Array(24).fill(0);
  filtered.forEach(b => {
    const d = new Date(b.created_at);
    dowCounts[d.getDay()]++;
    hourCounts[d.getHours()]++;
  });
  const maxDow  = Math.max(...dowCounts,  1);
  const maxHour = Math.max(...hourCounts, 1);

  // ── peak check-in months (all bookings, by check_in_date month) ──────────────
  const checkinByMonth = Array(12).fill(0);
  bookings.forEach(b => {
    if (b.check_in_date) {
      checkinByMonth[new Date(b.check_in_date + 'T00:00:00').getMonth()]++;
    }
  });
  const maxCheckin = Math.max(...checkinByMonth, 1);

  // ── revenue by room type ──────────────────────────────────────────────────────
  const revenueByType: Record<string, number> = {};
  filtered.filter(b => REVENUE_STATUSES.has(b.status)).forEach(b => {
    const name = b.room_type?.name ?? 'Unknown';
    revenueByType[name] = (revenueByType[name] ?? 0) + (b.total_price ?? 0);
  });
  const sortedTypes = Object.entries(revenueByType).sort((a, b) => b[1] - a[1]);
  const maxTypeRev  = sortedTypes[0]?.[1] ?? 1;

  // ── status breakdown ──────────────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  filtered.forEach(b => { statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1; });
  const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  // ── payment method split ──────────────────────────────────────────────────────
  const pmCounts: Record<string, number> = {};
  filtered.forEach(b => {
    const pm = b.payment_method ?? 'unknown';
    pmCounts[pm] = (pmCounts[pm] ?? 0) + 1;
  });
  const pmLabels: Record<string, string> = {
    gcash_maya: 'GCash / Maya', gcash: 'GCash', maya: 'Maya', cash: 'Cash', unknown: 'Not specified',
  };

  // ── period label ─────────────────────────────────────────────────────────────
  const periodLabel = viewMode === 'month'
    ? `${MONTHS_SHORT[viewMonth]} ${viewYear}`
    : viewMode === 'quarter'
    ? `Q${Math.floor(viewMonth / 3) + 1} ${viewYear}`
    : viewMode === 'year'
    ? String(viewYear)
    : 'All time';

  function prevPeriod() {
    if (viewMode === 'month') {
      if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
      else setViewMonth(m => m - 1);
    } else if (viewMode === 'quarter') {
      const qStart = viewMonth - (viewMonth % 3);
      if (qStart === 0) { setViewYear(y => y - 1); setViewMonth(9); }
      else setViewMonth(qStart - 3);
    } else if (viewMode === 'year') {
      setViewYear(y => y - 1);
    }
  }
  function nextPeriod() {
    const now = new Date();
    if (viewMode === 'month') {
      if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
      else setViewMonth(m => m + 1);
    } else if (viewMode === 'quarter') {
      const qStart = viewMonth - (viewMonth % 3);
      if (qStart === 9) { setViewYear(y => y + 1); setViewMonth(0); }
      else setViewMonth(qStart + 3);
    } else if (viewMode === 'year') {
      setViewYear(y => y + 1);
    }
  }

  const canGoNext = viewMode !== 'all' && (() => {
    const now = new Date();
    if (viewMode === 'month') return !(viewYear === now.getFullYear() && viewMonth >= now.getMonth());
    if (viewMode === 'quarter') return !(viewYear === now.getFullYear() && viewMonth + 3 > now.getMonth());
    if (viewMode === 'year') return viewYear < now.getFullYear();
    return false;
  })();

  // ── group bookings by guest for group size ───────────────────────────────────
  const guestSizeBuckets = { '1': 0, '2': 0, '3–4': 0, '5+': 0 };
  filtered.forEach(b => {
    const n = b.num_guests ?? 1;
    if (n === 1)     guestSizeBuckets['1']++;
    else if (n === 2) guestSizeBuckets['2']++;
    else if (n <= 4)  guestSizeBuckets['3–4']++;
    else              guestSizeBuckets['5+']++;
  });
  const maxGuestBucket = Math.max(...Object.values(guestSizeBuckets), 1);

  return (
    <div>
      {/* Header */}
      <section className="mb-5">
        <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Analytics</p>
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Reports</h2>
          <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors active:scale-95">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {/* View mode pills */}
      <div className="flex gap-2 mb-4">
        {(['month','quarter','year','all'] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`px-3 py-1 rounded-full text-xs font-label capitalize transition-colors ${
              viewMode === m ? 'bg-primary text-white' : 'bg-surface-container-low text-outline hover:bg-surface-container-high'
            }`}
          >{m === 'all' ? 'All time' : m}</button>
        ))}
      </div>

      {/* Period navigator */}
      {viewMode !== 'all' && (
        <div className="flex items-center justify-between mb-5 bg-surface-container-lowest rounded-2xl px-4 py-3 border border-outline-variant/35">
          <button onClick={prevPeriod} className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high active:scale-95">
            <ChevronLeft size={16} className="text-outline" />
          </button>
          <span className="font-bold font-headline text-on-surface">{periodLabel}</span>
          <button onClick={nextPeriod} disabled={!canGoNext}
            className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 ${canGoNext ? 'bg-surface-container-low hover:bg-surface-container-high' : 'opacity-30 pointer-events-none'}`}>
            <ChevronRight size={16} className="text-outline" />
          </button>
        </div>
      )}

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Metric label="Revenue" value={loading ? '—' : fmt(revenue)} sub="Confirmed bookings" accent />
        <Metric label="Occupancy" value={loading ? '—' : `${occupancyRate}%`} sub={`${activeStays} of ${TOTAL_ROOMS} rooms`} color="primary" />
        <Metric label="Bookings" value={loading ? '—' : String(filtered.length)} sub={`${cancelRate} cancellation rate`} />
        <Metric label="Pending" value={loading ? '—' : fmt(pending)} sub="Awaiting payment" color="amber" />
        <Metric label="Avg booking value" value={loading ? '—' : fmt(avgValue)} sub="Per confirmed stay" />
        <Metric label="Avg stay" value={loading ? '—' : `${avgNights}n`} sub="Nights per booking" />
        <Metric label="Returning guests" value={loading ? '—' : String(returningGuests.length)} sub="Booked 2+ times" color="violet" />
        <Metric label="Cancellations" value={loading ? '—' : String(cancelled)} sub={`${cancelRate} of period`} color="red" />
      </div>

      {/* ── Revenue by room type ── */}
      {!loading && sortedTypes.length > 0 && (
        <Card title="Revenue by room type">
          <div className="space-y-4">
            {sortedTypes.map(([name, amount]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-on-surface truncate mr-3">{name}</span>
                  <span className="text-primary font-semibold shrink-0">{fmt(amount)}</span>
                </div>
                <Bar fill={Math.round((amount / maxTypeRev) * 100)} color="bg-primary" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── When do guests book? ── */}
      {!loading && filtered.length > 0 && (
        <Card title="When do guests book?">
          <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-3">Day of week</p>
          <div className="grid grid-cols-7 gap-1 mb-5">
            {DAYS_SHORT.map((day, i) => (
              <div key={day} className="flex flex-col items-center gap-1">
                <div className="w-full rounded-sm overflow-hidden bg-surface-container-low" style={{ height: 48 }}>
                  <div
                    className="w-full bg-primary rounded-sm transition-all duration-500"
                    style={{ height: `${Math.round((dowCounts[i] / maxDow) * 100)}%`, marginTop: 'auto', display: 'block' }}
                  />
                </div>
                <span className="text-[9px] font-label text-outline">{day}</span>
                <span className="text-[10px] font-semibold text-on-surface">{dowCounts[i]}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-3">Time of day (hour)</p>
          <div className="flex items-end gap-0.5" style={{ height: 36 }}>
            {hourCounts.map((count, h) => (
              <div key={h} title={`${h}:00 — ${count}`}
                className="flex-1 bg-secondary rounded-sm transition-all duration-500"
                style={{ height: `${Math.round((count / maxHour) * 100)}%`, minHeight: count > 0 ? 3 : 0 }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-outline">12am</span>
            <span className="text-[9px] text-outline">6am</span>
            <span className="text-[9px] text-outline">12pm</span>
            <span className="text-[9px] text-outline">6pm</span>
            <span className="text-[9px] text-outline">11pm</span>
          </div>
        </Card>
      )}

      {/* ── Peak check-in months (all time) ── */}
      {!loading && bookings.length > 0 && (
        <Card title="Peak check-in months" subtitle="All bookings — by check-in date">
          <div className="flex items-end gap-1" style={{ height: 56 }}>
            {MONTHS_SHORT.map((mo, i) => (
              <div key={mo} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full bg-surface-container-low rounded-sm overflow-hidden" style={{ height: 44 }}>
                  <div
                    className="w-full bg-tertiary rounded-sm transition-all duration-500"
                    style={{ height: `${Math.round((checkinByMonth[i] / maxCheckin) * 100)}%`, marginTop: 'auto', display: 'block' }}
                  />
                </div>
                <span className="text-[8px] font-label text-outline">{mo}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Returning guests ── */}
      {!loading && returningGuests.length > 0 && (
        <Card title="Returning guests" subtitle="Guests who booked 2 or more times">
          <div className="space-y-2">
            {returningGuests.slice(0, 8).map((g, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-extrabold font-headline shrink-0">
                    {g.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface leading-tight">{g.name}</p>
                    <p className="text-[10px] text-outline">Last booked {g.lastBooking.split('T')[0]}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {g.count}× stays
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Guest group size ── */}
      {!loading && filtered.length > 0 && (
        <Card title="Guest group size">
          <div className="space-y-3">
            {(Object.entries(guestSizeBuckets) as [string, number][]).map(([label, count]) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-on-surface">{label === '1' ? '1 guest (solo)' : label === '2' ? '2 guests (couple)' : `${label} guests`}</span>
                  <span className="text-outline">{count} booking{count !== 1 ? 's' : ''} · {pct(count, filtered.length)}</span>
                </div>
                <Bar fill={Math.round((count / maxGuestBucket) * 100)} color="bg-secondary" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Payment method split ── */}
      {!loading && Object.keys(pmCounts).length > 0 && (
        <Card title="Payment method">
          <div className="space-y-3">
            {Object.entries(pmCounts).sort((a, b) => b[1] - a[1]).map(([pm, count]) => (
              <div key={pm} className="flex items-center justify-between text-sm">
                <span className="text-on-surface">{pmLabels[pm] ?? pm}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: pct(count, filtered.length) }} />
                  </div>
                  <span className="text-outline w-8 text-right text-xs">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Booking status breakdown ── */}
      {!loading && sortedStatuses.length > 0 && (
        <Card title="Status breakdown">
          <div className="space-y-3">
            {sortedStatuses.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status] ?? '#888780' }} />
                  <span className="text-on-surface capitalize">{status.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: pct(count, filtered.length), backgroundColor: STATUS_COLORS[status] ?? '#888780' }} />
                  </div>
                  <span className="font-semibold text-on-surface w-5 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-outline">
          <p className="font-headline italic">No bookings in this period</p>
        </div>
      )}
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Metric({ label, value, sub, accent, color }: {
  label: string; value: string; sub?: string;
  accent?: boolean; color?: 'primary' | 'amber' | 'violet' | 'red';
}) {
  const bg   = accent ? 'bg-primary/10 border-primary/15' : 'bg-surface-container-lowest border-outline-variant/35';
  const valC = color === 'primary' ? 'text-primary'
             : color === 'amber'   ? 'text-amber-600'
             : color === 'violet'  ? 'text-violet-600'
             : color === 'red'     ? 'text-red-500'
             : accent              ? 'text-primary'
             : 'text-on-surface';
  const subC = color === 'amber' ? 'text-amber-400' : 'text-outline';
  return (
    <div className={`rounded-2xl p-4 border ${bg}`}>
      <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">{label}</p>
      <p className={`text-2xl font-extrabold font-headline ${valC}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-1 ${subC}`}>{sub}</p>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/35 p-5 mb-4">
      <div className="mb-4">
        <p className="text-xs font-label uppercase tracking-[0.2em] text-outline">{title}</p>
        {subtitle && <p className="text-[10px] text-outline/60 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Bar({ fill, color = 'bg-primary' }: { fill: number; color?: string }) {
  return (
    <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${fill}%` }} />
    </div>
  );
}
