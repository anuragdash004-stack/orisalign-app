# Audit Log System Setup Guide

## Overview
This system logs all changes to appointments and bookings with timestamps, actor information, IP addresses, and before/after data.

## Step 1: Create the Audit Log Table in Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: **orisalign-app**
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the entire contents of `migrations/001_create_audit_log_table.sql`
6. Click **RUN**

Expected output: "Success. No rows returned"

## Step 2: Verify Table Creation

In Supabase Dashboard:
- Go to **Table Editor** 
- Refresh the page
- You should see `audit_log` table with columns:
  - `id` (UUID, primary key)
  - `appointment_id` (UUID, foreign key)
  - `actor_email` (text)
  - `actor_role` (text)
  - `action` (text)
  - `entity` (text)
  - `new_data` (JSONB)
  - `old_data` (JSONB)
  - `created_at` (timestamp)
  - `ip_address` (text)
  - `user_agent` (text)

## Step 3: Deploy Code Changes

The following routes now automatically log changes:

### ✅ Logging Enabled
- **`/api/book`** - Logs when customer books appointment (timestamp: booking_timestamp)
- **`/api/approve-plan`** - Logs when patient approves treatment plan
- **`/api/cashfree/webhook`** - Logs all payment status changes

### What Gets Logged
Each audit entry includes:
- **Timestamp**: Exact time of action (ISO 8601 format)
- **Actor**: Who made the change (email, role, IP address)
- **Action**: What happened (e.g., "Booking Created", "Plan Approved by Patient")
- **Before/After Data**: Old and new values for comparison
- **Client Info**: IP address and user agent for security

## Step 4: View Audit Logs

### In Dashboard
1. Navigate to **Audit Log** in the dashboard
2. Select any patient/appointment to see all changes
3. Each entry shows timestamp, actor, and what changed

### In Supabase
1. Go to **Table Editor** → `audit_log`
2. View all audit entries
3. Sort by `created_at` descending for latest changes

## Example Audit Entry

When a customer books an appointment at 2025-06-12 10:30 AM:

```json
{
  "id": "a1b2c3d4-e5f6...",
  "appointment_id": "xyz-123-abc",
  "actor_email": "customer@example.com",
  "actor_role": "customer",
  "action": "Booking Created",
  "entity": "appointment",
  "created_at": "2025-06-12T10:30:45.123Z",
  "ip_address": "122.45.67.89",
  "user_agent": "Mozilla/5.0...",
  "new_data": {
    "name": "Priya Sharma",
    "phone": "9876543210",
    "email": "priya@example.com",
    "date": "2025-06-20",
    "time": "10:00 AM",
    "status": "pending",
    "booking_timestamp": "2025-06-12T10:30:45.123Z"
  }
}
```

## Future Enhancements

Add logging to additional routes:
- `PATCH /appointments/:id` - Update appointment details
- `POST /journey-step/:id` - Update journey steps
- `DELETE /audit-log/:id` - Audit log deletion (if allowed)

## API Reference

### Log an Action (Backend)

```typescript
import { logAuditEntry } from "@/lib/auditLog"

await logAuditEntry({
  appointmentId: "patient-id",
  actorEmail: "user@example.com",
  actorRole: "dentist", // or "patient", "admin", "system"
  action: "Status Updated",
  entity: "appointment_status",
  newData: { status: "confirmed" },
  oldData: { status: "pending" },
  ipAddress: "1.2.3.4",
  userAgent: "Mozilla/5.0..."
})
```

## Security Notes

- Audit logs are **immutable** (cannot be edited or deleted via SQL)
- All timestamps are stored in UTC (ISO 8601)
- IP addresses and user agents help identify suspicious activity
- RLS policies restrict viewing while preventing tampering

## Testing

To test, make a booking and check:

1. **Supabase Dashboard**:
   - Table Editor → `audit_log` 
   - Should have a new entry

2. **Admin Dashboard**:
   - Audit Log page
   - Click patient to see all changes with timestamps

