-- Message Templates System
-- Store customizable message templates for each journey step
-- and track all messages sent to patients

-- Message Templates Table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  step_key VARCHAR(50) NOT NULL UNIQUE,
  step_label VARCHAR(100) NOT NULL,
  subject_line TEXT NOT NULL,
  email_body TEXT NOT NULL,
  sms_body TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true
);

-- Message History Table (log of all messages sent to patients)
CREATE TABLE IF NOT EXISTS message_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments_booking(id) ON DELETE SET NULL,
  step_key VARCHAR(50),
  message_type VARCHAR(20), -- 'email', 'sms', 'custom'
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  subject TEXT,
  body TEXT,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  is_template BOOLEAN DEFAULT true, -- true if from template, false if custom
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivery_status VARCHAR(50), -- 'pending', 'sent', 'failed', 'bounced'
  delivery_provider VARCHAR(50), -- 'resend', 'twilio', 'manual'
  provider_response JSONB,
  sent_by VARCHAR(255), -- email of person who sent (or 'system')
  sent_by_role VARCHAR(50), -- 'system', 'admin', 'dentist'
  notes TEXT
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_message_templates_step_key
  ON message_templates(step_key);

CREATE INDEX IF NOT EXISTS idx_message_templates_is_active
  ON message_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_message_history_appointment_id
  ON message_history(appointment_id);

CREATE INDEX IF NOT EXISTS idx_message_history_sent_at
  ON message_history(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_history_step_key
  ON message_history(step_key);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can read active message templates"
  ON message_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can update message templates"
  ON message_templates FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can read message history"
  ON message_history FOR SELECT
  USING (true);

CREATE POLICY "Service can insert message history"
  ON message_history FOR INSERT
  WITH CHECK (true);

-- Insert default message templates for all 15 steps
INSERT INTO message_templates (step_key, step_label, subject_line, email_body) VALUES
('booked', 'Appointment Booked', 'Your Appointment is Booked — OrisAlign', 'Your appointment has been successfully booked with OrisAlign. Our team will confirm the details with you shortly.'),
('confirmed', 'Appointment Confirmed', 'Your Appointment is Confirmed — OrisAlign', 'Great news! Your appointment with OrisAlign has been confirmed. Our dentist will be in touch with you shortly.'),
('scanning_done', 'Scanning & Planning', 'Scanning & Planning Complete — OrisAlign', 'Your scanning session and initial planning have been completed successfully. Our team is now working on your personalized treatment proposal.'),
('payment_done', 'Price & Payment', 'Payment Confirmed — OrisAlign', 'Your payment details have been finalized. Thank you for your trust in OrisAlign. Our team will proceed with your treatment planning.'),
('planning_done', 'Planning Done', 'Your Treatment Plan is Ready — OrisAlign', 'Your personalized 3D treatment plan has been prepared! Please visit your journey page to review it.'),
('plan_approved', 'Plan Approval', 'Plan Approved — Manufacturing Begins Soon — OrisAlign', 'Your treatment plan has been approved. Thank you for authorizing us to begin fabrication of your custom aligners.'),
('manufacturing_started', 'Manufacturing Started', 'Your Aligners Are Being Made — OrisAlign', 'Exciting news! Manufacturing of your custom aligners has officially begun. Each set is precisely crafted according to your treatment plan.'),
('manufacturing_completed', 'Manufacturing Completed', 'Your Aligners Are Ready — OrisAlign', 'Your custom aligners have been manufactured and quality-checked. They are now being prepared for dispatch to you.'),
('aligners_dispatched', 'Aligners Dispatched', 'Your Aligners Are On Their Way — OrisAlign', 'Your aligners are on the move! They have been handed over to our delivery partner and are heading your way.'),
('aligners_received', 'Aligners Received', 'Aligners Received by Delivery Partner — OrisAlign', 'Your aligners have been received by our local delivery partner and are on the final leg of their journey to you.'),
('followup_appointment', 'Follow-Up Appointment', 'Follow-Up Appointment Scheduled — OrisAlign', 'Your follow-up appointment has been scheduled with OrisAlign. This visit is an important part of your treatment.'),
('aligners_delivered', 'Aligners Delivered', 'Aligners Delivered — Start Your Smile Correction — OrisAlign', 'Your aligners have arrived! Please begin wearing them as instructed by your orthodontist.'),
('smile_correction', 'Smile Correction Started', 'Smile Correction Phase Started — OrisAlign', 'Your Smile Correction phase has officially started! You''re now actively on your journey to a more confident smile.'),
('treatment_completed', 'Treatment Complete', 'Treatment Complete — Congratulations from OrisAlign!', 'Congratulations — your OrisAlign treatment is complete! Your smile has been transformed through precision, care, and your own commitment.'),
('feedback_submitted', 'Feedback Form Submitted', 'Thank You for Your Feedback — OrisAlign', 'Thank you so much for taking the time to share your experience with us. Your feedback helps us improve and inspire others.')
ON CONFLICT (step_key) DO NOTHING;
