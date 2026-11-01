const { Client } = require('pg');

const CONFIG = {
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: '123',
  database: 'zaim',
};

async function insertOne(client, table, columns, values, returning = 'id') {
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const result = await client.query(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')})
     VALUES (${placeholders}) RETURNING "${returning}"`,
    values,
  );
  return result.rows[0][returning];
}

(async () => {
  const client = new Client(CONFIG);
  await client.connect();

  const existing = await client.query('SELECT COUNT(*)::int AS n FROM books');
  if (existing.rows[0].n > 0) {
    console.log('Seed dilewati: tabel books sudah berisi data.');
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    const categoryIds = {};
    for (const name of ['Programming', 'Database', 'Business', 'Design', 'Education']) {
      categoryIds[name] = await insertOne(client, 'categories', ['name'], [name]);
    }

    const publisherIds = {};
    for (const name of ['Gramedia', 'Elex Media Komputindo', 'Informatika']) {
      publisherIds[name] = await insertOne(client, 'publishers', ['name'], [name]);
    }

    const authorIds = {};
    for (const name of [
      'Robert C. Martin',
      'Andrew Hunt',
      'David Thomas',
      'Abraham Silberschatz',
      'Eric Evans',
    ]) {
      authorIds[name] = await insertOne(client, 'authors', ['name'], [name]);
    }

    const books = [
      {
        title: 'Clean Code',
        isbn: '978-0132350884',
        publishedYear: 2008,
        price: 450000,
        stock: 12,
        category: 'Programming',
        publisher: 'Gramedia',
        authors: ['Robert C. Martin'],
      },
      {
        title: 'The Pragmatic Programmer',
        isbn: '978-0135957059',
        publishedYear: 2019,
        price: 380000,
        stock: 8,
        category: 'Programming',
        publisher: 'Gramedia',
        authors: ['Andrew Hunt', 'David Thomas'],
      },
      {
        title: 'Database System Concepts',
        isbn: '978-0078022159',
        publishedYear: 2010,
        price: 620000,
        stock: 5,
        category: 'Database',
        publisher: 'Informatika',
        authors: ['Abraham Silberschatz'],
      },
      {
        title: 'Domain-Driven Design',
        isbn: '978-0321125217',
        publishedYear: 2003,
        price: 540000,
        stock: 4,
        category: 'Design',
        publisher: 'Elex Media Komputindo',
        authors: ['Eric Evans'],
      },
      {
        title: 'The Lean Startup',
        isbn: '978-0307887894',
        publishedYear: 2011,
        price: 210000,
        stock: 20,
        category: 'Business',
        publisher: 'Gramedia',
        authors: [],
      },
      {
        title: 'Belajar TypeORM',
        isbn: '978-6020000001',
        publishedYear: 2024,
        price: 150000,
        stock: 30,
        category: 'Education',
        publisher: 'Informatika',
        authors: [],
      },
    ];

    const bookIds = [];
    for (const book of books) {
      const id = await insertOne(
        client,
        'books',
        ['title', 'isbn', 'publishedYear', 'price', 'stock', 'category_id', 'publisher_id'],
        [
          book.title,
          book.isbn,
          book.publishedYear,
          book.price,
          book.stock,
          categoryIds[book.category],
          publisherIds[book.publisher],
        ],
      );
      bookIds.push(id);
      for (const author of book.authors) {
        await client.query(
          'INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)',
          [id, authorIds[author]],
        );
      }
    }

    const customerId = await insertOne(
      client,
      'customers',
      ['name', 'email', 'phone'],
      ['Budi Santoso', 'budi@email.com', '081234567890'],
    );

    await insertOne(
      client,
      'customer_addresses',
      ['customer_id', 'recipient_name', 'phone', 'address', 'city', 'postal_code'],
      [customerId, 'Budi Santoso', '081234567890', 'Jl. Merdeka No. 10', 'Bandung', '40111'],
    );

    const items = [
      { bookId: bookIds[0], quantity: 1, price: 450000 },
      { bookId: bookIds[1], quantity: 2, price: 380000 },
    ];
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const orderId = await insertOne(
      client,
      'orders',
      ['customer_id', 'order_number', 'status', 'total_amount'],
      [customerId, 'ORD-SEED-001', 'paid', totalAmount],
    );

    for (const item of items) {
      await insertOne(
        client,
        'order_items',
        ['order_id', 'book_id', 'quantity', 'price', 'subtotal'],
        [orderId, item.bookId, item.quantity, item.price, item.price * item.quantity],
      );
    }

    await insertOne(
      client,
      'payments',
      ['order_id', 'payment_method', 'amount', 'status', 'paid_at'],
      [orderId, 'bank_transfer', totalAmount, 'paid', new Date()],
    );

    await insertOne(
      client,
      'shipments',
      ['order_id', 'courier', 'tracking_number', 'status', 'shipped_at'],
      [orderId, 'JNE', 'JNE-SEED-0001', 'shipped', new Date()],
    );

    await client.query('COMMIT');
    console.log('Seed selesai.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  for (const table of [
    'categories',
    'publishers',
    'authors',
    'books',
    'book_authors',
    'customers',
    'customer_addresses',
    'orders',
    'order_items',
    'payments',
    'shipments',
  ]) {
    const result = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    console.log(table.padEnd(20), result.rows[0].n);
  }

  await client.end();
})();
