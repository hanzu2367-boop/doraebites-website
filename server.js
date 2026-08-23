const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'orders.json');
const adminOrderStreams = new Set();

// Admin credentials (change password here)
const ADMIN_PASSWORD = 'doraebites@12_';

// Menu items
const MENU = [
  { id: 'cake', name: 'Japanese Cake', price: 30, emoji: '🍰', image: 'ChatGPT Image Aug 23, 2026, 11_03_30 PM.png', category: 'Japanese Cake' },
  { id: 'topping_maple', name: 'Drizzle Maple Syrup', price: 8, emoji: '🍁', category: 'Japanese Cake' },
  { id: 'topping_strawberry', name: 'Strawberry Syrup', price: 10, emoji: '🍓', category: 'Japanese Cake' },
  { id: 'topping_chocolate', name: 'Chocolate Syrup', price: 10, emoji: '🍫', category: 'Japanese Cake' },
  { id: 'topping_marshmallows', name: 'Mini Marshmallows', price: 5, emoji: '🫧', category: 'Japanese Cake' },
  { id: 'topping_sprinkles', name: 'Choco/Rainbow Sprinkles', price: 5, emoji: '✨', category: 'Japanese Cake' },
  { id: 'topping_powder', name: 'Powdered Milk/Choco', price: 5, emoji: '🥛', category: 'Japanese Cake' },
  { id: 'drink', name: 'Lemonade (12oz)', price: 20, emoji: '🥤', image: 'ChatGPT Image Aug 23, 2026, 11_06_49 PM.png', category: 'Drinks' },
  { id: 'yakult', name: 'Add Yakult', price: 15, emoji: '🥛', category: 'Drinks' },
];

// Order statuses
const STATUSES = {
  SCHEDULE: 'schedule',
  PREPARING: 'preparing',
  SERVING: 'serving',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load orders from file
function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading orders:', err);
  }
  return [];
}

// Save orders to file
function saveOrders(orders) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
    for (const stream of adminOrderStreams) {
      stream.write(`data: ${JSON.stringify({ updatedAt: Date.now() })}\n\n`);
    }
  } catch (err) {
    console.error('Error saving orders:', err);
  }
}

// Generate a unique receipt code
function generateReceiptCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let orders = loadOrders();
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (orders.some(o => o.receiptCode === code));
  return code;
}

// ---------- API ROUTES ----------

// Get menu
app.get('/api/menu', (req, res) => {
  res.json(MENU);
});

// Create a new order
app.post('/api/orders', (req, res) => {
  const { name, building, roomNumber, items, note } = req.body;

  if (!name || !building || !roomNumber) {
    return res.status(400).json({ error: 'Please fill in your name, building, and room number.' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Please select at least one item.' });
  }

  // Validate items and calculate total
  let total = 0;
  for (const item of items) {
    const menuItem = MENU.find(m => m.id === item.id);
    if (!menuItem) {
      return res.status(400).json({ error: 'Invalid item selected.' });
    }
    const qty = Number(item.quantity) || 1;
    if (qty < 1) {
      return res.status(400).json({ error: 'Invalid quantity.' });
    }
    total += menuItem.price * qty;
  }

  const receiptCode = generateReceiptCode();
  const order = {
    id: receiptCode + '-' + Date.now(),
    receiptCode,
    name,
    building,
    roomNumber,
    items,
    total,
    note: note || '',
    status: STATUSES.SCHEDULE,
    customMessage: '',
    customerReply: '',
    createdAt: new Date().toISOString()
  };

  const orders = loadOrders();
  orders.unshift(order); // newest first
  saveOrders(orders);

  res.status(201).json({ order });
});

// Track order by receipt code
app.get('/api/orders/track/:code', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const orders = loadOrders();
  const order = orders.find(o => o.receiptCode === code);

  if (!order) {
    return res.status(404).json({ error: 'No order found with that receipt code. Please check your code.' });
  }

  // Build response with item names
  const response = {
    receiptCode: order.receiptCode,
    name: order.name,
    building: order.building,
    roomNumber: order.roomNumber,
    total: order.total,
    status: order.status,
    customMessage: order.customMessage,
    customerReply: order.customerReply || '',
    note: order.note,
    createdAt: order.createdAt,
    items: order.items.map(item => {
      const menuItem = MENU.find(m => m.id === item.id);
      return {
        name: menuItem ? menuItem.name : item.id,
        price: menuItem ? menuItem.price : 0,
        quantity: item.quantity || 1
      };
    })
  };

  res.json({ order: response });
});

app.post('/api/orders/:code/reply', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Please type a reply before sending it.' });

  const orders = loadOrders();
  const order = orders.find(item => item.receiptCode === code);
  if (!order) return res.status(404).json({ error: 'No order found with that receipt code.' });

  order.customerReply = message;
  saveOrders(orders);
  res.json({ success: true, customerReply: message });
});

// ---------- ADMIN ROUTES (simple token-based auth) ----------

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = Buffer.from('admin:' + Date.now()).toString('base64');
    return res.json({ token });
  }
  res.status(401).json({ error: 'Wrong password. Please try again.' });
});

// Middleware to check admin token
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || !token.startsWith('YWRtaW46')) {
    return res.status(401).json({ error: 'Unauthorized. Please login again.' });
  }
  next();
}

// Live admin order stream. It pushes changes without polling or page refreshes.
app.get('/api/admin/orders/stream', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  adminOrderStreams.add(res);

  req.on('close', () => {
    adminOrderStreams.delete(res);
  });
});

// Get all orders (admin)
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = loadOrders();
  res.json({ orders });
});

// Update order status (admin)
app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!Object.values(STATUSES).includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const orders = loadOrders();
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  order.status = status;
  if (status === STATUSES.CANCELLED) {
    order.cancelledAt = new Date().toISOString();
  }
  saveOrders(orders);

  res.json({ order });
});

// Send custom message to an order (admin)
app.put('/api/admin/orders/:id/message', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  const orders = loadOrders();
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  order.customMessage = message || '';
  saveOrders(orders);

  res.json({ order });
});

// Cancel order (admin)
app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const orders = loadOrders();
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  order.status = STATUSES.CANCELLED;
  order.cancelledAt = new Date().toISOString();
  saveOrders(orders);

  res.json({ success: true });
});

app.delete('/api/admin/orders/:id/trash', requireAdmin, (req, res) => {
  const orders = loadOrders();
  const index = orders.findIndex(order => order.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Order not found.' });
  if (orders[index].status !== STATUSES.CANCELLED) {
    return res.status(400).json({ error: 'Only cancelled orders can be deleted.' });
  }
  orders.splice(index, 1);
  saveOrders(orders);
  res.json({ success: true });
});

// ---------- STATUS META ----------
app.get('/api/statuses', (req, res) => {
  res.json(STATUSES);
});

app.listen(PORT, () => {
  console.log(`Doraebites server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});