const BASE = 'http://127.0.0.1:3001/api/v1';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? ' -> ' + extra : ''}`);
  if (!ok) process.exitCode = 1;
}

(async () => {
  const books = await call('GET', '/books');
  check('GET /books', books.status === 200 && books.json.length === 6, books.json.length);
  const seededBook = books.json.find((b) => b.bookAuthors.length > 0);
  check('book punya relasi category/publisher/author', Boolean(
    seededBook && seededBook.category && seededBook.publisher && seededBook.bookAuthors[0].author,
  ));

  const customers = await call('GET', '/customers');
  check('GET /customers + addresses', customers.status === 200 && customers.json[0].addresses.length === 1);

  const orders = await call('GET', '/orders');
  const seededOrder = orders.json[0];
  check(
    'GET /orders + items/payment/shipment',
    orders.status === 200 &&
      seededOrder.items.length === 2 &&
      seededOrder.payment.status === 'paid' &&
      seededOrder.shipment.courier === 'JNE' &&
      seededOrder.totalAmount === 1210000,
    String(seededOrder.totalAmount),
  );

  // kategori: create, update, delete
  const cat = await call('POST', '/categories', { name: 'Testing ' + Date.now() });
  check('POST /categories', cat.status === 201);
  const catUpdate = await call('PUT', `/categories/${cat.json.id}`, { name: 'Testing Updated ' + Date.now() });
  check('PUT /categories/:id', catUpdate.status === 200 && catUpdate.json.name.startsWith('Testing Updated'));
  check('DELETE /categories/:id', (await call('DELETE', `/categories/${cat.json.id}`)).status === 200);

  // customer + address
  const customer = await call('POST', '/customers', {
    name: 'Smoke Tester',
    email: `smoke${Date.now()}@mail.com`,
    phone: '081200000000',
  });
  check('POST /customers', customer.status === 201);
  const address = await call('POST', `/customers/${customer.json.id}/addresses`, {
    recipientName: 'Smoke Tester',
    phone: '081200000000',
    address: 'Jl. Test No. 1',
    city: 'Jakarta',
    postalCode: '12345',
  });
  check('POST /customers/:id/addresses', address.status === 201);
  check(
    'PUT address',
    (await call('PUT', `/customers/${customer.json.id}/addresses/${address.json.id}`, { city: 'Surabaya' }))
      .json.city === 'Surabaya',
  );
  check(
    'POST /customers duplicate email -> 409',
    (await call('POST', '/customers', { name: 'Dup', email: customer.json.email, phone: '08' })).status === 409,
  );

  // order + items + payment + shipment
  const book = books.json[0];
  const order = await call('POST', '/orders', {
    customerId: customer.json.id,
    items: [
      { bookId: book.id, quantity: 2 },
      { bookId: books.json[2].id, quantity: 1 },
    ],
  });
  const expectedTotal = book.price * 2 + books.json[2].price;
  check(
    'POST /orders hitung total_amount',
    order.status === 201 && order.json.totalAmount === expectedTotal && order.json.items.length === 2,
    `${order.json.totalAmount} vs ${expectedTotal}`,
  );

  const added = await call('POST', `/orders/${order.json.id}/items`, { bookId: books.json[3].id, quantity: 1 });
  check('POST /orders/:id/items', added.status === 201);
  const afterAdd = await call('GET', `/orders/${order.json.id}`);
  check('total_amount dihitung ulang', afterAdd.json.totalAmount === expectedTotal + books.json[3].price);

  const payment = await call('POST', '/payments', {
    orderId: order.json.id,
    paymentMethod: 'qris',
    amount: afterAdd.json.totalAmount,
    status: 'paid',
    paidAt: new Date().toISOString(),
  });
  check('POST /payments', payment.status === 201 && payment.json.amount === afterAdd.json.totalAmount);
  check(
    'POST /payments order sama -> 409',
    (await call('POST', '/payments', { orderId: order.json.id, paymentMethod: 'qris', amount: 1 })).status === 409,
  );
  check(
    'POST /shipments',
    (await call('POST', '/shipments', { orderId: order.json.id, courier: 'SiCepat', status: 'pending' })).status === 201,
  );

  check('PUT /orders/:id status', (await call('PUT', `/orders/${order.json.id}`, { status: 'shipped' })).json.status === 'shipped');
  check('DELETE /orders/:id', (await call('DELETE', `/orders/${order.json.id}`)).status === 200);
  check('GET /orders/:id setelah delete -> 404', (await call('GET', `/orders/${order.json.id}`)).status === 404);

  // book: create, assign author, soft delete, duplicate isbn
  const author = (await call('GET', '/authors')).json[0];
  const newBook = await call('POST', '/books', {
    title: 'Buku Smoke',
    isbn: 'SMOKE-' + Date.now(),
    publishedYear: 2026,
    price: 99000.5,
    stock: 3,
    categoryId: books.json[0].categoryId,
    publisherId: books.json[0].publisherId,
  });
  check('POST /books', newBook.status === 201 && newBook.json.price === 99000.5);
  check('POST /books/:id/authors/:authorId', (await call('POST', `/books/${newBook.json.id}/authors/${author.id}`)).status === 201);
  check('GET /books/:id/authors', (await call('GET', `/books/${newBook.json.id}/authors`)).json.length === 1);
  check(
    'POST /books isbn duplikat -> 409',
    (await call('POST', '/books', { title: 'Dup ISBN', isbn: newBook.json.isbn })).status === 409,
  );
  check('DELETE /books/:id (soft delete)', (await call('DELETE', `/books/${newBook.json.id}`)).status === 200);
  check('GET /books/:id setelah soft delete -> 404', (await call('GET', `/books/${newBook.json.id}`)).status === 404);

  // cleanup customer (cascade addresses)
  check('DELETE /customers/:id', (await call('DELETE', `/customers/${customer.json.id}`)).status === 200);
})();
