import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getBookings } from '../lib/api';
import type { Booking } from '../lib/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ROOM_COLORS: Record<string, string> = {
  '1A': 'bg-blue-400',
  '1B': 'bg-violet-400',
  '1C': 'bg-pink-400',
  '1D': 'bg-rose-400',
  '2A': 'bg-emerald-400',
  '2B': 'bg-amber-400',
  '2C': 'bg-teal-400',
  '2D': 'bg-cyan-400',
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function CalendarTab() {
  const [bookings, setBookings]     = useState<Booking[]>([]);
  const [loading, setLoading]       = useState(true);
  const [viewDate, setViewDate]     = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(todayISO());

  async function load() {
    setLoading(true);
    try { setBookings(await getBookings()); }
    catch { /* silent fail — show empty calendar */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthLabel = viewDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const today = todayISO();

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function bookingsForDate(dateStr: string) {
    return bookings.filter(b =>
      b.status !== 'cancelled' &&
      b.check_in_date <= dateStr &&
      b.check_out_date > dateStr
    );
  }

  const selectedBookings = selectedDate ? bookingsForDate(selectedDate) : [];

  // Unique room colors used this month for legend
  const activeRoomNumbers = [...new Set(
    bookings
      .filter(b => b.status !== 'cancelled' && b.room?.room_number)
      .map(b => b.room!.room_number)
  )];

  return (
    <div>
      <section className="mb-8">
        <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Schedule</p>
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Calendar</h2>
          <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors active:scale-95">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {/* Month Navigator */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-95"
        >
          <ChevronLeft size={18} className="text-outline" />
        </button>
        <span className="font-bold font-headline text-on-surface">{monthLabel}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-95"
        >
          <ChevronRight size={18} className="text-outline" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-label uppercase tracking-wider text-outline py-1">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr      = isoDate(year, month, day);
          const dayBookings  = bookingsForDate(dateStr);
          const isToday      = dateStr === today;
          const isSelected   = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all active:scale-95 ${
                isSelected ? 'bg-primary text-white' :
                isToday    ? 'bg-primary/10 text-primary' :
                'hover:bg-surface-container-high text-on-surface'
              }`}
            >
              <span className={`text-sm font-bold font-headline leading-none ${isSelected ? 'text-white' : isToday ? 'text-primary' : 'text-on-surface'}`}>
                {day}
              </span>
              {dayBookings.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[28px]">
                  {dayBookings.slice(0, 3).map(b => (
                    <span
                      key={b.id}
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : ROOM_COLORS[b.room?.room_number ?? ''] ?? 'bg-primary'}`}
                    />
                  ))}
                  {dayBookings.length > 3 && (
                    <span className={`text-[8px] font-bold leading-none mt-px ${isSelected ? 'text-white/80' : 'text-outline'}`}>
                      +{dayBookings.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Bookings */}
      {selectedDate && (
        <div className="mt-6">
          <h3 className="text-xs font-label uppercase tracking-[0.2em] text-outline mb-3">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-14 rounded-2xl bg-surface-container-low animate-pulse" />)}
            </div>
          ) : selectedBookings.length === 0 ? (
            <div className="text-center py-10 text-outline">
              <p className="font-headline italic">No bookings on this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedBookings.map(b => (
                <div key={b.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 px-4 py-3 flex items-center gap-3 shadow-sm">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${ROOM_COLORS[b.room?.room_number ?? ''] ?? 'bg-primary'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-on-surface truncate">{b.guest_name}</p>
                    <p className="text-xs text-outline">
                      Room {b.room?.room_number ?? '—'} · {b.room_type?.name ?? '—'} · {b.num_guests} pax
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-outline">
                      {new Date(b.check_in_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      {' → '}
                      {new Date(b.check_out_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </p>
                    <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-label uppercase tracking-tight ${
                      b.status === 'checked_in'      ? 'bg-emerald-100 text-emerald-700' :
                      b.status === 'confirmed'       ? 'bg-blue-100 text-blue-700' :
                      b.status === 'pending_payment' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Room Legend */}
      {activeRoomNumbers.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-label uppercase tracking-[0.2em] text-outline mb-3">Room Legend</p>
          <div className="grid grid-cols-4 gap-2">
            {activeRoomNumbers.map(rn => (
              <div key={rn} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ROOM_COLORS[rn] ?? 'bg-primary'}`} />
                <span className="text-xs text-outline font-label">{rn}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
