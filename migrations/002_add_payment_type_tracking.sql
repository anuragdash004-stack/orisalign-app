-- Add payment type selection tracking
-- Allows admin to specify which payment to collect: 'down_payment', 'pending', or 'full'

ALTER TABLE appointments_booking
ADD COLUMN IF NOT EXISTS payment_type_to_collect VARCHAR(50) DEFAULT 'down_payment',
ADD COLUMN IF NOT EXISTS payment_collected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_type_description TEXT;

-- Create index for filtering by payment type
CREATE INDEX IF NOT EXISTS idx_payment_type_to_collect
ON appointments_booking(payment_type_to_collect);

-- Update payment_data structure documentation
-- payment_data now includes:
-- {
--   "full_amount": 47999,
--   "discount_amount": 7000,
--   "down_payment": 20000,
--   "pending_amount": 27999,
--   "payment_type_to_collect": "down_payment",  // or "pending", "full"
--   "amount_to_collect": 20000,  // Dynamically calculated based on payment_type_to_collect
--   ...other payment fields
-- }
