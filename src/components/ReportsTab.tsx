import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { getBookings } from '../lib/api';
import type { Booking } from '../lib/types';

type Period = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all_time';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'this_month',    label: 'This month' },
  { value: 'last_month',    label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'this_year',     label: 'This year' },
  { value: 'all_time',      label: 'All time' },
];

function getPeriodBounds(period: Period): { start: Date; end: Date } {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  switch (period) {
    case 'this_month':    return { start: new Date(year, month, 1),     end: new Date(year, month + 1, 0, 23, 59, 59) };
    case 'last_month':    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0, 23, 59, 59) };
    case 'last_3_months': return { start: new Date(year, month - 2, 1), end: new Date(year, month + 1, 0, 23, 59, 59) };
    case 'this_year':     return { start: new Date(year, 0, 1),         end: new Date(year, 11, 31, 23, 59, 59) };
    case 'all_time':      return { start: new Date(2020, 0, 1),         end: new Date(2099, 11, 31) };
  }
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

const REVENUE_STATUSES = new Set(['confirmed', 'checked_in', 'checked_out', 'rebooked']);
const TOTAL_ROOMS = 7;

function fmt(n: number) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
}

export default function ReportsTab() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [period, setPeriod]     = useState<Period>('this_month');

  async function load() {
    setLoading(true);
    try { setBookings(await getBookings()); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const { start, end } = getPeriodBounds(period);

  const filtered = bookings.filter(b => {
    const d = new Date(b.created_at);
    return d >= start && d <= end;
  });

  const totalRevenue = filtered
    .filter(b => REVENUE_STATUSES.has(b.status))
    .reduce((sum, b) => sum + (b.total_price ?? 0), 0);

  const pendingRevenue = filtered
    .filter(b => b.status === 'pending_payment' || b.status === 'on_hold')
    .reduce((sum, b) => sum + (b.total_price ?? 0), 0);

  // Revenue by room type
  const revenueByType: Record<string, number> = {};
  filtered.filter(b => REVENUE_STATUSES.has(b.status)).forEach(b => {
    const name = b.room_type?.name ?? 'Unknown';
    revenueByType[name] = (revenueByType[name] ?? 0) + (b.total_price ?? 0);
  });
  const sortedTypes   = Object.entries(revenueByType).sort((a, b) => b[1] - a[1]);
  const maxTypeRev    = sortedTypes[0]?.[1] ?? 1;

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  filtered.forEach(b => { statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1; });
  const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  const activeStays    = bookings.filter(b => b.status === 'checked_in').length;
  const occupancyRate  = Math.round((activeStays / TOTAL_ROOMS) * 100);

  return (
    <div>
      {/* Header */}
      <section className="mb-6">
        <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Analytics</p>
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Reports</h2>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors active:scale-95"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {/* Period filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6" style={{ scrollbarWidth: 'none' }}>
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-label transition-colors ${
              period === opt.value
                ? 'bg-primary text-white'
                : 'bg-surface-container-low text-outline hover:bg-surface-container-high'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Total revenue */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/35">
          <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">Total revenue</p>
          {loading
            ? <div className="h-8 w-24 bg-surface-container-low animate-pulse rounded-lg" />
            : <p className="text-2xl font-extrabold font-headline text-on-surface">{fmt(totalRevenue)}</p>
          }
          <p className="text-[10px] text-outline mt-1">Confirmed bookings</p>
        </div>
        {/* Occupancy */}
        <div className="bg-primary/10 rounded-2xl p-4 border border-primary/15">
          <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">Occupancy</p>
          {loading
            ? <div className="h-8 w-16 bg-surface-container-low animate-pulse rounded-lg" />
            : <p className="text-2xl font-extrabold font-headline text-primary">{occupancyRate}%</p>
          }
          <p className="text-[10px] text-outline mt-1">{activeStays} of {TOTAL_ROOMS} rooms</p>
        </div>
        {/* Total bookings */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/35">
          <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">Total bookings</p>
          {loading
            ? <div className="h-8 w-12 bg-surface-container-low animate-pulse rounded-lg" />
            : <p className="text-2xl font-extrabold font-headline text-on-surface">{filtered.length}</p>
          }
          <p className="text-[10px] text-outline mt-1">In selected period</p>
        </div>
        {/* Pending */}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
          <p className="text-[10px] font-label uppercase tracking-widest text-amber-600 mb-1">Pending</p>
          {loading
            ? <div className="h-8 w-20 bg-amber-100 animate-pulse rounded-lg" />
            : <p className="text-2xl font-extrabold font-headline text-amber-600">{fmt(pendingRevenue)}</p>
          }
          <p className="text-[10px] text-amber-500 mt-1">Awaiting payment</p>
        </div>
      </div>

      {/* Revenue by room type */}
      {!loading && sortedTypes.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/35 p-5 mb-4">
          <p className="text-xs font-label uppercase tracking-[0.2em] text-outline mb-4">Revenue by room type</p>
          <div className="space-y-4">
            {sortedTypes.map(([name, amount]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-on-surface font-body truncate mr-3">{name}</span>
                  <span className="text-primary font-semibold shrink-0">{fmt(amount)}</span>
                </div>
                <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((amount / maxTypeRev) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking status breakdown */}
      {!loading && sortedStatuses.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/35 p-5 mb-4">
          <p className="text-xs font-label uppercase tracking-[0.2em] text-outline mb-4">Status breakdown</p>
          <div className="space-y-3">
            {sortedStatuses.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[status] ?? '#888780' }}
                  />
                  <span className="text-on-surface capitalize">{status.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((count / filtered.length) * 100)}%`,
                        backgroundColor: STATUS_COLORS[status] ?? '#888780',
                      }}
                    />
                  </div>
                  <span className="font-semibold text-on-surface w-5 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-outline">
          <p className="font-headline italic">No bookings in this period</p>
        </div>
      )}
    </div>
  );
}
