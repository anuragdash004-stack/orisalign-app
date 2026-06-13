-- Add ip_address and user_agent columns to audit_log
-- lib/auditLog.ts's logAuditEntry() has always inserted these fields, but the
-- live table was created without them, causing every insert through that
-- path to fail silently (Booking Created, Plan Approved, Message Template
-- Updated, Custom Message Sent, Payment Recorded, Payment Received).

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
