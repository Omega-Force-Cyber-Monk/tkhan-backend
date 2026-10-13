'use strict';

require('dotenv').config();

const BASE_URL = 'http://localhost:3000/api/v1';

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = json?.error?.message || json?.message || JSON.stringify(json);
    throw new Error(`HTTP ${res.status} on ${options.method || 'GET'} ${url}: ${errorMsg}`);
  }
  return json;
}

async function run() {
  console.log('=====================================================');
  console.log('🧪 TESTING GROOMER TRANSACTION & EARNINGS APIS IN APP');
  console.log('=====================================================\n');

  // 1. Groomer Login
  console.log('--- 1. Login Groomer ---');
  const loginRes = await request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'groomer3@frostypeak.info',
      password: '12345678',
    }),
  });
  const token = loginRes.data.accessToken;
  const groomerUser = loginRes.data.user;
  console.log('✅ Logged in as:', groomerUser.email);
  console.log('   Groomer Profile ID:', groomerUser.groomerProfile?.id);
  console.log('   Stripe Connected Account:', groomerUser.groomerProfile?.stripeConnectedAccountId);

  const groomerHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. GET /groomer/earnings
  console.log('\n--- 2. Testing API: GET /api/v1/groomer/earnings ---');
  const earningsRes = await request(`${BASE_URL}/groomer/earnings`, {
    headers: groomerHeaders,
  });
  console.log('✅ /groomer/earnings response:');
  console.log(JSON.stringify(earningsRes.data, null, 2));

  // 3. GET /payouts/summary
  console.log('\n--- 3. Testing API: GET /api/v1/payouts/summary ---');
  const summaryRes = await request(`${BASE_URL}/payouts/summary`, {
    headers: groomerHeaders,
  });
  console.log('✅ /payouts/summary response:');
  console.log(JSON.stringify(summaryRes.data, null, 2));

  // 4. GET /bookings (Groomer Bookings List with Earnings & Payment Status)
  console.log('\n--- 4. Testing API: GET /api/v1/bookings (Groomer Bookings & Payments) ---');
  const bookingsRes = await request(`${BASE_URL}/bookings`, {
    headers: groomerHeaders,
  });
  console.log(`✅ /bookings returned ${bookingsRes.data?.items?.length || 0} booking(s):`);
  bookingsRes.data?.items?.forEach((item, idx) => {
    console.log(`\n  Booking #${idx + 1}:`);
    console.log(`    Booking Number   : ${item.bookingNumber}`);
    console.log(`    Booking Status   : ${item.status}`);
    console.log(`    Total Amount     : $${item.totalAmount}`);
    console.log(`    Groomer Earning  : $${item.earnings?.groomerEarningAmount}`);
    console.log(`    Payout ID        : ${item.earnings?.payoutId}`);
    console.log(`    Payout Status    : ${item.earnings?.payoutStatus}`);
    console.log(`    Payout Paid      : $${item.earnings?.payoutPaidAmount}`);
    console.log(`    Payout Available : $${item.earnings?.payoutAvailableAmount}`);
    console.log(`    Payments Count   : ${item.payments?.length}`);
    item.payments?.forEach((p) => {
      console.log(`      Payment ID: ${p.id} | Status: ${p.status} | Amount: $${p.amount} | Intent: ${p.stripePaymentIntentId}`);
    });
  });

  // 5. GET /payouts/transactions/:id (Single Transaction Detail)
  const firstPayoutId = summaryRes.data?.recentEarnings?.[0]?.id;
  if (firstPayoutId) {
    console.log(`\n--- 5. Testing API: GET /api/v1/payouts/transactions/${firstPayoutId} ---`);
    const txDetail = await request(`${BASE_URL}/payouts/transactions/${firstPayoutId}`, {
      headers: groomerHeaders,
    });
    console.log('✅ /payouts/transactions/:id response:');
    console.log(JSON.stringify(txDetail.data, null, 2));
  } else {
    console.log('\n⚠️ No recent payout transaction found to test detail endpoint.');
  }

  console.log('\n=====================================================');
  console.log('🎉 ALL GROOMER TRANSACTION & EARNINGS APIS TESTED!');
  console.log('=====================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
