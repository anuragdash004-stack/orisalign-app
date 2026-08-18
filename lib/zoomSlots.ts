/**
 * Fixed daily time slots for the "Book a Video Call with Our Smile Expert"
 * step. Same 4-times-a-day pattern as the existing scan-booking flow (see
 * app/patient/[id]/details/page.tsx), but backed by its own zoom_call_bookings
 * table instead of appointments_booking.
 */
export const ZOOM_TIME_SLOTS = ["9 AM", "11 AM", "3:30 PM", "5:30 PM"] as const;
export type ZoomTimeSlot = (typeof ZOOM_TIME_SLOTS)[number];
