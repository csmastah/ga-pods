// ============================================================
// G&A Pods Booking System — TypeScript Types
// ============================================================

/** A room category (Fan, AC Quad, etc.) returned by get_available_room_types() */
export interface RoomType {
  id: string;
  slug: string;
  name: string;
  description: string;
  max_guests: number;
  units_available: number;
  price_per_night: number;
  total_price: number;
  amenities: string[];
  num_nights: number;
}

/** Booking status flow:
 *  pending_payment → payment_submitted → confirmed → checked_in → checked_out
 *  Any status → cancelled | no_show
 */
export type BookingStatus =
  | 'pending_payment'    // Submitted, waiting for GCash payment
  | 'payment_submitted'  // Customer uploaded payment screenshot
  | 'confirmed'          // Manager confirmed payment
  | 'checked_in'         // Guest has arrived
  | 'checked_out'        // Guest has departed
  | 'cancelled'          // Booking was cancelled
  | 'no_show';           // Guest did not arrive

/** Result returned by create_booking() Supabase RPC */
export interface BookingResult {
  success: boolean;
  booking_id: string;
  booking_ref: string;
  room_type_name: string;
  num_nights: number;
  price_per_night: number;
  total_price: number;
  status: BookingStatus;
  check_in: string;   // ISO date string YYYY-MM-DD
  check_out: string;  // ISO date string YYYY-MM-DD
  guest_name: string;
  guest_phone: string;
}

/** Full booking record from the bookings table */
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
  payment_method: string | null;
  payment_reference: string | null;
  payment_confirmed_at: string | null;
  source: string;
  notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
}

/** Settings key-value map loaded from the settings table */
export interface AppSettings {
  checkin_time: string;
  checkout_time: string;
  business_name: string;
  business_location: string;
  gcash_number: string;
  gcash_name: string;
  messenger_link: string;
  confirmation_hours: string;
  pending_expiry_minutes: string;
  confirmation_message: string;
  [key: string]: string;
}

/** Form state for the booking search (Step 1) */
export interface BookingSearchForm {
  checkIn: string;
  checkOut: string;
  guests: number;
}

/** Form state for guest details (Step 3) */
export interface GuestForm {
  name: string;
  phone: string;
  email: string;
  notes: string;
}
