import { useState, useEffect, ReactNode } from 'react';
import { motion } from 'motion/react';
import { Smartphone, Banknote, TrendingUp, Clock, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { getBookings } from '../lib/api';
import type { Booking } from '../lib/types';

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatPeso(n: number) {
  return '₱' + Number(n).toLocaleString('en-PH');
}

type PaymentRecord = {
  id: string;
  guestName: string;
  roomNumber: string;
  amount: number;
  date: string;
  method: string;
  status: 'paid' | 'pending';
  reference?: string | null;
  bookingRef: string;
};

function bookingToPayment(b: Booking): PaymentRecord {
  return {
    id: b.id,
    guestName: b.guest_name,
    roomNumber: b.room?.room_number ?? '—',
    amount: Number(b.total_price),
    date: b.payment_confirmed_at ? b.payment_confirmed_at.split('T')[0] : b.created_at.split('T')[0],
    method: b.payment_method ?? 'gcash',
    status: b.payment_confirmed_at ? 'paid' : 'pending',
    reference: b.payment_reference,
    bookingRef: b.booking_ref,
  };
}

function groupByMonth(list: PaymentRecord[]): Record<string, PaymentRecord[]> {
  return list.reduce<Record<string, PaymentRecord[]>>((acc, p) => {
    const d = new Date(p.date + 'T00:00:00');
    const key = d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});
}

function SummaryCard({ label, value, icon, bg, valueColor }: {
  label: string; value: string; icon: ReactNode; bg: string; valueColor: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-4`}>
      <div className="mb-2">{icon}</div>
      <p className={`text-base font-extrabold font-headline ${valueColor} leading-tight`}>{value}</p>
      <p className="text-[9px] font-label uppercase tracking-widest text-outline mt-0.5">{label}</p>
    </div>
  );
}

function PaymentRow({ p }: { p: PaymentRecord }) {
  const isGcash = p.method === 'gcash';
  const isPaid  = p.status === 'paid';

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 px-4 py-3.5 flex items-center gap-3 shadow-sm"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isGcash ? 'bg-blue-50' : 'bg-emerald-50'}`}>
        {isGcash ? <Smartphone size={18} className="text-blue-600" /> : <Banknote size={18} className="text-emerald-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-on-surface truncate">{p.guestName}</p>
        <div className="flex items-center gap-1.5 text-xs text-outline mt-0.5 flex-wrap">
          <span>Room {p.roomNumber}</span>
          <span>·</span>
          <span>{formatDate(p.date)}</span>
          <span>·</span>
          <span className="font-mono text-[10px]">{p.bookingRef}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-extrabold text-sm text-on-surface">{formatPeso(p.amount)}</p>
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-label uppercase tracking-tight mt-1 ${
          isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isPaid ? <CheckCircle2 size={10} /> : <Clock size={10} />}
          {isPaid ? 'Paid' : 'Pending'}
        </span>
      </div>
    </motion.div>
  );
}

export default function PaymentsTab() {
  const [records, setRecords]   = useState<PaymentRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const bookings = await getBookings();
      const filtered = bookings.filter(b => b.status !== 'cancelled');
      setRecords(filtered.map(bookingToPayment).sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const totalPaid    = records.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = records.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const grandTotal   = totalPaid + totalPending;
  const grouped      = groupByMonth(records);

  return (
    <div>
      <section className="mb-8">
        <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Finance</p>
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Payments</h2>
          <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-surface-container-high text-outline transition-colors active:scale-95">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </section>

      {/* Summary Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          <SummaryCard label="Total"       value={formatPeso(grandTotal)} icon={<TrendingUp size={16} className="text-emerald-600" />}  bg="bg-emerald-50" valueColor="text-emerald-700" />
          <SummaryCard label="Confirmed"   value={formatPeso(totalPaid)}  icon={<CheckCircle2 size={16} className="text-blue-600" />}    bg="bg-blue-50"    valueColor="text-blue-700"    />
          <SummaryCard label="Pending"     value={formatPeso(totalPending)} icon={<Clock size={16} className="text-amber-600" />}        bg="bg-amber-50"   valueColor="text-amber-700"   />
        </div>
      )}

      {loading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-surface-container-low animate-pulse" />)}</div>}

      {!loading && error && (
        <div className="text-center py-12">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-outline mb-4">{error}</p>
          <button onClick={load} className="text-primary font-semibold text-sm hover:underline">Try again</button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, entries]) => {
            const monthTotal = entries.reduce((s, p) => s + p.amount, 0);
            return (
              <div key={month}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-label uppercase tracking-[0.2em] text-outline">{month}</h3>
                  <span className="text-sm font-bold text-on-surface">{formatPeso(monthTotal)}</span>
                </div>
                <div className="space-y-2">
                  {entries.map(p => <PaymentRow key={p.id} p={p} />)}
                </div>
              </div>
            );
          })}
          {records.length === 0 && (
            <div className="text-center py-16 text-outline">
              <p className="font-headline italic">No payment records yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
