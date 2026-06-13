# Message System: Templates & History

## Overview

Complete messaging system with:
1. **Message Templates** - Edit pre-written messages for all 15 journey steps
2. **Message History** - View all messages sent to each patient
3. **Custom Messages** - Send personalized messages to patients

## 15 Journey Steps with Messages

| Step | Label | Default Message |
|------|-------|-----------------|
| booked | Appointment Booked | "Your appointment has been successfully booked with OrisAlign..." |
| confirmed | Appointment Confirmed | "Great news! Your appointment with OrisAlign has been confirmed..." |
| scanning_done | Scanning & Planning | "Your scanning session completed. We're working on your treatment..." |
| payment_done | Price & Payment | "Payment confirmed. Thank you for your trust in OrisAlign..." |
| planning_done | Planning Done | "Your 3D treatment plan is ready. Please review it..." |
| plan_approved | Plan Approval | "Plan approved! Manufacturing begins soon..." |
| manufacturing_started | Manufacturing Started | "Exciting news! Manufacturing has officially begun..." |
| manufacturing_completed | Manufacturing Completed | "Your aligners are manufactured and quality-checked..." |
| aligners_dispatched | Aligners Dispatched | "Your aligners are on the move! Tracking info included..." |
| aligners_received | Aligners Received | "Received by delivery partner. Coming to you soon..." |
| followup_appointment | Follow-Up Appointment | "Your follow-up appointment has been scheduled..." |
| aligners_delivered | Aligners Delivered | "Aligners arrived! Start wearing them as instructed..." |
| smile_correction | Smile Correction Started | "You're officially on your smile correction journey..." |
| treatment_completed | Treatment Complete | "Congratulations! Your treatment is complete..." |
| feedback_submitted | Feedback Form | "Thank you for your feedback! Hamper coming soon..." |

## Database Structure

### message_templates Table

```sql
id              UUID PRIMARY KEY
step_key        VARCHAR(50) UNIQUE  -- 'booked', 'confirmed', etc.
step_label      VARCHAR(100)        -- "Appointment Booked"
subject_line    TEXT                -- Email subject
email_body      TEXT                -- Email body (HTML)
sms_body        TEXT                -- SMS version (optional)
created_at      TIMESTAMP
updated_at      TIMESTAMP
updated_by      VARCHAR(255)        -- Admin email who last edited
is_active       BOOLEAN DEFAULT true
```

### message_history Table

```sql
id                  UUID PRIMARY KEY
appointment_id      UUID REFERENCES appointments_booking
step_key            VARCHAR(50)          -- Which step triggered this
message_type        VARCHAR(20)          -- 'email', 'sms', 'custom'
recipient_email     VARCHAR(255)
recipient_phone     VARCHAR(20)
subject             TEXT
body                TEXT
template_id         UUID REFERENCES message_templates
is_template         BOOLEAN              -- true=template, false=custom
sent_at             TIMESTAMP
delivery_status     VARCHAR(50)          -- 'pending', 'sent', 'failed'
delivery_provider   VARCHAR(50)          -- 'resend', 'twilio', 'manual'
provider_response   JSONB                -- Provider API response
sent_by             VARCHAR(255)         -- Admin email who sent it
sent_by_role        VARCHAR(50)          -- 'system', 'admin', 'dentist'
notes               TEXT
```

## Setup

### 1. Run Migration

In Supabase Dashboard:
```sql
Copy: migrations/004_create_message_system.sql
Paste in SQL Editor
Click RUN
```

This creates:
- ✅ message_templates table with 15 pre-filled templates
- ✅ message_history table for tracking
- ✅ Indexes for fast queries
- ✅ RLS policies

## API Endpoints

### Get All Message Templates

```bash
GET /api/message-templates
```

**Response:**
```json
{
  "templates": [
    {
      "id": "uuid-1",
      "step_key": "booked",
      "step_label": "Appointment Booked",
      "subject_line": "Your Appointment is Booked — OrisAlign",
      "email_body": "Your appointment has been successfully booked...",
      "updated_at": "2025-06-12T10:30:45Z",
      "updated_by": "admin@orisalign.com"
    },
    // ... more templates
  ],
  "count": 15
}
```

