# Flexible Payment Type System

## Overview

This system allows admins to select which payment to collect from patients:
- **Down Payment** - Partial upfront payment (e.g., ₹20,000)
- **Pending Amount** - Remaining balance after down payment (e.g., ₹27,999)
- **Full Amount** - Complete payment upfront (e.g., ₹47,999)

The patient always sees exactly what they need to pay based on what the admin selected.

## Payment Data Structure

Every appointment's `payment_data` contains:

```json
{
  "full_amount": 47999,
  "discount_amount": 7000,
  "down_payment": 20000,
  "pending_amount": 27999,
  "payment_type_to_collect": "down_payment",
  "amount_to_collect": 20000,
  "cashfree_order_id": "OA-abc123-timestamp",
  "cashfree_status": "PAID",
  "cashfree_paid_amount": 20000,
  "cashfree_paid_at": "2025-06-12T10:30:45Z"
}
```

## Setup Steps

### 1. Run the Migration

In Supabase Dashboard:
1. Go to **SQL Editor** → **New Query**
2. Copy entire contents of `migrations/002_add_payment_type_tracking.sql`
3. Click **RUN**

This adds:
- `payment_type_to_collect` column (default: "down_payment")
- `payment_collected_at` column
- `payment_type_description` column
- Index for efficient filtering

### 2. Admin API Endpoints

#### Set Payment Type (Admin)

```bash
POST /api/set-payment-type

{
  "appointmentId": "abc-123-xyz",
  "paymentType": "down_payment",  // or "pending" or "full"
  "actorEmail": "admin@orisalign.com",
  "actorRole": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment type set to Down Payment",
  "appointmentId": "abc-123-xyz",
  "paymentType": "down_payment"
}
```

#### Get Current Payment Type

```bash
GET /api/set-payment-type?appointmentId=abc-123-xyz
```

**Response:**
```json
{
  "appointmentId": "abc-123-xyz",
  "paymentType": "down_payment",
  "paymentData": {
    "full_amount": 47999,
    "down_payment": 20000,
    "pending_amount": 27999
  }
}
```

## Payment Flow

### Admin Sets Payment Type

1. Admin opens patient dashboard
2. Selects which payment to collect:
   - ✅ Down Payment (₹20,000)
   - ✅ Pending Amount (₹27,999)
   - ✅ Full Amount (₹47,999)
3. Clicks "Set Payment Type"
4. API call to `/api/set-payment-type`
5. Audit log created

### Patient Sees Correct Amount

1. Patient receives email: "Payment Ready — Pay ₹20,000"
2. Clicks "Pay Now" button
3. Payment breakdown shows:
   - Plan Cost: ₹47,999
   - Discount: ₹7,000
   - Your Payment: ₹20,000 (Down Payment)
4. Cashfree checkout shows: ₹20,000
5. Payment processed with that exact amount

### Repeat for Pending Payment

After first payment:
1. Admin sets payment type to "pending"
2. Patient gets email: "Remaining Payment — Pay ₹27,999"
3. Patient pays ₹27,999
4. Appointment fully paid

## Implementation in Dashboard

### Admin UI Component (React)

```jsx
// In patient dashboard
const [selectedPaymentType, setSelectedPaymentType] = useState('down_payment');

const handleSetPaymentType = async () => {
  const res = await fetch('/api/set-payment-type', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appointmentId: patientId,
      paymentType: selectedPaymentType,
      actorEmail: adminEmail,
      actorRole: 'admin'
    })
  });
  
  const data = await res.json();
  if (data.success) {
    alert(`Payment type set to ${data.message}`);
  }
};

return (
  <div className="payment-type-selector">
    <h3>Select Payment to Collect</h3>
    
    <label>
      <input 
        type="radio" 
        value="down_payment" 
        checked={selectedPaymentType === 'down_payment'}
        onChange={(e) => setSelectedPaymentType(e.target.value)}
      />
      Down Payment: ₹{paymentData.down_payment}
    </label>

    <label>
      <input 
        type="radio" 
        value="pending" 
        checked={selectedPaymentType === 'pending'}
        onChange={(e) => setSelectedPaymentType(e.target.value)}
      />
      Pending Amount: ₹{paymentData.pending_amount}
    </label>

    <label>
      <input 
        type="radio" 
        value="full" 
        checked={selectedPaymentType === 'full'}
        onChange={(e) => setSelectedPaymentType(e.target.value)}
      />
      Full Amount: ₹{paymentData.full_amount}
    </label>

    <button onClick={handleSetPaymentType}>
      Set Payment Type
    </button>
  </div>
);
```

