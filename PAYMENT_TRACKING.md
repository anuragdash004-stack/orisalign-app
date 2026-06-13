# Payment Tracking: Paid & To Pay

## Overview

Track how much patients have paid and how much is still pending.

**Example:**
```
Full Amount:     ₹47,999
Discount:        -₹7,000
────────────────────────
Amount Paid:     ✅ ₹20,000  (Down payment completed)
Amount to Pay:   ⏳ ₹27,999  (Remaining balance)
```

## Database Fields

### New Columns in `appointments_booking`

```sql
amount_paid          DECIMAL(10,2)  DEFAULT 0     -- Total paid so far
amount_to_pay        DECIMAL(10,2)  DEFAULT 0     -- Total remaining
first_payment_date   TIMESTAMP                     -- Date of first payment
last_payment_date    TIMESTAMP                     -- Date of most recent payment
payment_status       VARCHAR(50)    DEFAULT 'pending'
-- payment_status values:
--   'pending'  = No payment yet
--   'partial'  = Some paid, some pending
--   'paid'     = Full amount paid
```

## Payment Status Values

| Status | Meaning | Example |
|--------|---------|---------|
| `pending` | No payment received | Amount Paid: ₹0, To Pay: ₹47,999 |
| `partial` | Some payment received | Amount Paid: ₹20,000, To Pay: ₹27,999 |
| `paid` | Full amount received | Amount Paid: ₹47,999, To Pay: ₹0 ✅ |

## Setup

### Run Migration

In Supabase Dashboard:
1. **SQL Editor** → **New Query**
2. Copy: `migrations/003_add_paid_and_to_pay_tracking.sql`
3. Click **RUN**

## API Endpoints

### Get Payment Status

```bash
GET /api/update-payment-status?appointmentId=abc-123-xyz
```

**Response:**
```json
{
  "appointmentId": "abc-123-xyz",
  "amountPaid": 20000,
  "amountToPay": 27999,
  "fullAmount": 47999,
  "paymentStatus": "partial",
  "firstPaymentDate": "2025-06-12T10:30:45Z",
  "lastPaymentDate": "2025-06-12T10:30:45Z",
  "progressPercentage": 41.67
}
```

### Update Payment Status (Called After Payment Success)

```bash
POST /api/update-payment-status

{
  "appointmentId": "abc-123-xyz",
  "amountPaid": 20000,
  "transactionId": "cf-payment-12345",
  "paymentMethod": "Cashfree",
  "notes": "Down payment via UPI",
  "actorEmail": "cashfree_webhook",
  "actorRole": "payment_gateway"
}
```

**Response:**
```json
{
  "success": true,
  "appointmentId": "abc-123-xyz",
  "previouslyPaid": 0,
  "newPayment": 20000,
  "totalPaid": 20000,
  "stillToPay": 27999,
  "paymentStatus": "partial",
  "message": "💳 Payment recorded. ₹27,999 still pending."
}
```

## Display Components

### Payment Summary Card (Patient Dashboard)

```jsx
import { getPaymentSummary, formatPaymentDisplay } from "@/lib/paymentHelper";

export function PaymentSummary({ paymentData }) {
  const summary = getPaymentSummary(paymentData);
  const display = formatPaymentDisplay(paymentData);

  return (
    <div className="payment-summary">
      <h2>Payment Progress</h2>

      {/* Progress Bar */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${(summary.amountPaid / summary.fullAmount) * 100}%`,
          }}
        />
      </div>

      {/* Status */}
      <div className="status">{display.status}</div>

      {/* Amounts */}
      <div className="amounts">
        <div className="amount-paid">
          <label>Amount Paid:</label>
          <span className="value">{display.paid}</span>
        </div>

        <div className="amount-to-pay">
          <label>Amount to Pay:</label>
          <span className="value">{display.toPay}</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="breakdown">
        <div>Full Amount: ₹{summary.fullAmount}</div>
        <div>Discount: -₹{summary.discountAmount}</div>
        <hr />
        <div>Down Payment: ₹{summary.downPayment}</div>
        <div>Pending Amount: ₹{summary.pendingAmount}</div>
      </div>

      {/* Action Button */}
      {summary.paymentStatus !== "paid" && (
        <button onClick={handlePayNow}>
          Pay Now: {display.toPay}
        </button>
      )}
    </div>
  );
}
```

### Payment Breakdown (Patient Email)

```html
<div style="background: white; padding: 20px; border-radius: 8px;">
  <h3>💰 Payment Details</h3>

  <table style="width: 100%; margin: 16px 0;">
    <tr>
      <td>Plan Cost:</td>
      <td style="text-align: right;">₹47,999</td>
    </tr>
    <tr>
      <td>Discount:</td>
      <td style="text-align: right;">-₹7,000</td>
    </tr>
    <tr style="border-top: 2px solid #e5e7eb; padding-top: 8px;">
      <td style="font-weight: bold;">Down Payment:</td>
      <td style="text-align: right; font-weight: bold;">₹20,000</td>
    </tr>
    <tr>
      <td>Pending Amount:</td>
      <td style="text-align: right;">₹27,999</td>
    </tr>
  </table>

  <div style="background: #f0fdf4; padding: 12px; border-radius: 6px;">
    <div style="color: #16a34a; font-weight: bold;">✅ Already Paid: ₹20,000</div>
    <div style="color: #ea580c; font-weight: bold;">⏳ To Pay: ₹27,999</div>
  </div>