### Get Specific Template

```bash
GET /api/message-templates?stepKey=booked
```

### Update Message Template

```bash
POST /api/message-templates

{
  "stepKey": "booked",
  "subjectLine": "New subject here",
  "emailBody": "New email body here...",
  "smsBody": "Short SMS version (optional)",
  "actorEmail": "admin@orisalign.com",
  "actorRole": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Template for 'booked' updated successfully",
  "template": { ... }
}
```

### Get Message History for Patient

```bash
GET /api/message-history?appointmentId=abc-123-xyz
```

**Response:**
```json
{
  "appointmentId": "abc-123-xyz",
  "messages": [
    {
      "id": "msg-1",
      "step_key": "booked",
      "message_type": "email",
      "recipient_email": "patient@example.com",
      "subject": "Your Appointment is Booked",
      "sent_at": "2025-06-12T10:30:45Z",
      "delivery_status": "sent",
      "is_template": true,
      "sent_by": "system"
    },
    {
      "id": "msg-2",
      "message_type": "email",
      "subject": "Quick Reminder: Bring your ID",
      "sent_at": "2025-06-13T08:00:00Z",
      "delivery_status": "sent",
      "is_template": false,
      "sent_by": "admin@orisalign.com"
    }
  ],
  "count": 2
}
```

### Send Custom Message to Patient

```bash
POST /api/message-history

{
  "appointmentId": "abc-123-xyz",
  "recipientEmail": "patient@example.com",
  "subject": "Important: Appointment Reminder",
  "body": "Dear Priya, just a reminder that your appointment is tomorrow at 10 AM...",
  "messageType": "email",
  "stepKey": null,
  "actorEmail": "admin@orisalign.com",
  "actorRole": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent to patient@example.com",
  "deliveryStatus": "sent",
  "loggedMessage": {
    "id": "msg-3",
    "sent_at": "2025-06-13T15:30:45Z"
  }
}
```

## UI Components

### 1. Message Templates Section

```jsx
// Navigate to: Dashboard → Messages → Templates

export function MessageTemplates() {
  const [templates, setTemplates] = useState([]);
  const [editingStep, setEditingStep] = useState(null);
  const [formData, setFormData] = useState({
    subject: '',
    body: ''
  });

  useEffect(() => {
    // Load all templates
    fetch('/api/message-templates')
      .then(r => r.json())
      .then(d => setTemplates(d.templates));
  }, []);

  const handleEdit = (template) => {
    setEditingStep(template.step_key);
    setFormData({
      subject: template.subject_line,
      body: template.email_body
    });
  };

  const handleSave = async () => {
    const res = await fetch('/api/message-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepKey: editingStep,
        subjectLine: formData.subject,
        emailBody: formData.body,
        actorEmail: adminEmail,
        actorRole: 'admin'
      })
    });

    if (res.ok) {
      alert('Template updated!');
      setEditingStep(null);
      // Reload templates
    }
  };

  return (
    <div className="message-templates">
      <h2>Message Templates (15 Steps)</h2>

      <div className="templates-grid">
        {templates.map(template => (
          <div key={template.step_key} className="template-card">
            <h3>{template.step_label}</h3>
            <div className="preview">
              <strong>Subject:</strong> {template.subject_line}
            </div>
            
            {editingStep === template.step_key ? (
              <div className="edit-form">
                <textarea
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="Email subject"
                />
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({...formData, body: e.target.value})}
                  placeholder="Email body (HTML)"
                  rows={10}
                />
                <div className="actions">
                  <button onClick={handleSave}>Save Changes</button>
                  <button onClick={() => setEditingStep(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => handleEdit(template)}>Edit</button>
            )}

            <div className="metadata">
              Last updated: {new Date(template.updated_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. Message History Section

```jsx
// Navigate to: Dashboard → Messages → History

