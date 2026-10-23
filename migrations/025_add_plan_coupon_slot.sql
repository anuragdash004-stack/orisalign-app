-- Atomically claims a patient's one-and-only coupon attempt on their aligner
-- treatment payment. A patient gets exactly one coupon application ever,
-- successful or not, regardless of whether it's still inside its 60-minute
-- hold — enforced here so two rapid requests from the same patient can't
-- both pass a client-side "have I already used one?" check and both apply.
--
-- Mirrors claim_referral_reward_slot's shape (migration from this same
-- session's earlier referral-cap fix): check-and-reserve in one transaction,
-- serialized per-appointment by an advisory lock.
create or replace function claim_plan_coupon_slot(
  p_appointment_id uuid,
  p_code text,
  p_discount numeric
)
returns boolean
language plpgsql
as $$
declare
  v_existing jsonb;
  v_claimed boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext(p_appointment_id::text));

  select payment_data->'applied_coupons' into v_existing
  from appointments_booking
  where id = p_appointment_id;

  if v_existing is null or jsonb_array_length(v_existing) = 0 then
    update appointments_booking
    set payment_data = jsonb_set(
      coalesce(payment_data, '{}'::jsonb),
      '{applied_coupons}',
      coalesce(payment_data->'applied_coupons', '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('code', p_code, 'discount', p_discount, 'applied_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      )
    )
    where id = p_appointment_id;
    v_claimed := true;
  end if;

  return v_claimed;
end;
$$;
