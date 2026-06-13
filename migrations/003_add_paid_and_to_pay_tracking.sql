-- Add paid and to_pay tracking fields
-- Track cumulative payments and remaining balance

ALTER TABLE appointments_booking
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_to_pay DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS first_payment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';
-- payment_status: 'pending' (no payment), 'partial' (down payment done), 'paid' (full amount done)

-- Create index for filtering by payment status
CREATE INDEX IF NOT EXISTS idx_payment_status
ON appointments_booking(payment_status);

-- Create index for sorting by payment date
CREATE INDEX IF NOT EXISTS idx_last_payment_date
ON appointments_booking(last_payment_date DESC);

-- Update payment_data structure documentation
-- payment_data now includes:
-- {
--   "full_amount": 47999,           // Total treatment cost
--   "discount_amount": 7000,        // Discount applied
--   "down_payment": 20000,          // Amount for first payment
--   "pending_amount": 27999,        // Amount remaining
--   "payment_type_to_collect": "down_payment",  // What to collect now
--   "amount_paid": 20000,           // ₹ already paid by patient
--   "amount_to_pay": 27999,         // ₹ still pending from patient
--   "payment_transactions": [
--     {
--       "date": "2025-06-12T10:30:45Z",
--       "amount": 20000,
--       "type": "down_payment",
--       "status": "success",
--       "order_id": "OA-abc123-timestamp",
--       "transaction_id": "cf-transaction-id"
--     }
--   ]
-- }
