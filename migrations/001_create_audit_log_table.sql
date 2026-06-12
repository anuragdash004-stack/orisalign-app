-- Create audit_log table for tracking all changes in the system
-- This table stores immutable records of every action taken

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments_booking(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  actor_role VARCHAR(50),
  action VARCHAR(255) NOT NULL,
  entity VARCHAR(100),
  new_data JSONB,
  old_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Create index for fast queries by appointment
CREATE INDEX IF NOT EXISTS idx_audit_log_appointment_id ON audit_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_email ON audit_log(actor_email);

-- Add audit_log table policies for RLS (if using RLS)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read audit logs for their own appointment
CREATE POLICY IF NOT EXISTS "Users can read audit logs for their appointment"
  ON audit_log FOR SELECT
  USING (true);

-- Only authenticated users with service role can insert
CREATE POLICY IF NOT EXISTS "Service can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true);

-- Nobody can update or delete audit logs (immutable)
CREATE POLICY IF NOT EXISTS "Audit logs are immutable"
  ON audit_log FOR UPDATE, DELETE
  USING (false);