### Patient Payment Page

```jsx
// Fetch payment type and show correct amount
const getPaymentSummary = async () => {
  const res = await fetch(`/api/set-payment-type?appointmentId=${patientId}`);
  const data = await res.json();
  
  return {
    paymentType: data.paymentType,
    fullAmount: data.paymentData.full_amount,
    downPayment: data.paymentData.down_payment,
    pendingAmount: data.paymentData.pending_amount,
    amountToPay: getAmountForType(data.paymentType, data.paymentData)
  };
};

return (
  <div className="payment-summary">
    <h2>Payment Details</h2>
    
    <div className="breakdown">
      <div>Plan Cost: ₹{summary.fullAmount}</div>
      <div>Discount: -₹{summary.fullAmount - summary.downPayment - summary.pendingAmount}</div>
      <hr />
      <div className="highlight">
        {summary.paymentType === 'down_payment' && 
          `Down Payment: ₹${summary.downPayment}`}
        {summary.paymentType === 'pending' && 
          `Pending Amount: ₹${summary.pendingAmount}`}
        {summary.paymentType === 'full' && 
          `Full Amount: ₹${summary.fullAmount}`}
      </div>
    </div>

    <button onClick={handlePayment}>
      Pay ₹{summary.amountToPay}
    </button>
  </div>
);
```

## Audit Logging

Every payment type change is logged:

```json
{
  "appointment_id": "abc-123-xyz",
  "actor_email": "admin@orisalign.com",
  "actor_role": "admin",
  "action": "Payment Type Selected",
  "entity": "payment_type_to_collect",
  "new_data": {
    "payment_type_to_collect": "down_payment",
    "payment_type_label": "Down Payment"
  },
  "old_data": {
    "payment_type_to_collect": "full",
    "payment_type_label": "Full Amount"
  },
  "created_at": "2025-06-12T10:30:45Z"
}
```

## Testing

### Test Scenarios

1. **Down Payment First**
   - Set to "down_payment"
   - Patient pays ₹20,000
   - Change to "pending"
   - Patient pays ₹27,999

2. **Full Amount Direct**
   - Set to "full"
   - Patient pays ₹47,999 immediately

3. **Pending Only**
   - Set to "pending"
   - Patient skips down payment
   - Pays full remaining amount

### Verify in Database

```sql
-- Check payment type for appointment
SELECT 
  id,
  payment_type_to_collect,
  payment_data->>'payment_type_to_collect' as type_label,
  payment_data->>'down_payment' as down_amount,
  payment_data->>'pending_amount' as pending_amount
FROM appointments_booking
WHERE id = 'abc-123-xyz';

-- Check audit log
SELECT 
  action,
  new_data->>'payment_type_to_collect',
  created_at
FROM audit_log
WHERE appointment_id = 'abc-123-xyz'
ORDER BY created_at DESC;
```

## Error Handling

- **Invalid payment type**: Returns 400 with message
- **Appointment not found**: Returns 404
- **No amount available**: Returns 400 (e.g., "No down payment available")
- **Zero/negative amount**: Payment won't process

## Best Practices

1. ✅ Always set payment type before patient attempts payment
2. ✅ Show payment breakdown clearly to patient
3. ✅ Update payment type in audit log
4. ✅ Notify patient of payment amount changes
5. ✅ Track payment type history
6. ❌ Don't change payment type after payment started
7. ❌ Don't send conflicting payment requests to patient
