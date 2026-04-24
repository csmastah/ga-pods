/**
 * G and A Pods — Guest Booking Page
 *
 * 4-step booking flow:
 *   Step 1 → Select dates & guest count
 *   Step 2 → Choose room type (availability + pricing from Supabase)
 *   Step 3 → Enter guest details
 *   Step 4 → Confirmation + GCash payment instructions
 *
 * Opened from ManyChat via: https://your-app.com?mode=booking&source=manychat
 * All configurable values (GCash number, check-in time, etc.) are loaded
 * dynamically from the Supabase settings table — no code changes needed.
 */

import { useState, useEffect, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  Calendar,
  Phone,
  User,
  MessageCircle,
  Wifi,
  Wind,
  AirVent,
  Clock,
  Copy,
  CheckCheck,
  MapPin,
  ShieldCheck,
  CreditCard,
  BedDouble,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import type {
  RoomType,
  BookingResult,
  BookingSearchForm,
  GuestForm,
  AppSettings,
} from './types';

type Step = 1 | 2 | 3 | 4;

// ─── Default settings (shown while loading from Supabase) ────────────────────
const DEFAULT_SETTINGS: AppSettings = {
  checkin_time: '14:00',
  checkout_time: '11:00',
  business_name: 'G and A Pods',
  business_location: 'Pinamalayan, Oriental Mindoro',
  gcash_number: '—',
  gcash_name: 'G and A Pods',
  messenger_link: 'https://m.me/',
  confirmation_hours: '1–2',
  pending_expiry_minutes: '30',
  confirmation_message:
    'We will confirm your booking within 1–2 hours after receiving your payment screenshot via Messenger.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPrice(amount: number) {
  return '₱' + amount.toLocaleString('en-PH');
}

function formatTime(time24: string) {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const stayHighlights = [
  'Private pod-style rooms',
  'Wi-Fi and essentials',
  'GCash payment after booking',
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BookingPage() {
  const [step, setStep] = useState<Step>(1);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [search, setSearch] = useState<BookingSearchForm>({ checkIn: '', checkOut: '', adults: 2, children: 0 });
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [guest, setGuest] = useState<GuestForm>({ name: '', phone: '', email: '', notes: '' });
  const [result, setResult] = useState<BookingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Load settings from Supabase ──────────────────────────────
  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .then(({ data }) => {
        if (data) {
          const map: AppSettings = { ...DEFAULT_SETTINGS };
          data.forEach((row) => { map[row.key] = row.value; });
          setSettings(map);
        }
      });
  }, []);

  // ── Pre-fill guests from URL params (ManyChat passes these) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('guests');
    if (g) setSearch((p) => ({ ...p, adults: Math.min(30, Math.max(1, parseInt(g) || 2)) }));
  }, []);

  // ── Date helpers ─────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const minCheckout = search.checkIn
    ? new Date(new Date(search.checkIn).getTime() + 86_400_000).toISOString().split('T')[0]
    : today;

  // ── Step 1 → 2: Check availability ──────────────────────────
  const handleCheckAvailability = async () => {
    if (!search.checkIn || !search.checkOut) {
      setError('Please select both check-in and check-out dates.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('get_available_room_types', {
        p_check_in: search.checkIn,
        p_check_out: search.checkOut,
        p_guests: search.adults + search.children,
      });
      if (rpcErr) throw rpcErr;
      setRooms(data ?? []);
      setStep(2);
    } catch (e: any) {
      setError(e.message ?? 'Failed to check availability. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 → 3: Select room ──────────────────────────────────
  const handleSelectRoom = (room: RoomType) => {
    setSelectedRoom(room);
    setError(null);
    setStep(3);
  };

  // ── Step 3 → 4: Create booking ───────────────────────────────
  const handleConfirmBooking = async () => {
    if (!selectedRoom) return;
    if (!guest.name.trim() || !guest.phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const source = new URLSearchParams(window.location.search).get('source') ?? 'direct';
      const { data, error: rpcErr } = await supabase.rpc('create_booking', {
        p_room_type_id: selectedRoom.id,
        p_guest_name:   guest.name.trim(),
        p_guest_phone:  guest.phone.trim(),
        p_guest_email:  guest.email.trim() || null,
        p_num_guests:   search.adults + search.children,
        p_check_in:     search.checkIn,
        p_check_out:    search.checkOut,
        p_source:       source,
        p_notes:        guest.notes.trim() || null,
      });
      if (rpcErr) throw rpcErr;
      setResult(data as BookingResult);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message ?? 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Copy booking ref to clipboard ────────────────────────────
  const handleCopyRef = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.booking_ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface flex flex-col font-body">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="bg-surface sticky top-0 z-40 px-5 py-4 border-b border-outline-variant/20">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          {step > 1 && step < 4 && (
            <button
              onClick={() => { setStep((step - 1) as Step); setError(null); }}
              className="p-2 rounded-full hover:bg-surface-container-high transition-colors -ml-1"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-outline" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-base font-bold font-headline text-primary leading-none">
              {settings.business_name}
            </h1>
            <p className="text-[11px] text-outline font-label mt-0.5 flex items-center gap-1">
              <MapPin size={10} /> {settings.business_location}
            </p>
          </div>
          {step === 1 && (
            <a
              href={settings.messenger_link}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
              aria-label="Message G and A Pods on Messenger"
            >
              <MessageCircle size={18} />
            </a>
          )}
          {step < 4 && (
            <span className="text-xs text-outline font-label">
              Step {step} of 3
            </span>
          )}
        </div>
      </header>

      {/* ── Progress Bar ────────────────────────────────────────── */}
      {step < 4 && (
        <div className="h-0.5 bg-surface-container-high">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      )}

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 px-5 py-7 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════════════
              STEP 1 — Dates & Guest Count
          ════════════════════════════════════════════════════ */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-5 overflow-hidden rounded-2xl bg-primary text-white shadow-card">
                <div className="min-h-48 bg-[linear-gradient(140deg,rgba(0,52,111,0.92),rgba(0,62,47,0.78)),url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center p-5 flex flex-col justify-end">
                  <p className="text-[11px] font-label uppercase tracking-[0.22em] text-white/75 mb-2">
                    Pinamalayan Stay
                  </p>
                  <h2 className="text-[2rem] font-extrabold font-headline leading-tight">
                    Book a simple, private stay at {settings.business_name}.
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {stayHighlights.map((item) => (
                      <span
                        key={item}
                        className="text-[11px] bg-white/14 border border-white/15 px-2.5 py-1 rounded-full font-label text-white"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-5">
                <StayFact icon={<Clock size={14} />} label="Check-in" value={formatTime(settings.checkin_time)} />
                <StayFact icon={<Clock size={14} />} label="Check-out" value={formatTime(settings.checkout_time)} />
                <StayFact icon={<CreditCard size={14} />} label="Pay Later" value="GCash" />
              </div>

              <div className="bg-tertiary-fixed/25 border border-tertiary/10 rounded-2xl p-4 mb-6">
                <div className="flex gap-3">
                  <ShieldCheck size={18} className="text-tertiary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-on-surface">No payment is taken on this form.</p>
                    <p className="text-xs text-outline mt-1 leading-relaxed">
                      Submit your details first, then pay by GCash and send the screenshot on Messenger to confirm.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">

                {/* Guest Count */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20">
                  <label className="flex items-center gap-1.5 text-[10px] font-label uppercase tracking-widest text-outline mb-4">
                    <Users size={11} /> Number of Guests
                  </label>

                  {/* Adults */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-on-surface mb-1">Adults</p>
                    <p className="text-[10px] text-outline font-label mb-3">12 years old and above · Max 30</p>
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => setSearch((p) => ({ ...p, adults: Math.max(1, p.adults - 1) }))}
                        className="w-11 h-11 rounded-full bg-surface-container-high text-on-surface font-bold text-xl flex items-center justify-center active:scale-95 transition-transform"
                      >
                        −
                      </button>
                      <span className="text-5xl font-extrabold font-headline text-on-surface w-14 text-center tabular-nums">
                        {search.adults}
                      </span>
                      <button
                        onClick={() => setSearch((p) => ({ ...p, adults: Math.min(30, p.adults + 1) }))}
                        className="w-11 h-11 rounded-full bg-primary text-white font-bold text-xl flex items-center justify-center active:scale-95 transition-transform"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-outline-variant/20 pt-4">
                    <p className="text-sm font-semibold text-on-surface mb-1">Children</p>
                    <p className="text-[10px] text-outline font-label mb-3">11 years old and below · Max 4</p>
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => setSearch((p) => ({ ...p, children: Math.max(0, p.children - 1) }))}
                        className="w-11 h-11 rounded-full bg-surface-container-high text-on-surface font-bold text-xl flex items-center justify-center active:scale-95 transition-transform"
                      >
                        −
                      </button>
                      <span className="text-5xl font-extrabold font-headline text-on-surface w-14 text-center tabular-nums">
                        {search.children}
                      </span>
                      <button
                        onClick={() => setSearch((p) => ({ ...p, children: Math.min(4, p.children + 1) }))}
                        className="w-11 h-11 rounded-full bg-primary text-white font-bold text-xl flex items-center justify-center active:scale-95 transition-transform"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Check-in */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20">
                  <label className="flex items-center gap-1.5 text-[10px] font-label uppercase tracking-widest text-outline mb-3">
                    <Calendar size={11} /> Check-in Date
                  </label>
                  <input
                    type="date"
                    min={today}
                    value={search.checkIn}
                    onChange={(e) =>
                      setSearch((p) => ({ ...p, checkIn: e.target.value, checkOut: '' }))
                    }
                    className="w-full text-base font-semibold text-on-surface bg-transparent outline-none"
                  />
                  {search.checkIn && (
                    <p className="text-xs text-outline mt-2 font-label flex items-center gap-1">
                      <Clock size={10} /> Check-in from {formatTime(settings.checkin_time)}
                    </p>
                  )}
                </div>

                {/* Check-out */}
                <div className={`bg-surface-container-lowest rounded-2xl p-5 border transition-colors ${
                  search.checkIn
                    ? 'border-outline-variant/20'
                    : 'border-outline-variant/10 opacity-50'
                }`}>
                  <label className="flex items-center gap-1.5 text-[10px] font-label uppercase tracking-widest text-outline mb-3">
                    <Calendar size={11} /> Check-out Date
                  </label>
                  <input
                    type="date"
                    min={minCheckout}
                    value={search.checkOut}
                    onChange={(e) => setSearch((p) => ({ ...p, checkOut: e.target.value }))}
                    disabled={!search.checkIn}
                    className="w-full text-base font-semibold text-on-surface bg-transparent outline-none disabled:cursor-not-allowed"
                  />
                  {search.checkOut && (
                    <p className="text-xs text-outline mt-2 font-label flex items-center gap-1">
                      <Clock size={10} /> Check-out by {formatTime(settings.checkout_time)}
                    </p>
                  )}
                </div>

                {error && (
                  <p className="text-error text-sm font-label px-1">{error}</p>
                )}

                <button
                  onClick={handleCheckAvailability}
                  disabled={loading || !search.checkIn || !search.checkOut}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-headline font-bold text-base tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  style={{ transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1), opacity 160ms ease' }}
                  onMouseDown={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform='scale(0.97)'; }}
                  onMouseUp={e => (e.currentTarget.style.transform='')}
                  onMouseLeave={e => (e.currentTarget.style.transform='')}
                >
                  {loading ? (
                    <span className="animate-pulse">Checking availability…</span>
                  ) : (
                    <>Check Availability <ArrowRight size={18} /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════
              STEP 2 — Room Selection
          ════════════════════════════════════════════════════ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-6">
                <h2 className="text-[2rem] font-extrabold font-headline text-on-surface leading-tight">
                  Available Rooms
                </h2>
                <p className="text-sm text-outline mt-1.5">
                  {formatDate(search.checkIn)} → {formatDate(search.checkOut)}&nbsp;·&nbsp;
                  {search.adults} adult{search.adults !== 1 ? 's' : ''}
                  {search.children > 0 ? `, ${search.children} child${search.children !== 1 ? 'ren' : ''}` : ''}
                </p>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-4 mb-4 border border-outline-variant/15">
                <div className="flex gap-3">
                  <BedDouble size={18} className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-on-surface">Choose the room that fits your group.</p>
                    <p className="text-xs text-outline mt-1 leading-relaxed">
                      Rates show the full stay total. Your booking is held while G and A Pods verifies payment.
                    </p>
                  </div>
                </div>
              </div>

              {rooms.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">😔</p>
                  <p className="font-headline font-bold text-on-surface text-lg">No rooms available</p>
                  <p className="text-outline text-sm mt-1">
                    Try different dates or reduce the number of guests.
                  </p>
                  <button
                    onClick={() => setStep(1)}
                    className="mt-5 text-primary font-semibold text-sm underline underline-offset-2"
                  >
                    ← Change dates
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {rooms.map((room, idx) => (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: idx * 0.07, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <RoomCard
                        room={room}
                        onSelect={handleSelectRoom}
                      />
                    </motion.div>
                  ))}

                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════
              STEP 3 — Guest Details
          ════════════════════════════════════════════════════ */}
          {step === 3 && selectedRoom && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="mb-6">
                <h2 className="text-[2rem] font-extrabold font-headline text-on-surface leading-tight">
                  Your Details
                </h2>
              </div>

              {/* Booking summary */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-5">
                <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-2">
                  Booking Summary
                </p>
                <p className="font-headline font-bold text-on-surface">{selectedRoom.name}</p>
                <p className="text-sm text-outline mt-0.5">
                  {formatDate(search.checkIn)} → {formatDate(search.checkOut)}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-outline">
                    {selectedRoom.num_nights} night{selectedRoom.num_nights > 1 ? 's' : ''} ×{' '}
                    {formatPrice(selectedRoom.price_per_night)}
                  </p>
                  <p className="text-lg font-extrabold font-headline text-primary">
                    {formatPrice(selectedRoom.total_price)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <InputField
                  icon={<User size={12} />}
                  label="Full Name"
                  required
                  type="text"
                  placeholder="Juan Dela Cruz"
                  value={guest.name}
                  onChange={(v) => setGuest((p) => ({ ...p, name: v }))}
                />
                <InputField
                  icon={<Phone size={12} />}
                  label="Phone / Mobile Number"
                  required
                  type="tel"
                  placeholder="09XX XXX XXXX"
                  value={guest.phone}
                  onChange={(v) => setGuest((p) => ({ ...p, phone: v }))}
                />
                <InputField
                  label="Email"
                  type="email"
                  placeholder="juan@email.com (optional)"
                  value={guest.email}
                  onChange={(v) => setGuest((p) => ({ ...p, email: v }))}
                />
                <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20">
                  <label className="text-[10px] font-label uppercase tracking-widest text-outline block mb-2">
                    Special Requests <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Any requests or notes for your stay…"
                    value={guest.notes}
                    onChange={(e) => setGuest((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full text-sm text-on-surface bg-transparent outline-none resize-none placeholder:text-outline/50"
                  />
                </div>

                {error && (
                  <p className="text-error text-sm font-label px-1">{error}</p>
                )}

                <button
                  onClick={handleConfirmBooking}
                  disabled={loading || !guest.name.trim() || !guest.phone.trim()}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-headline font-bold text-base tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  style={{ transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1), opacity 160ms ease' }}
                  onMouseDown={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform='scale(0.97)'; }}
                  onMouseUp={e => (e.currentTarget.style.transform='')}
                  onMouseLeave={e => (e.currentTarget.style.transform='')}
                >
                  {loading ? (
                    <span className="animate-pulse">Confirming…</span>
                  ) : (
                    <>Confirm Booking <Check size={18} /></>
                  )}
                </button>

                <p className="text-center text-xs text-outline px-2">
                  No payment is taken now. Your room is held after submission, then confirmed once G and A Pods receives your GCash screenshot.
                </p>
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════
              STEP 4 — Confirmation & Payment Instructions
          ════════════════════════════════════════════════════ */}
          {step === 4 && result && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            >
              {/* Success badge */}
              <div className="text-center mb-7">
                <div className="w-20 h-20 bg-tertiary-fixed/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={40} className="text-tertiary" strokeWidth={2.5} />
                </div>
                <h2 className="text-[2rem] font-extrabold font-headline text-on-surface leading-tight">
                  Booking Received!
                </h2>
                <p className="text-outline text-sm mt-1.5">
                  Your room is held for payment. Send your GCash screenshot on Messenger to confirm.
                </p>
              </div>

              {/* Booking ref */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-4 text-center">
                <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1.5">
                  Your Booking Reference
                </p>
                <p className="text-3xl font-extrabold font-headline text-primary tracking-wider">
                  {result.booking_ref}
                </p>
                <button
                  onClick={handleCopyRef}
                  className="mt-2.5 flex items-center gap-1.5 mx-auto text-xs text-outline hover:text-primary transition-colors font-label"
                >
                  {copied ? (
                    <><CheckCheck size={12} className="text-tertiary" /> Copied!</>
                  ) : (
                    <><Copy size={12} /> Copy reference</>
                  )}
                </button>
              </div>

              {/* Stay summary */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 mb-4">
                <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-3">
                  Stay Details
                </p>
                <SummaryRow label="Room"       value={result.room_type_name} />
                <SummaryRow label="Check-in"   value={`${formatDate(result.check_in)} · ${formatTime(settings.checkin_time)}`} />
                <SummaryRow label="Check-out"  value={`${formatDate(result.check_out)} · ${formatTime(settings.checkout_time)}`} />
                <SummaryRow label="Guests" value={`${search.adults} adult${search.adults !== 1 ? 's' : ''}${search.children > 0 ? `, ${search.children} child${search.children !== 1 ? 'ren' : ''}` : ''}`} />
                <SummaryRow label="Nights"     value={`${result.num_nights} night${result.num_nights > 1 ? 's' : ''}`} />
                <SummaryRow label="Rate"       value={`${formatPrice(result.price_per_night)}/night`} />
                <div className="border-t border-outline-variant/20 pt-3 mt-1">
                  <SummaryRow
                    label="Total Amount"
                    value={formatPrice(result.total_price)}
                    valueClass="text-primary font-extrabold text-base"
                  />
                </div>
              </div>

              {/* GCash payment instructions */}
              <div className="bg-surface-container-low rounded-2xl p-5 mb-4">
                <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-3">
                  How to Pay
                </p>
                <p className="text-sm text-on-surface mb-3">
                  Send the exact amount via GCash to the number below:
                </p>
                <div className="bg-surface-container-lowest rounded-xl p-4 space-y-2.5 border border-outline-variant/20">
                  <GCashRow label="GCash Number" value={settings.gcash_number} />
                  <GCashRow label="Account Name"  value={settings.gcash_name} />
                  <GCashRow
                    label="Amount to Send"
                    value={formatPrice(result.total_price)}
                    valueClass="text-primary font-bold"
                  />
                  <GCashRow label="Reference / Memo" value={result.booking_ref} />
                </div>
                <div className="mt-4 bg-primary/5 border border-primary/15 rounded-xl p-3">
                  <p className="text-sm font-semibold text-on-surface mb-1">
                    After paying:
                  </p>
                  <ol className="text-sm text-on-surface space-y-1 list-decimal list-inside">
                    <li>Take a screenshot of your GCash payment confirmation.</li>
                    <li>Send it to us on Facebook Messenger.</li>
                    <li>Include your booking reference: <span className="font-bold text-primary">{result.booking_ref}</span></li>
                  </ol>
                </div>
                <p className="text-xs text-outline mt-3 leading-relaxed">
                  {settings.confirmation_message}
                </p>
              </div>

              {/* Messenger button */}
              <a
                href={settings.messenger_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-4 bg-primary text-white rounded-2xl font-headline font-bold text-base tracking-wide"
                style={{ transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
                onMouseDown={e => (e.currentTarget.style.transform='scale(0.97)')}
                onMouseUp={e => (e.currentTarget.style.transform='')}
                onMouseLeave={e => (e.currentTarget.style.transform='')}
              >
                <MessageCircle size={20} />
                Message Us on Messenger
              </a>

              <p className="text-center text-xs text-outline mt-4 px-2">
                Save your booking reference <span className="font-semibold text-on-surface">{result.booking_ref}</span>.
                You'll need it to check your booking status.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}


// ─── Sub-components ──────────────────────────────────────────────────────────

function RoomCard({ room, onSelect }: { room: RoomType; onSelect: (r: RoomType) => void }) {
  const hasAC = room.amenities?.some((a) => a.toLowerCase().includes('air'));
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 hover:border-primary/30 transition-all overflow-hidden shadow-card">
      <div className="h-28 bg-[linear-gradient(135deg,rgba(0,52,111,0.78),rgba(0,62,47,0.62)),url('https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80')] bg-cover bg-center p-4 flex items-end justify-between">
        <span className="text-[10px] bg-white/90 text-primary px-2.5 py-1 rounded-full font-label uppercase tracking-wide flex items-center gap-1">
          <Sparkles size={10} /> Private Stay
        </span>
        <span className="text-[10px] bg-white/90 text-on-surface px-2.5 py-1 rounded-full font-label uppercase tracking-wide">
          Up to {room.max_guests} guests
        </span>
      </div>
      <div className="p-5">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-headline font-bold text-on-surface text-lg leading-tight pr-2">
          {room.name}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {hasAC ? (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-label uppercase tracking-wide flex items-center gap-1">
              <AirVent size={10} /> AC
            </span>
          ) : (
            <span className="text-[10px] bg-surface-container-high text-outline px-2 py-1 rounded-full font-label uppercase tracking-wide flex items-center gap-1">
              <Wind size={10} /> Fan
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-outline mb-3 leading-relaxed">{room.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {room.amenities?.map((a) => (
          <span
            key={a}
            className="text-[10px] bg-surface-container-high px-2 py-1 rounded-full text-outline font-label flex items-center gap-1"
          >
            {a.toLowerCase().includes('wifi') && <Wifi size={9} />}
            {a}
          </span>
        ))}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-extrabold font-headline text-primary leading-none">
            {('₱' + room.price_per_night.toLocaleString('en-PH'))}
            <span className="text-sm font-normal text-outline">/night</span>
          </p>
          <p className="text-xs text-outline mt-1">
            Total: <span className="font-bold text-on-surface">{formatPrice(room.total_price)}</span>
            {' '}for {room.num_nights} night{room.num_nights > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-outline">Payment instructions after booking</p>
        </div>
        <button
          onClick={() => onSelect(room)}
          className="px-5 py-2.5 bg-primary text-white rounded-xl font-headline font-bold text-sm active:scale-95 transition-transform"
        >
          Select
        </button>
      </div>
      </div>
    </div>
  );
}

function StayFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-3 min-h-24 flex flex-col justify-between">
      <div className="text-primary">{icon}</div>
      <div>
        <p className="text-[10px] text-outline font-label uppercase tracking-wide">{label}</p>
        <p className="text-sm font-bold text-on-surface leading-tight">{value}</p>
      </div>
    </div>
  );
}

function InputField({
  label,
  required,
  type,
  placeholder,
  value,
  onChange,
  icon,
}: {
  label: string;
  required?: boolean;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20">
      <label className="flex items-center gap-1.5 text-[10px] font-label uppercase tracking-widest text-outline mb-2">
        {icon} {label}
        {required && <span className="text-error">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-base font-semibold text-on-surface bg-transparent outline-none placeholder:text-outline/40 placeholder:font-normal"
      />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClass = 'font-semibold text-on-surface',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-start py-1 gap-3">
      <span className="text-sm text-outline shrink-0">{label}</span>
      <span className={`text-sm text-right ${valueClass}`}>{value}</span>
    </div>
  );
}

function GCashRow({
  label,
  value,
  valueClass = 'font-bold text-on-surface',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-xs text-outline">{label}</span>
      <span className={`text-sm ${valueClass}`}>{value}</span>
    </div>
  );
}