export function MessageHistory({ appointmentId, patientName, patientEmail }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState({
    subject: '',
    body: ''
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Load message history
    fetch(`/api/message-history?appointmentId=${appointmentId}`)
      .then(r => r.json())
      .then(d => setMessages(d.messages));
  }, [appointmentId]);

  const handleSendCustom = async () => {
    setSending(true);
    const res = await fetch('/api/message-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId,
        recipientEmail: patientEmail,
        subject: newMessage.subject,
        body: newMessage.body,
        messageType: 'email',
        actorEmail: adminEmail,
        actorRole: 'admin'
      })
    });

    if (res.ok) {
      alert('Message sent!');
      setNewMessage({ subject: '', body: '' });
      // Reload messages
    }
    setSending(false);
  };

  return (
    <div className="message-history">
      <h2>Message History - {patientName}</h2>

      {/* Previous Messages */}
      <div className="messages-list">
        <h3>Sent Messages</h3>
        {messages.length === 0 ? (
          <p>No messages sent yet.</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="message-item">
              <div className="header">
                <strong>{msg.subject}</strong>
                <span className={`status ${msg.delivery_status}`}>
                  {msg.delivery_status}
                </span>
              </div>
              <div className="meta">
                <span>{new Date(msg.sent_at).toLocaleString()}</span>
                {msg.is_template ? (
                  <span className="badge">Template</span>
                ) : (
                  <span className="badge custom">Custom</span>
                )}
              </div>
              <div className="preview">
                {msg.body.substring(0, 200)}...
              </div>
            </div>
          ))
        )}
      </div>

      {/* Draft New Message */}
      <div className="draft-section">
        <h3>📝 Draft New Message</h3>
        <div className="form">
          <input
            type="text"
            placeholder="Email Subject"
            value={newMessage.subject}
            onChange={(e) => setNewMessage({...newMessage, subject: e.target.value})}
          />
          <textarea
            placeholder="Message body... (You can use HTML)"
            value={newMessage.body}
            onChange={(e) => setNewMessage({...newMessage, body: e.target.value})}
            rows={8}
          />
          <div className="actions">
            <button
              onClick={handleSendCustom}
              disabled={!newMessage.subject || !newMessage.body || sending}
            >
              {sending ? 'Sending...' : `Send to ${patientEmail}`}
            </button>
            <button onClick={() => setNewMessage({ subject: '', body: '' })}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Integration with Journey Steps

When a journey step completes, the system automatically:

1. **Fetches** the message template for that step
2. **Retrieves** patient email from appointment
3. **Sends** the email via Resend
4. **Logs** to message_history with:
   - `is_template: true`
   - `delivery_status: 'sent'`
   - `delivery_provider: 'resend'`
   - `sent_by: 'system'`

Example in notify-step:

```typescript
// Get template
const template = await getMessageTemplate(stepKey);

// Send email
await sendEmail(template, patient);

// Log to history
await fetch('/api/message-history', {
  method: 'POST',
  body: JSON.stringify({
    appointmentId: patient.id,
    recipientEmail: patient.email,
    subject: template.subject_line,
    body: template.email_body,
    stepKey,
    messageType: 'email',
    is_template: true,
    sent_by: 'system'
  })
});
```

## Dashboard Layout

```
DASHBOARD
├── Payment
├── Manufacturing
├── Logistics
├── Journey
├── Patient Page
└── 🆕 Messages
    ├── Message Templates (Subsection 1)
    │   ├── Booked
    │   ├── Confirmed
    │   ├── Scanning Done
    │   ├── ... (15 total)
    │   └── Feedback Submitted
    │
    └── Message History (Subsection 2)
        ├── [Select Patient]
        ├── Sent Messages
        │   ├── Message 1 (Template)
        │   ├── Message 2 (Custom)
        │   └── Message 3 (Template)
        └── Draft New Message
            ├── Subject
            ├── Body
            └── [Send]
```

## Features

✅ **15 Pre-written Templates** - One for each journey step
✅ **Editable Templates** - Customize the default messages
✅ **Message History** - See all messages sent to each patient
✅ **Custom Messages** - Send personalized messages anytime
✅ **Delivery Tracking** - Know if message was sent successfully
✅ **Audit Logged** - All template changes and custom messages tracked
✅ **Resend Integration** - Professional email delivery
✅ **HTML Support** - Format emails with HTML
✅ **Template/Custom Badge** - Know which messages were templates
✅ **Timestamp Tracking** - See when each message was sent
