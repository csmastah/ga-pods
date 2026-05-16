// ─────────────────────────────────────────────
//  G and A Pods — TypeScript types (real Supabase schema)
// ─────────────────────────────────────────────

export type BookingStatus =
  | 'pending_payment'    // legacy: unpaid, pre-rule-engine
  | 'on_hold'            // legacy: payment screenshot submitted, under review
  | 'awaiting_payment'   // new: hold active, payment not yet submitted
  | 'payment_submitted'  // new: guest uploaded screenshot
  | 'under_review'       // new: operator reviewing screenshot
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'rebooked'
  | 'expired'
  | 'no_show';

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
  num_adults?: number | null;
  num_children?: number | null;
  children_share_bed?: boolean | null;
  check_in_date: string;
  check_out_date: string;
  num_nights: number;
  price_per_night: number;
  total_price: number;
  selected_rooms?: Array<{
    room_id: string;
    room_name: string;
    quantity: number;
    capacity_each: number;
    rate_per_night: number;
    total: number;
  }> | null;
  status: BookingStatus;
  payment_method: 'gcash_maya' | 'gcash' | 'maya' | 'cash' | null;
  payment_reference: string | null;
  payment_screenshot_url?: string | null;
  payment_screenshot_path?: string | null;
  payment_uploaded_at?: string | null;
  payment_confirmed_at: string | null;
  source: string;
  notes: string | null;
  other_guests?: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  on_hold_at?: string | null;
  expired_at?: string | null;
  rebooked_from_ref?: string | null;
  rebooked_to_ref?: string | null;
  // Phase 1 new columns
  booking_snapshot?: BookingSnapshot | null;
  hold_expires_at?: string | null;
  is_peak_season?: boolean;
  original_booking_id?: string | null;
  // Refund tracking
  refund_status?: string | null;
  refund_amount?: number | null;
  refund_method?: string | null;
  refund_notes?: string | null;
  refund_processed_at?: string | null;
  // Joined
  room?: Room | null;
  room_type?: RoomType | null;
}

export interface BookingSnapshot {
  check_in: string;
  check_out: string;
  nights: number;
  guest_count: number;
  stay_tier: 'short' | 'medium' | 'long' | 'peak';
  booking_total: number;
  amount_required_now: number;
  balance_amount: number;
  balance_due_date: string | null;
  hold_hours: number;
  hold_expires_at: string;
  is_peak_season: boolean;
  peak_season_name: string | null;
  peak_season_rule: string | null;
  security_deposit_amount: number;
  security_deposit_collected: string;
  security_deposit_refund_days: number;
  discounts_applied: unknown[];
  rooms_breakdown: Array<{
    room_id: string;
    room_name: string;
    quantity: number;
    rate_per_night: number;
    nights: number;
    subtotal: number;
  }>;
  cancellation_policy: {
    full_refund_if_cancelled_days_before: number;
    partial_refund_if_cancelled_days_before: number;
    partial_refund_pct: number;
    no_refund_within_days: number;
  };
  computed_at: string;
  schema_version: string;
}

// Room enriched with live occupancy status
export type RoomOccupancyStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'long_term';

export interface RoomWithStatus extends Room {
  occupancy_status: RoomOccupancyStatus;
  active_booking?: Booking | null;
}
