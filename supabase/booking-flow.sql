-- G and A Pods shared booking flow.
-- Same database contract used by the customer website and management app.
-- TODO: Define the exact business rule/timer for `expired`.

do $$ begin
  create type booking_status_v2 as enum (
    'pending_payment',
    'on_hold',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
    'rebooked',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.bookings
  add column if not exists selected_rooms jsonb not null default '[]'::jsonb,
  add column if not exists num_adults integer,
  add column if not exists num_children integer not null default 0,
  add column if not exists children_share_bed boolean not null default true,
  add column if not exists other_guests text,
  add column if not exists payment_screenshot_url text,
  add column if not exists payment_screenshot_path text,
  add column if not exists payment_uploaded_at timestamptz,
  add column if not exists on_hold_at timestamptz,
  add column if not exists rebooked_from_ref text,
  add column if not exists rebooked_to_ref text,
  add column if not exists expired_at timestamptz;

alter table public.bookings
  alter column status type booking_status_v2
  using status::text::booking_status_v2;

create index if not exists bookings_booking_ref_idx
  on public.bookings (booking_ref);

create index if not exists bookings_status_idx
  on public.bookings (status);

insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', true)
on conflict (id) do nothing;
