
  select *
  from paid_portal_checkout_attempts
  where idempotency_key = '4df5fd6f-261e-4e2e-ab43-10170d7e433f';

  select *
  from paid_portal_purchases
  where stripe_payment_intent_id = 'pi_3U32vfEDXKEXNs230HL7axpj';

  select *
  from paid_portal_access_grants
  where portal_id = 'dfc76136-cc74-41f0-b051-012a5ba3d69a';
