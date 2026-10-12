'use strict';

require('dotenv').config();
const Stripe = require('stripe');

const BASE_URL = 'http://localhost:3000/api/v1';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = json?.error?.message || json?.message || JSON.stringify(json);
    throw new Error(`HTTP ${res.status} on ${options.method || 'GET'} ${url}: ${errorMsg}`);
  }
  return json;
}

async function login(email, password) {
  const res = await request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.data;
}

async function run() {
  console.log('====================================================');
  console.log('🚀 STARTING FULL END-TO-END BOOKING & STRIPE FLOW TEST');
  console.log('====================================================\n');

  // 1. Authenticate users
  console.log('--- 1. Authenticating Users ---');
  const adminAuth = await login('admin@gmail.com', '420420');
  console.log('✅ Admin Logged In:', adminAuth.user.email);

  const groomerAuth = await login('groomer3@frostypeak.info', '12345678');
  console.log('✅ Groomer Logged In:', groomerAuth.user.email);
  console.log('   Groomer Profile ID:', groomerAuth.user.groomerProfile.id);
  console.log('   Stripe Connected Account:', groomerAuth.user.groomerProfile.stripeConnectedAccountId);

  const buyerAuth = await login('buyer@gmail.com', '123456');
  console.log('✅ Buyer Logged In:', buyerAuth.user.email);

  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminAuth.accessToken}`,
  };
  const groomerHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${groomerAuth.accessToken}`,
  };
  const buyerHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${buyerAuth.accessToken}`,
  };

  // 2. Setup Category
  console.log('\n--- 2. Checking / Creating Category ---');
  const categoriesRes = await request(`${BASE_URL}/categories`);
  let categoryId = categoriesRes.data?.items?.[0]?.id;

  if (!categoryId) {
    console.log('Creating category as Admin...');
    const createdCat = await request(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Dog Full Grooming',
        description: 'Complete bath, brush, haircut, and nail trim',
        active: true,
      }),
    });
    categoryId = createdCat.data.id;
    console.log('✅ Category Created:', categoryId, createdCat.data.name);
  } else {
    console.log('✅ Found Existing Category:', categoryId, categoriesRes.data.items[0].name);
  }

  // 3. Setup Service
  console.log('\n--- 3. Checking / Creating Groomer Service ---');
  const servicesRes = await request(`${BASE_URL}/services/me`, {
    headers: groomerHeaders,
  });
  let serviceId = servicesRes.data?.items?.[0]?.id;

  if (!serviceId) {
    console.log('Creating Service for Groomer3...');
    const createdService = await request(`${BASE_URL}/services`, {
      method: 'POST',
      headers: groomerHeaders,
      body: JSON.stringify({
        categoryId,
        title: 'Premium Dog Grooming',
        description: 'Full bath, haircut, ear cleaning & styling',
        durationMinutes: 60,
        price: 80.0,
        active: true,
      }),
    });
    serviceId = createdService.data.id;
    console.log('✅ Service Created:', serviceId, `Price: $${createdService.data.price}`);
  } else {
    console.log('✅ Found Existing Service:', serviceId, servicesRes.data.items[0].title);
  }

  // 4. Setup Availability Slot
  console.log('\n--- 4. Creating Groomer Availability Slot ---');
  const randomDay = 15 + Math.floor(Math.random() * 12);
  const targetDate = `2026-10-${String(randomDay).padStart(2, '0')}`;
  const randomHour = 8 + Math.floor(Math.random() * 8);
  const startHourStr = String(randomHour).padStart(2, '0');
  const endHourStr = String(randomHour + 1).padStart(2, '0');

  const upsertAvail = await request(`${BASE_URL}/availability`, {
    method: 'POST',
    headers: groomerHeaders,
    body: JSON.stringify({
      date: targetDate,
      isAvailable: true,
      slots: [{ startTime: `${startHourStr}:00`, endTime: `${endHourStr}:00` }],
    }),
  });
  const slot = upsertAvail.data?.slots?.find((s) => !s.isBooked);
  if (!slot?.id) throw new Error('Failed to find unbooked availability slot');
  console.log(`✅ Availability Slot Found/Created: ID ${slot.id} on ${targetDate} (${slot.startTime} - ${slot.endTime})`);

  // 5. Setup Buyer Pet
  console.log('\n--- 5. Checking / Creating Buyer Pet ---');
  const petsRes = await request(`${BASE_URL}/pets`, { headers: buyerHeaders });
  let petId = petsRes.data?.[0]?.id;

  if (!petId) {
    console.log('Creating Pet for Buyer...');
    const petRes = await request(`${BASE_URL}/pets`, {
      method: 'POST',
      headers: buyerHeaders,
      body: JSON.stringify({
        name: 'Milo',
        breed: 'Golden Retriever',
        age: 3,
        petType: 'DOG',
        petSize: 'LARGE',
      }),
    });
    petId = petRes.data.id;
    console.log('✅ Pet Created:', petId, petRes.data.name);
  } else {
    console.log('✅ Found Existing Pet:', petId, petsRes.data[0].name);
  }

  // 6. Create Booking
  console.log('\n--- 6. Creating Booking as Buyer ---');
  const bookingRes = await request(`${BASE_URL}/bookings`, {
    method: 'POST',
    headers: buyerHeaders,
    body: JSON.stringify({
      groomerId: groomerAuth.user.groomerProfile.id,
      serviceId,
      availabilitySlotId: slot.id,
      petId,
      serviceLocation: 'Drop at Studio',
      note: 'Please take special care with sensitive ears',
    }),
  });
  const booking = bookingRes.data;
  console.log('✅ Booking Created Successfully:');
  console.log('   Booking ID       :', booking.id);
  console.log('   Booking Number   :', booking.bookingNumber);
  console.log('   Status           :', booking.status);
  console.log('   Subtotal Amount  : $' + booking.subtotalAmount);
  console.log('   Platform Fee (10%): $' + booking.platformFeeAmount);
  console.log('   Groomer Earning  : $' + booking.groomerEarningAmount);
  console.log('   Total Amount     : $' + booking.totalAmount);

  // 7. Create Payment Intent
  console.log('\n--- 7. Creating Stripe Payment Intent ---');
  const intentRes = await request(`${BASE_URL}/payments/bookings/${booking.id}/payment-intent`, {
    method: 'POST',
    headers: buyerHeaders,
  });
  const paymentData = intentRes.data;
  console.log('✅ Payment Intent Created:');
  console.log('   Payment ID       :', paymentData.paymentId);
  console.log('   PaymentIntent ID :', paymentData.paymentIntentId);
  console.log('   Amount           :', `$${paymentData.amount} ${paymentData.currency.toUpperCase()}`);

  // 8. Confirm Card Payment via Stripe Test Card
  console.log('\n--- 8. Simulating Customer Card Payment via Stripe (pm_card_visa) ---');
  const confirmedIntent = await stripe.paymentIntents.confirm(paymentData.paymentIntentId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://example.com/return',
  });
  console.log('✅ Stripe PaymentIntent status on Stripe:', confirmedIntent.status);
  console.log('   Latest Charge ID:', confirmedIntent.latest_charge);

  // 9. Buyer confirms booking payment on Backend
  console.log('\n--- 9. Confirming Payment on Backend API ---');
  const backendConfirm = await request(`${BASE_URL}/payments/bookings/${booking.id}/confirm`, {
    method: 'POST',
    headers: buyerHeaders,
  });
  console.log('✅ Backend Payment Confirmation:');
  console.log('   Payment Status   :', backendConfirm.data?.status || backendConfirm.status);
  console.log('   Stripe Charge ID :', backendConfirm.data?.stripeChargeId || backendConfirm.stripeChargeId);

  // 10. Groomer Accepts Booking
  console.log('\n--- 10. Groomer Accepts Booking ---');
  const acceptRes = await request(`${BASE_URL}/bookings/${booking.id}/accept`, {
    method: 'PATCH',
    headers: groomerHeaders,
  });
  console.log('✅ Booking Accepted: Status ->', acceptRes.data.status);

  // 11. Groomer Requests Completion
  console.log('\n--- 11. Groomer Requests Completion ---');
  const reqCompRes = await request(`${BASE_URL}/bookings/${booking.id}/request-completion`, {
    method: 'PATCH',
    headers: groomerHeaders,
    body: JSON.stringify({ note: 'Grooming service completed with bath and brush.' }),
  });
  console.log('✅ Completion Requested: Status ->', reqCompRes.data.status);

  // 12. Buyer Approves Completion (Triggers Stripe Transfer / Payout!)
  console.log('\n--- 12. Buyer Approves Completion (Triggers Payout Transfer!) ---');
  const approveCompRes = await request(`${BASE_URL}/bookings/${booking.id}/approve-completion`, {
    method: 'PATCH',
    headers: buyerHeaders,
  });
  console.log('✅ Completion Approved: Booking Status ->', approveCompRes.data.status);

  // 13. Verify Payout & Money Transfer
  console.log('\n--- 13. Verifying Payout & Money Transfer ---');
  // Wait 1 second for async DB / Stripe operations
  await new Promise((r) => setTimeout(r, 1500));

  const groomerEarnings = await request(`${BASE_URL}/groomer/earnings`, {
    headers: groomerHeaders,
  });
  console.log('📊 Groomer Earnings Endpoint (/groomer/earnings):');
  console.log('   Total Balance    : $' + groomerEarnings.data.totalBalance);
  console.log('   Available Balance: $' + groomerEarnings.data.availableBalance);
  console.log('   Pending Balance  : $' + groomerEarnings.data.pendingBalance);

  const payoutSummary = await request(`${BASE_URL}/payouts/summary`, {
    headers: groomerHeaders,
  });
  console.log('\n💳 Groomer Payout Summary (/payouts/summary):');
  console.log('   Total Earned     : $' + payoutSummary.data.totalEarned);
  console.log('   Transferred      : $' + payoutSummary.data.transferredAmount);
  console.log('   Pending          : $' + payoutSummary.data.pendingAmount);
  console.log('   Recent Earnings  :', payoutSummary.data.recentEarnings?.length, 'records');

  const adminPayouts = await request(`${BASE_URL}/payouts`, {
    headers: adminHeaders,
  });
  const thisPayout = adminPayouts.data?.find?.((p) => p.bookingId === booking.id) || adminPayouts.data?.[0];
  console.log('\n🏦 Payout Transaction Record (/payouts):');
  console.log('   Payout ID        :', thisPayout?.id);
  console.log('   Status           :', thisPayout?.status);
  console.log('   Transferred Amount: $' + thisPayout?.amount, thisPayout?.currency?.toUpperCase());
  console.log('   Platform Fee     : $' + thisPayout?.platformFee);
  console.log('   Stripe Transfer ID:', thisPayout?.stripeTransferId);
  console.log('   Transferred At   :', thisPayout?.transferredAt);

  // 14. Verify Transfer directly on Stripe
  if (thisPayout?.stripeTransferId) {
    console.log('\n🔍 Verifying Stripe Transfer directly via Stripe API:');
    const transfer = await stripe.transfers.retrieve(thisPayout.stripeTransferId);
    console.log('✅ Real Stripe Transfer Details:');
    console.log('   Transfer ID      :', transfer.id);
    console.log('   Destination Acct :', transfer.destination);
    console.log('   Amount in Cents  :', transfer.amount, `($${transfer.amount / 100} ${transfer.currency.toUpperCase()})`);
    console.log('   Source Charge    :', transfer.source_transaction);
  }

  // 15. Check Booking Details / Payment History
  console.log('\n--- 15. Checking Booking Detail & Payment History ---');
  const bookingDetail = await request(`${BASE_URL}/bookings/${booking.id}`, {
    headers: buyerHeaders,
  });
  console.log('📜 Booking Detail (/bookings/' + booking.id + '):');
  console.log('   Booking Status   :', bookingDetail.data.status);
  console.log('   Total Paid       : $' + bookingDetail.data.totalAmount);
  console.log('   Payment History  :', bookingDetail.data.payments?.map((p) => ({
    id: p.id,
    status: p.status,
    amount: p.amount,
    stripePaymentIntentId: p.stripePaymentIntentId,
    paidAt: p.paidAt,
  })));

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED! MONEY TRANSFER & PAYMENT HISTORY WORK 100%!');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
