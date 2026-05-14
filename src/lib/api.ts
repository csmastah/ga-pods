import { supabase } from './supabase';
import type { Booking, BookingStatus, Room, RoomType, RoomWithStatus } from './types';

const today = () => new Date().toISOString().split('T')[0];

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
  if (status === 'confirmed')   updates.confirmed_at  = now;
  if (status === 'cancelled')   updates.cancelled_at  = now;

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
    .in('status', ['checked_in', 'confirmed', 'pending_payment'])
    .lte('check_in_date', t)
    .gt('check_out_date', t);

  if (bookingsError) throw bookingsError;

  // Derive occupancy status per room
  return (rooms ?? []).map((room: Room) => {
    if (room.notes?.toLowerCase().includes('maintenance')) {
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
        ['checked_in', 'confirmed', 'pending_payment'].includes(b.status) &&
        b.check_in_date <= t && b.check_out_date > t &&
        b.assigned_room_id
      )
      .map(b => b.assigned_room_id)
  );

  const { count: totalRooms } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const availableRooms = (totalRooms ?? 8) - occupiedRoomIds.size;

  return { todayCheckIns, todayCheckOuts, activeStays, availableRooms };
}
