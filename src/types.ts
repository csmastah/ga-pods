// ============================================================
// G and A Pods Booking System — TypeScript Types
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

/** Booking status flow (Phase 1 engine):
 *  awaiting_payment → payment_submitted → under_review → confirmed → checked_in → checked_out
 *  Any active status → cancelled | expired | no_show
 *  Legacy: pending_payment (= awaiting_payment), on_hold (= payment_submitted / under_review)
 */
export type BookingStatus =
  | 'pending_payment'    // legacy: unpaid hold (pre-rule-engine bookings)
  | 'on_hold'            // legacy: screenshot uploaded, staff reviewing
  | 'awaiting_payment'   // hold active, payment not yet submitted
  | 'payment_submitted'  // guest uploaded payment screenshot
  | 'under_review'       // operator reviewing screenshot
  | 'confirmed'          // payment verified, booking confirmed
  | 'checked_in'         // guest has arrived
  | 'checked_out'        // guest has departed
  | 'cancelled'          // booking cancelled
  | 'rebooked'           // old booking superseded by a new ref
  | 'expired'            // hold expired without payment
  | 'no_show';           // guest did not arrive

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
  adults: number;
  children: number;
}

/** Form state for guest details (Step 3) */
export interface GuestForm {
  name: string;
  phone: string;
  email: string;
  notes: string;
}