</div>
```

### Admin Dashboard Component

```jsx
import { formatPaymentDisplay } from "@/lib/paymentHelper";

export function AdminPaymentView({ appointment }) {
  const display = formatPaymentDisplay(appointment.payment_data);

  return (
    <div className="admin-payment-view">
      <h3>Payment Status</h3>

      <div className="card">
        <div className="row">
          <span>Full Amount:</span>
          <span>₹{appointment.payment_data.full_amount}</span>
        </div>
        <div className="row">
          <span>Discount:</span>
          <span>-₹{appointment.payment_data.discount_amount}</span>
        </div>

        <hr />

        <div className="row highlight paid">
          <span>✅ Amount Paid:</span>
          <span>{display.paid}</span>
        </div>

        <div className="row highlight pending">
          <span>⏳ Amount to Pay:</span>
          <span>{display.toPay}</span>
        </div>

        <div className="row status">
          <span>Status:</span>
          <span>{display.status}</span>
        </div>
      </div>

      {/* Payment History */}
      <div className="payment-history">
        <h4>Payment History</h4>
        {appointment.first_payment_date && (
          <>
            <div>First Payment: {formatDate(appointment.first_payment_date)}</div>
            <div>Last Payment: {formatDate(appointment.last_payment_date)}</div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="actions">
        {appointment.payment_status !== "paid" && (
          <button
            onClick={() => setPaymentType("pending")}
            className="btn-primary"
          >
            Collect Remaining: {display.toPay}
          </button>
        )}
      </div>
    </div>
  );
}
```

## Workflow Example

### Payment Flow with Tracking

**Day 1: Patient Books Consultation**
```
appointment created:
- amount_paid = ₹0
- amount_to_pay = ₹47,999
- payment_status = "pending"
```

**Day 3: Admin Sets Down Payment**
```
Admin selects: "down_payment"
Patient sees: "Pay ₹20,000"
```

**Day 4: Patient Makes Down Payment**
```
Cashfree webhook fires:
  ↓
update-payment-status called:
  - amountPaid = 20000
  ↓
Appointment updated:
  - amount_paid = 20000
  - amount_to_pay = 27999
  - payment_status = "partial"
  - last_payment_date = "2025-06-04T..."
```

**Day 30: Admin Requests Remaining Payment**
```
Admin selects: "pending"
Patient sees: "Pay ₹27,999 (Remaining Balance)"
```

**Day 31: Patient Makes Final Payment**
```
Cashfree webhook fires:
  ↓
update-payment-status called:
  - amountPaid = 27999
  ↓
Appointment updated:
  - amount_paid = 47999
  - amount_to_pay = 0
  - payment_status = "paid"
  - last_payment_date = "2025-06-31T..."
```

**Patient Dashboard Shows:**
```
✅ Payment Complete!
Amount Paid: ₹47,999
Amount to Pay: ₹0
```

## Automatic Updates

The system automatically updates when:
1. ✅ Payment received via Cashfree webhook
2. ✅ New amount calculated (paid + to_pay)
3. ✅ Status changed (pending → partial → paid)
4. ✅ Dates tracked (first & last payment)
5. ✅ Audit logged (all changes)

## Queries in Dashboard

### Show Only Unpaid Patients
```sql
SELECT * FROM appointments_booking
WHERE payment_status IN ('pending', 'partial')
ORDER BY last_payment_date DESC;
```

### Show Partially Paid
```sql
SELECT * FROM appointments_booking
WHERE payment_status = 'partial'
ORDER BY amount_to_pay DESC;
```

### Show Fully Paid
```sql
SELECT * FROM appointments_booking
WHERE payment_status = 'paid'
ORDER BY last_payment_date DESC;
```

### Payment Progress by Patient
```sql
SELECT 
  id,
  name,
  amount_paid,
  amount_to_pay,
  ROUND((amount_paid::numeric / (amount_paid + amount_to_pay)) * 100, 2) as payment_percentage,
  payment_status,
  first_payment_date,
  last_payment_date
FROM appointments_booking
ORDER BY payment_status, amount_to_pay DESC;
```

## Real-time Updates

Patient sees live updates:
- Payment progress bar
- ₹ Paid / ₹ To Pay
- Status indicator (Pending/Partial/Paid)
- Next payment button (when partial)

Admin sees:
- Payment history for each patient
- Quick "Set Payment Type" button
- Automated amounts based on selection
- Full audit trail of payment changes
