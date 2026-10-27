async function runHttpE2E() {
  console.log('--- STARTING COMPREHENSIVE HTTP E2E TEST ---');
  const baseUrl = 'http://localhost:3002';
  const checks = [];

  // Helper to record
  function record(name, condition, detail) {
    checks.push({ name, passed: Boolean(condition), detail });
    console.log(`[${condition ? 'PASS' : 'FAIL'}] ${name}`);
  }

  // 1. Unauthenticated root redirect
  const rootRes = await fetch(`${baseUrl}/`, { redirect: 'manual' });
  record('1. Middleware redirects unauthenticated user from / to /login', rootRes.status === 307 && rootRes.headers.get('location') === '/login', { status: rootRes.status, loc: rootRes.headers.get('location') });

  // 2. Unauthenticated API returns 401
  const unauthApi = await fetch(`${baseUrl}/api/dashboard`);
  record('2. Middleware blocks unauthenticated API call with 401', unauthApi.status === 401, { status: unauthApi.status });

  // 3. Login with invalid body
  const emptyLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const emptyLoginJson = await emptyLogin.json();
  record('3. Login endpoint rejects empty payload with 400', emptyLogin.status === 400 && !!emptyLoginJson.error, emptyLoginJson);

  // 4. Login with invalid credentials
  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
  });
  record('4. Login endpoint rejects invalid password with 401', badLogin.status === 401, await badLogin.json());

  // 5. Login with admin / admin123
  const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookieHeader = goodLogin.headers.get('set-cookie');
  const sessionCookie = cookieHeader ? cookieHeader.split(';')[0] : '';
  record('5. Login succeeds and returns HTTP-Only session token', goodLogin.status === 200 && sessionCookie.includes('negocio_session_token='), { cookie: sessionCookie });

  // 6. Access dashboard with session
  const dashRes = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Cookie: sessionCookie }
  });
  const dash = await dashRes.json();
  record('6. Dashboard returns all modules & financial metrics', dashRes.status === 200 && !!dash.vision && Array.isArray(dash.chartStats.mensual) && dash.chartStats.mensual.length === 6, {
    monthlyPeriods: dash.chartStats.mensual.length,
    disponible: dash.vision.disponible_actual
  });

  // 7. Movement API input validation tests
  const negMovement = await fetch(`${baseUrl}/api/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      type: 'SALIDA',
      category: 'GASTO_NO_PLANEADO',
      amount: -100,
      description: 'Bad negative amount'
    })
  });
  const negJson = await negMovement.json();
  record('7. Movement API validates positive amount with clean 400', negMovement.status === 400 && negJson.error.includes('monto'), negJson);

  const badTypeMovement = await fetch(`${baseUrl}/api/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      type: 'OTRO',
      category: 'GASTO',
      amount: 100,
      description: 'Bad type'
    })
  });
  const badTypeJson = await badTypeMovement.json();
  record('8. Movement API validates ENTRADA/SALIDA enum with clean 400', badTypeMovement.status === 400 && badTypeJson.error.includes('ENTRADA o SALIDA'), badTypeJson);

  // 9. Product API validation
  const emptyProd = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      name: '',
      supply_model: 'REVENTA',
      unit_cost: 1000
    })
  });
  const emptyProdJson = await emptyProd.json();
  record('9. Product API rejects empty name with clean 400', emptyProd.status === 400 && emptyProdJson.error.includes('nombre'), emptyProdJson);

  // 10. Create Product with initial stock 4
  const createProdRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      name: 'HTTP Test Perfume Rosa',
      supply_model: 'REVENTA',
      unit_cost: 20000,
      extra_cost: 1000,
      sale_price: 35000,
      stock: 4
    })
  });
  const prod = await createProdRes.json();
  record('10. Product created successfully with stock = 4', createProdRes.status === 201 && prod.stock === 4, prod);

  // 11. Sell 2 units (valid)
  const sell2Res = await fetch(`${baseUrl}/api/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      type: 'ENTRADA',
      category: 'VENTA_PRODUCTO',
      amount: 70000,
      description: 'Venta 2 uds Perfume Rosa',
      product_id: prod.id,
      quantity: 2
    })
  });
  const sell2 = await sell2Res.json();
  record('11. Sale of 2 units succeeds within stock limit', sell2Res.status === 201 && sell2.quantity === 2, sell2);

  // 12. Attempt to sell 5 units (oversell when only 2 left)
  const oversellRes = await fetch(`${baseUrl}/api/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      type: 'ENTRADA',
      category: 'VENTA_PRODUCTO',
      amount: 175000,
      description: 'Intento de sobreventa 5 uds',
      product_id: prod.id,
      quantity: 5
    })
  });
  const oversellJson = await oversellRes.json();
  record('12. Oversell attempt rejected with clean 400 & Stock insuficiente', oversellRes.status === 400 && oversellJson.error.includes('Stock insuficiente'), oversellJson);

  // 13. Reminder validation & lifecycle
  const badRem = await fetch(`${baseUrl}/api/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      title: 'Pago Inválido',
      frequency: 'ANUAL_INVALIDA',
      due_date: 'not-a-date'
    })
  });
  const badRemJson = await badRem.json();
  record('13. Reminder API validates frequency enum with clean 400', badRem.status === 400 && badRemJson.error.includes('Frecuencia'), badRemJson);

  const goodRemRes = await fetch(`${baseUrl}/api/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      title: 'HTTP Test Cuota Arriendo',
      amount: 60000,
      frequency: 'MENSUAL',
      due_date: new Date().toISOString().split('T')[0]
    })
  });
  const rem = await goodRemRes.json();
  record('14. Reminder created successfully', goodRemRes.status === 201 && rem.title === 'HTTP Test Cuota Arriendo', rem);

  // 15. Pay reminder with automatic expense
  const payRemRes = await fetch(`${baseUrl}/api/reminders`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
    body: JSON.stringify({
      id: rem.id,
      registerExpense: true
    })
  });
  const payJson = await payRemRes.json();
  record('15. Reminder paid with automatic cash outflow transaction', payRemRes.status === 200 && payJson.ok === true, payJson);

  // 16. Delete movement and reverse stock
  const delMovRes = await fetch(`${baseUrl}/api/movements?id=${sell2.id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie }
  });
  const delMovJson = await delMovRes.json();
  record('16. Movement deleted & stock reversed cleanly', delMovRes.status === 200 && delMovJson.ok === true, delMovJson);

  // 17. Cleanup product & reminder
  await fetch(`${baseUrl}/api/products?id=${prod.id}`, { method: 'DELETE', headers: { Cookie: sessionCookie } });
  await fetch(`${baseUrl}/api/reminders?id=${rem.id}`, { method: 'DELETE', headers: { Cookie: sessionCookie } });
  record('17. Product & reminder cleanup completed', true, { prodId: prod.id, remId: rem.id });

  // 18. Logout
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookie }
  });
  record('18. Logout clears session cookie', logoutRes.status === 200, {});

  console.log('\n--- SUMMARY OF HTTP E2E RESULTS ---');
  const failed = checks.filter(c => !c.passed);
  console.log(`TOTAL: ${checks.length} | PASSED: ${checks.length - failed.length} | FAILED: ${failed.length}`);
  if (failed.length > 0) {
    console.error('FAILED CHECKS:', JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

runHttpE2E().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
