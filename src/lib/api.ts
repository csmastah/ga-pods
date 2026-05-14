import { supabase } from './supabase';
import type { Booking, BookingStatus, Room, RoomType, RoomWithStatus } from './types';

const today = () => new Date().toISOString().split('T')[0];

function isLongTermBlockedRoom(room: Pick<Room, 'room_number' | 'notes'>) {
  const notes = room.notes?.toLowerCase() ?? '';
  return room.room_number === '1D' || notes.includes('long-term') || notes.includes('long_term');
}

function isMaintenanceRoom(room: Pick<Room, 'notes'>) {
  return room.notes?.toLowerCase().includes('maintenance') ?? false;
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function getBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      room:rooms!assigned_room_id(id, room_number, floor, room_type_id),
      room_type:room_types!room_type_id(id, name, slug, price_per_night, max_guests)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Booking[];
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus
): Promise<Booking> {
  const now = new Date().toISOString();
  const updates: Partial<Booking> & { updated_at: string } = { status, updated_at: now };
  if (status === 'confirmed') { updates.confirmed_at = now; updates.payment_confirmed_at = now; }
  if (status === 'on_hold')     updates.on_hold_at    = now;
  if (status === 'cancelled')   updates.cancelled_at  = now;
  if (status === 'expired')     updates.expired_at    = now;

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Booking;
}

// ── Rooms with live occupancy ─────────────────────────────────────────────────

export async function getRoomsWithStatus(): Promise<RoomWithStatus[]> {
  const t = today();

  // Fetch rooms with their type
  const { data: rooms, error: roomsError } = await supabase
    .from('rooms')
    .select(`*, room_type:room_types!room_type_id(*)`)
    .eq('is_active', true)
    .order('floor')
    .order('room_number');

  if (roomsError) throw roomsError;

  // Fetch active bookings for today
  const { data: activeBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*, room_type:room_types!room_type_id(name, slug)')
    .in('status', ['checked_in', 'confirmed', 'pending_payment', 'on_hold'])
    .lte('check_in_date', t)
    .gt('check_out_date', t);

  if (bookingsError) throw bookingsError;

  // Derive occupancy status per room
  return (rooms ?? []).map((room: Room) => {
    if (isLongTermBlockedRoom(room)) {
      return { ...room, occupancy_status: 'long_term' as const, active_booking: null };
    }

    if (isMaintenanceRoom(room)) {
      return { ...room, occupancy_status: 'maintenance' as const, active_booking: null };
    }

    const booking = (activeBookings ?? []).find(
      (b: Booking) => b.assigned_room_id === room.id
    );

    if (!booking) return { ...room, occupancy_status: 'available' as const, active_booking: null };

    const status = booking.status === 'checked_in' ? 'occupied' : 'reserved';
    return { ...room, occupancy_status: status as 'occupied' | 'reserved', active_booking: booking };
  }) as RoomWithStatus[];
}

// ── Room Types ────────────────────────────────────────────────────────────────

export async function getRoomTypes(): Promise<RoomType[]> {
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as RoomType[];
}

// ── Delete booking (admin only) ───────────────────────────────────────────────

export async function deleteBooking(id: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Rebooking ─────────────────────────────────────────────────────────────────

export async function createRebooking(
  original: Booking,
  newCheckIn: string,
  newCheckOut: string
): Promise<Booking> {
  const now = new Date().toISOString();

  // Calculate nights and new total
  const nights = Math.round(
    (new Date(newCheckOut + 'T00:00:00').getTime() - new Date(newCheckIn + 'T00:00:00').getTime()) / 86400000
  );
  const rate = original.price_per_night || original.selected_rooms?.[0]?.rate_per_night || 0;
  const newTotal = nights * rate;

  // Build new booking ref: GA-YYMMDD-XXXX
  const tag = newCheckIn.replace(/-/g, '').slice(2); // YYMMDD
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const newRef = `GA-${tag}-${rand}`;

  // Mark original as rebooked
  const { error: origError } = await supabase
    .from('bookings')
    .update({ status: 'rebooked', rebooked_to_ref: newRef, updated_at: now })
    .eq('id', original.id);
  if (origError) throw origError;

  // Create new booking (confirmed + payment already received)
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_ref:         newRef,
      room_type_id:        original.room_type_id,
      assigned_room_id:    original.assigned_room_id,
      guest_name:          original.guest_name,
      guest_phone:         original.guest_phone,
      guest_email:         original.guest_email,
      num_guests:          original.num_guests,
      check_in_date:       newCheckIn,
      check_out_date:      newCheckOut,
      price_per_night:     rate,
      total_price:         newTotal,
      selected_rooms:      original.selected_rooms ?? null,
      status:              'confirmed',
      payment_method:      original.payment_method,
      payment_confirmed_at: now,
      confirmed_at:        now,
      source:              original.source ?? 'walk_in',
      notes:               original.notes,
      internal_notes:      original.internal_notes,
      rebooked_from_ref:   original.booking_ref,
      created_at:          now,
      updated_at:          now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Booking;
}

// ── Extend stay ───────────────────────────────────────────────────────────────

export async function extendStay(
  booking: Booking,
  newCheckOut: string
): Promise<Booking> {
  const now = new Date().toISOString();
  const nights = Math.round(
    (new Date(newCheckOut + 'T00:00:00').getTime() - new Date(booking.check_in_date + 'T00:00:00').getTime()) / 86400000
  );
  const rate = booking.price_per_night || booking.selected_rooms?.[0]?.rate_per_night || 0;
  const newTotal = nights * rate;

  const { data, error } = await supabase
    .from('bookings')
    .update({ check_out_date: newCheckOut, total_price: newTotal, updated_at: now })
    .eq('id', booking.id)
    .select()
    .single();
  if (error) throw error;
  return data as Booking;
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

export async function getDashboardSummary() {
  const t = today();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('status, check_in_date, check_out_date, assigned_room_id')
    .neq('status', 'cancelled');

  if (error) throw error;

  const todayCheckIns  = (bookings ?? []).filter(b => b.check_in_date  === t && b.status === 'confirmed').length;
  const todayCheckOuts = (bookings ?? []).filter(b => b.check_out_date === t && b.status === 'checked_in').length;
  const activeStays    = (bookings ?? []).filter(b => b.status === 'checked_in').length;

  // Available rooms = total active rooms minus occupied/reserved
  const occupiedRoomIds = new Set(
    (bookings ?? [])
      .filter(b =>
        ['checked_in', 'confirmed', 'pending_payment', 'on_hold'].includes(b.status) &&
        b.check_in_date <= t && b.check_out_date > t &&
        b.assigned_room_id
      )
      .map(b => b.assigned_room_id)
  );

  const { data: roomInventory, error: roomsError } = await supabase
    .from('rooms')
    .select('id, room_number, notes')
    .eq('is_active', true);

  if (roomsError) throw roomsError;

  const totalSellableRooms = (roomInventory ?? []).filter(
    (room) => !isLongTermBlockedRoom(room) && !isMaintenanceRoom(room)
  ).length;

  const availableRooms = Math.max(totalSellableRooms - occupiedRoomIds.size, 0);

  return { todayCheckIns, todayCheckOuts, activeStays, availableRooms };
}
