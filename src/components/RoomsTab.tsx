import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wrench, UserCheck, CalendarClock, Wind, AirVent, Users, RefreshCw, AlertCircle } from 'lucide-react';
import { getRoomsWithStatus } from '../lib/api';
import type { RoomWithStatus, RoomOccupancyStatus } from '../lib/types';

const STATUS_CONFIG: Record<RoomOccupancyStatus, { label: string; color: string; bg: string; dot: string }> = {
  available:   { label: 'Available',   color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  occupied:    { label: 'Occupied',    color: 'text-blue-700',    bg: 'bg-blue-100',    dot: 'bg-blue-500'    },
  reserved:    { label: 'Reserved',    color: 'text-amber-700',   bg: 'bg-amber-100',   dot: 'bg-amber-500'   },
  maintenance: { label: 'Maintenance', color: 'text-red-600',     bg: 'bg-red-100',     dot: 'bg-red-500'     },
};

const FLOOR_FILTERS = [
  { label: 'All Floors', value: 0 },
  { label: 'Floor 1',    value: 1 },
  { label: 'Floor 2',    value: 2 },
];

function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function RoomTypeIcon({ slug }: { slug?: string }) {
  if (slug?.includes('family')) return <Users size={14} className="text-primary" />;
  if (slug?.includes('ac'))     return <AirVent size={14} className="text-primary" />;
  return <Wind size={14} className="text-primary" />;
}

export default function RoomsTab() {
  const [rooms, setRooms]           = useState<RoomWithStatus[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState(0);

  async function load() {
    setLoading(true); setError(null);
    try { setRooms(await getRoomsWithStatus()); }
    catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const floors = floorFilter === 0 ? [1, 2] : [floorFilter];

  const summary = {
    available:   rooms.filter(r => r.occupancy_status === 'available').length,
    occupied:    rooms.filter(r => r.occupancy_status === 'occupied').length,
    reserved:    rooms.filter(r => r.occupancy_status === 'reserved').length,
    maintenance: rooms.filter(r => r.occupancy_status === 'maintenance').length,
  };

  return (
    <div>
      <section className="mb-8">
        <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Overview</p>
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Rooms</h2>
          <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors active:scale-95">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {/* Summary Strip */}
      {!loading && !error && (
        <div className="grid grid-cols-4 gap-2 mb-6">
          <StatusStrip count={summary.available}   label="Free"     dotColor="bg-emerald-500" />
          <StatusStrip count={summary.occupied}    label="In Use"   dotColor="bg-blue-500"    />
          <StatusStrip count={summary.reserved}    label="Reserved" dotColor="bg-amber-500"   />
          <StatusStrip count={summary.maintenance} label="Maint."   dotColor="bg-red-500"     />
        </div>
      )}

      {/* Floor Filter */}
      <div className="flex gap-2 mb-6">
        {FLOOR_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFloorFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold font-label uppercase tracking-wider border transition-all duration-200 ${
              floorFilter === f.value
                ? 'bg-primary text-white border-primary'
                : 'bg-surface-container-low text-outline border-outline-variant/40 hover:border-primary hover:text-primary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-surface-container-low h-36 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-outline mb-4">{error}</p>
          <button onClick={load} className="text-primary font-semibold text-sm hover:underline">Try again</button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {floors.map(floor => {
            const floorRooms = rooms.filter(r => r.floor === floor);
            return (
              <div key={floor}>
                <h3 className="text-xs font-label uppercase tracking-[0.2em] text-outline mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{floor}</span>
                  Floor {floor}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {floorRooms.map(room => <RoomCard key={room.id} room={room} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusStrip({ count, label, dotColor }: { count: number; label: string; dotColor: string }) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-3 text-center">
      <div className={`w-2 h-2 rounded-full ${dotColor} mx-auto mb-1.5`} />
      <p className="text-xl font-extrabold font-headline text-on-surface leading-none">{count}</p>
      <p className="text-[9px] font-label uppercase tracking-wider text-outline mt-0.5">{label}</p>
    </div>
  );
}

function RoomCard({ room }: { room: RoomWithStatus }) {
  const cfg = STATUS_CONFIG[room.occupancy_status];
  const rt  = room.room_type;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-2xl font-extrabold font-headline text-on-surface leading-none">{room.room_number}</p>
          <div className="flex items-center gap-1 mt-1">
            <RoomTypeIcon slug={rt?.slug} />
            <p className="text-[10px] text-outline font-label">{rt?.name ?? '—'}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 ${cfg.bg} ${cfg.color} text-[10px] px-2.5 py-1 rounded-full font-label uppercase tracking-tight shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-outline mb-2">
        <Users size={11} />
        <span>Up to {rt?.max_guests ?? '—'} pax</span>
        <span className="mx-1">·</span>
        <span className="font-semibold text-on-surface">₱{Number(rt?.price_per_night ?? 0).toLocaleString()}/night</span>
      </div>

      {room.active_booking && (
        <div className="bg-surface-container-low rounded-xl px-3 py-2 mt-2">
          <div className="flex items-center gap-1.5 text-xs">
            <UserCheck size={12} className="text-primary shrink-0" />
            <span className="font-semibold text-on-surface truncate">{room.active_booking.guest_name}</span>
          </div>
          {room.active_booking.check_out_date && (
            <div className="flex items-center gap-1.5 text-xs text-outline mt-0.5">
              <CalendarClock size={11} className="shrink-0" />
              <span>Check-out: {formatDate(room.active_booking.check_out_date)}</span>
            </div>
          )}
        </div>
      )}

      {room.occupancy_status === 'maintenance' && (
        <div className="bg-red-50 rounded-xl px-3 py-2 mt-2 flex items-center gap-2 text-xs text-red-600">
          <Wrench size={12} />
          <span>Under maintenance</span>
        </div>
      )}
    </motion.div>
  );
}
