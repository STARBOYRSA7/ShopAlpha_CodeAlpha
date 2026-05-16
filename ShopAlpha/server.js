const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'shopalpha_secret_key_change_in_prod';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'shopalpha.db');

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, original_price INTEGER, emoji TEXT NOT NULL, description TEXT NOT NULL, stock INTEGER DEFAULT 100)`);
  db.run(`CREATE TABLE IF NOT EXISTS cart_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, UNIQUE(user_id, product_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, total INTEGER NOT NULL, shipping INTEGER NOT NULL DEFAULT 0, status TEXT DEFAULT 'processing', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, product_name TEXT NOT NULL, product_emoji TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL)`);

  const count = db.exec('SELECT COUNT(*) FROM products')[0]?.values[0][0] || 0;
  if (count === 0) {
    const products = [
      ['Wireless Headphones','Electronics',1899,2499,'🎧','Premium sound with 30hr battery life, active noise cancellation and ultra-comfortable ear cups.'],
      ['Smart Watch Pro','Electronics',3299,3999,'⌚','Track fitness, messages, and health metrics from your wrist. GPS, heart rate, and 7-day battery.'],
      ['Slim Laptop Stand','Electronics',649,null,'💻','Ergonomic aluminium stand adjustable to 6 angles. Compatible with all 11-17 inch laptops.'],
      ['Running Sneakers','Sports',1299,1799,'👟','Lightweight performance foam sole, breathable mesh upper. Ideal for daily runs and gym sessions.'],
      ['Premium Hoodie','Clothing',799,null,'🧥','400gsm French terry cotton blend. Oversized fit with kangaroo pocket and ribbed cuffs.'],
      ['Graphic Tee','Clothing',349,499,'👕','100% ring-spun cotton, pre-shrunk. Bold graphic print on a relaxed unisex fit.'],
      ['Desk Lamp LED','Home',529,null,'💡','5 colour temperatures, touch-sensitive dimming, USB charging port built in. Eye-care mode.'],
      ['Coffee Maker','Home',1599,1999,'☕','12-cup programmable drip coffee machine with built-in grinder and thermal carafe.'],
      ['Yoga Mat','Sports',449,599,'🧘','6mm thick non-slip natural rubber base. Alignment lines, carry strap included.'],
      ['Backpack 30L','Sports',899,null,'🎒','Water-resistant 600D polyester, laptop sleeve, ergonomic padded straps, 8 compartments.'],
      ['Throw Blanket','Home',399,null,'🛋️','Chunky knit merino wool blend. 130x180cm. Comes in 6 seasonal colours.'],
      ['Bluetooth Speaker','Electronics',999,1299,'🔊','360 degree sound, IPX7 waterproof, 20hr battery. Perfect for indoors and outdoor adventures.'],
    ];
    const stmt = db.prepare('INSERT INTO products (name,category,price,original_price,emoji,description) VALUES (?,?,?,?,?,?)');
    products.forEach(p => stmt.run(p));
    stmt.free();
    saveDB();
    console.log('Products seeded.');
  }
  console.log('Database ready.');
}

function saveDB() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function dbGet(sql, params=[]) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function dbAll(sql, params=[]) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const {columns, values} = result[0];
  return values.map(row => Object.fromEntries(columns.map((c,i)=>[c,row[i]])));
}

function dbRun(sql, params=[]) {
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
  saveDB();
  return { lastInsertRowid: lastId };
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const token = req.cookies.token || (req.headers.authorization||'').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired session' }); }
}

// Auth
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name||!email||!password) return res.status(400).json({ error: 'All fields required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (dbGet('SELECT id FROM users WHERE email=?',[email])) return res.status(409).json({ error: 'Account already exists.' });
  const hashed = bcrypt.hashSync(password, 10);
  const result = dbRun('INSERT INTO users (name,email,password) VALUES (?,?,?)',[name,email,hashed]);
  const user = { id: result.lastInsertRowid, name, email };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn:'7d' });
  res.cookie('token', token, { httpOnly:true, maxAge:7*24*60*60*1000, sameSite:'lax' });
  res.json({ user, token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email||!password) return res.status(400).json({ error: 'Email and password required.' });
  const user = dbGet('SELECT * FROM users WHERE email=?',[email]);
  if (!user||!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid email or password.' });
  const payload = { id:user.id, name:user.name, email:user.email };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn:'7d' });
  res.cookie('token', token, { httpOnly:true, maxAge:7*24*60*60*1000, sameSite:'lax' });
  res.json({ user: payload, token });
});

app.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ message:'Logged out' }); });

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = dbGet('SELECT id,name,email,created_at FROM users WHERE id=?',[req.user.id]);
  if (!user) return res.status(404).json({ error:'User not found' });
  res.json({ user });
});

// Products
app.get('/api/products', (req, res) => {
  const { category } = req.query;
  const products = (category && category!=='all')
    ? dbAll('SELECT * FROM products WHERE category=?',[category])
    : dbAll('SELECT * FROM products');
  res.json({ products });
});

app.get('/api/products/:id', (req, res) => {
  const product = dbGet('SELECT * FROM products WHERE id=?',[req.params.id]);
  if (!product) return res.status(404).json({ error:'Product not found' });
  res.json({ product });
});

// Cart
app.get('/api/cart', requireAuth, (req, res) => {
  const items = dbAll(`SELECT ci.id,ci.quantity,p.id as product_id,p.name,p.category,p.price,p.original_price,p.emoji,p.description,p.stock FROM cart_items ci JOIN products p ON ci.product_id=p.id WHERE ci.user_id=?`,[req.user.id]);
  res.json({ items });
});

app.post('/api/cart', requireAuth, (req, res) => {
  const { product_id, quantity=1 } = req.body;
  if (!product_id) return res.status(400).json({ error:'product_id required' });
  if (!dbGet('SELECT id FROM products WHERE id=?',[product_id])) return res.status(404).json({ error:'Product not found' });
  if (dbGet('SELECT id FROM cart_items WHERE user_id=? AND product_id=?',[req.user.id,product_id])) {
    dbRun('UPDATE cart_items SET quantity=quantity+? WHERE user_id=? AND product_id=?',[quantity,req.user.id,product_id]);
  } else {
    dbRun('INSERT INTO cart_items (user_id,product_id,quantity) VALUES (?,?,?)',[req.user.id,product_id,quantity]);
  }
  res.json({ message:'Added to cart' });
});

app.put('/api/cart/:pid', requireAuth, (req, res) => {
  const { quantity } = req.body;
  if (quantity<=0) { dbRun('DELETE FROM cart_items WHERE user_id=? AND product_id=?',[req.user.id,req.params.pid]); return res.json({message:'Removed'}); }
  dbRun('UPDATE cart_items SET quantity=? WHERE user_id=? AND product_id=?',[quantity,req.user.id,req.params.pid]);
  res.json({ message:'Updated' });
});

app.delete('/api/cart/:pid', requireAuth, (req, res) => {
  dbRun('DELETE FROM cart_items WHERE user_id=? AND product_id=?',[req.user.id,req.params.pid]);
  res.json({ message:'Removed' });
});

app.delete('/api/cart', requireAuth, (req, res) => {
  dbRun('DELETE FROM cart_items WHERE user_id=?',[req.user.id]);
  res.json({ message:'Cleared' });
});

// Orders
app.post('/api/orders', requireAuth, (req, res) => {
  const items = dbAll(`SELECT ci.quantity,p.id as product_id,p.name,p.emoji,p.price FROM cart_items ci JOIN products p ON ci.product_id=p.id WHERE ci.user_id=?`,[req.user.id]);
  if (!items.length) return res.status(400).json({ error:'Cart is empty' });
  const subtotal = items.reduce((s,i)=>s+i.price*i.quantity,0);
  const shipping = subtotal>=1000?0:99;
  const total = subtotal+shipping;
  const { lastInsertRowid: orderId } = dbRun('INSERT INTO orders (user_id,total,shipping) VALUES (?,?,?)',[req.user.id,total,shipping]);
  items.forEach(item => dbRun('INSERT INTO order_items (order_id,product_id,product_name,product_emoji,price,quantity) VALUES (?,?,?,?,?,?)',[orderId,item.product_id,item.name,item.emoji,item.price,item.quantity]));
  dbRun('DELETE FROM cart_items WHERE user_id=?',[req.user.id]);
  res.json({ message:'Order placed', order_id:orderId, total });
});

app.get('/api/orders', requireAuth, (req, res) => {
  const orders = dbAll('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC',[req.user.id]);
  res.json({ orders: orders.map(o=>({...o, items: dbAll('SELECT * FROM order_items WHERE order_id=?',[o.id]) })) });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname,'public','index.html')));

initDB().then(()=>{
  app.listen(PORT, ()=>console.log(`ShopAlpha running on http://localhost:${PORT}`));
}).catch(err=>{ console.error('DB init failed:',err); process.exit(1); });
