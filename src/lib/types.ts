// ─────────────────────────────────────────────
//  G and A Pods — TypeScript types (real Supabase schema)
// ─────────────────────────────────────────────

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';

export interface RoomType {
  id: string;
  slug: string;
  name: string;
  description: string;
  max_guests: number;
  total_units: number;
  price_per_night: number;
  price_per_night_extended: number | null;
  extended_stay_threshold: number | null;
  amenities: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Room {
  id: string;
  room_type_id: string;
  room_number: string;
  floor: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  // Joined
  room_type?: RoomType;
}

export interface Booking {
  id: string;
  booking_ref: string;
  room_type_id: string;
  assigned_room_id: string | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  num_guests: number;
  check_in_date: string;
  check_out_date: string;
  num_nights: number;
  price_per_night: number;
  total_price: number;
  status: BookingStatus;
  payment_method: 'gcash' | 'cash' | null;
  payment_reference: string | null;
  payment_confirmed_at: string | null;
  source: string;
  notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  // Joined
  room?: Room | null;
  room_type?: RoomType | null;
}

// Room enriched with live occupancy status
export type RoomOccupancyStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface RoomWithStatus extends Room {
  occupancy_status: RoomOccupancyStatus;
  active_booking?: Booking | null;
}
