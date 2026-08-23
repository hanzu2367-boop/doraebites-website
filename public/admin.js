// ---------- Admin State ----------
let adminToken = null;
localStorage.removeItem('doraebites_admin_token');
let allOrders = [];
let currentFilter = 'all';
let orderStream = null;

const STATUS_LABELS = {
  schedule: 'Scheduled',
  preparing: 'Preparing',
  serving: 'Serving',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const MENU_NAMES = {
  cake: 'Japanese Cake',
  topping_maple: 'Drizzle Maple Syrup',
  topping_strawberry: 'Strawberry Syrup',
  topping_chocolate: 'Chocolate Syrup',
  topping_marshmallows: 'Mini Marshmallows',
  topping_sprinkles: 'Choco/Rainbow Sprinkles',
  topping_powder: 'Powdered Milk/Choco',
  drink: 'Lemonade (12oz)',
  yakult: 'Add Yakult',
};

// ---------- Login ----------
async function adminLogin() {
  const password = document.getElementById('admin-password').value;
  const errorDiv = document.getElementById('login-error');

  if (!password) {
    errorDiv.textContent = 'Please enter the password.';
    errorDiv.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorDiv.textContent = data.error || 'Wrong password. Please try again.';
      errorDiv.style.display = 'block';
      return;
    }

    adminToken = data.token;
    localStorage.setItem('doraebites_admin_token', adminToken);
    showAdminPanel();
    loadOrders();
  } catch (err) {
    errorDiv.textContent = 'Network error. Please try again.';
    errorDiv.style.display = 'block';
  }
}

function showAdminPanel() {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  connectOrderStream();
}

function adminLogout() {
  adminToken = null;
  if (orderStream) {
    orderStream.close();
    orderStream = null;
  }
  localStorage.removeItem('doraebites_admin_token');
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('admin-password').value = '';
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('admin-password');
  const toggleButton = document.getElementById('password-toggle');
  const showingPassword = passwordInput.type === 'text';

  passwordInput.type = showingPassword ? 'password' : 'text';
  toggleButton.textContent = showingPassword ? '👁' : '🙈';
  toggleButton.setAttribute('aria-label', showingPassword ? 'Show password' : 'Hide password');
}

// Enter key on password
document.getElementById('admin-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    adminLogin();
  }
});

// ---------- Load Orders ----------
async function loadOrders(showLoading = true) {
  const listEl = document.getElementById('orders-list');
  if (showLoading) {
    listEl.innerHTML = `<div class="spinner">Loading orders...</div>`;
  }

  try {
    const res = await fetch('/api/admin/orders', {
      headers: { 'X-Admin-Token': adminToken }
    });

    if (res.status === 401) {
      adminLogout();
      document.getElementById('login-error').textContent = 'Session expired. Please login again.';
      document.getElementById('login-error').style.display = 'block';
      return;
    }

    const data = await res.json();
    allOrders = data.orders || [];
    renderOrders();
    updateStats();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">
      <div class="icon">⚠️</div>
      <p>Failed to load orders. Check your connection.</p>
    </div>`;
  }
}

function connectOrderStream() {
  if (orderStream || !adminToken) return;
  orderStream = new EventSource(`/api/admin/orders/stream?token=${encodeURIComponent(adminToken)}`);
  orderStream.onmessage = () => loadOrders(false);
  orderStream.onerror = () => {
    orderStream.close();
    orderStream = null;
    setTimeout(connectOrderStream, 3000);
  };
}

// ---------- Stats ----------
function updateStats() {
  const activeOrders = allOrders.filter(o => o.status !== 'cancelled');
  const earnings = activeOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  document.getElementById('stat-total').textContent = allOrders.length;
  document.getElementById('stat-earnings').textContent = `₱${earnings.toFixed(2)}`;
  document.getElementById('stat-schedule').textContent = allOrders.filter(o => o.status === 'schedule').length;
  document.getElementById('stat-preparing').textContent = allOrders.filter(o => o.status === 'preparing').length;
  document.getElementById('stat-serving').textContent = allOrders.filter(o => o.status === 'serving').length;
  document.getElementById('stat-completed').textContent = allOrders.filter(o => o.status === 'completed').length;
}

// ---------- Filter ----------
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filter);
  });
  renderOrders();
}

// ---------- Render Orders ----------
function renderOrders() {
  const listEl = document.getElementById('orders-list');

  let filtered = allOrders;
  if (currentFilter !== 'all') {
    filtered = allOrders.filter(o => o.status === currentFilter);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">
      <div class="icon">📭</div>
      <p>No orders found${currentFilter !== 'all' ? ` with status "${STATUS_LABELS[currentFilter]}"` : ''}.</p>
    </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(order => renderOrderCard(order)).join('');
}

function renderOrderCard(order) {
  const itemsHtml = (order.items || []).map(item => {
    const qty = item.quantity || 1;
    return `<span class="order-item-tag">${qty}× ${MENU_NAMES[item.id] || item.id}</span>`;
  }).join('');

  const noteHtml = order.note
    ? `<div class="order-note visible">📝 Note: ${order.note}</div>`
    : `<div class="order-note"></div>`;

  const currentMsgHtml = order.customMessage
    ? `<div class="current-msg visible">📢 Current message to customer: ${order.customMessage}</div>`
    : `<div class="current-msg"></div>`;

  const customerReplyHtml = order.customerReply
    ? `<div class="customer-reply visible">💬 Customer reply: ${escapeHtml(order.customerReply)}</div>`
    : `<div class="customer-reply"></div>`;

  const isCancelled = order.status === 'cancelled';
  const isCompleted = order.status === 'completed';

  return `
    <div class="order-card status-${order.status}" id="order-${order.id}">
      <div class="order-card-header">
        <div class="order-customer-info">
          <span class="order-receipt">#${order.receiptCode}</span>
          <span class="order-name">👤 ${escapeHtml(order.name)}</span>
          <span class="order-location">🏢 ${escapeHtml(order.building)} • Room ${escapeHtml(order.roomNumber)}</span>
          <span class="order-time">🕐 ${formatDate(order.createdAt)}</span>
        </div>
        <div class="order-actions">
          <select class="status-select" onchange="updateStatus('${order.id}', this.value)" ${isCancelled ? 'disabled' : ''}>
            ${Object.entries(STATUS_LABELS).map(([key, label]) => `
              <option value="${key}" ${order.status === key ? 'selected' : ''}>${label}</option>
            `).join('')}
          </select>
          <button class="btn btn-danger btn-small" onclick="cancelOrder('${order.id}')" ${isCancelled || isCompleted ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>
            Cancel
          </button>
          <button class="btn btn-danger btn-small" onclick="trashOrder('${order.id}')" ${!isCancelled ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>
            Trash
          </button>
        </div>
      </div>

      <div class="order-card-body">
        <div class="order-items-list">${itemsHtml}</div>
        ${noteHtml}

        <div class="custom-msg-area">
          <input type="text" class="custom-msg-input" id="msg-input-${order.id}" placeholder="Send a message to customer (e.g. We're out of that item, sorry!)" value="${escapeHtml(order.customMessage)}">
          <button class="btn btn-primary btn-small" onclick="sendMessage('${order.id}')">Send Message</button>
        </div>
        ${currentMsgHtml}
        ${customerReplyHtml}

        <div class="order-total-row">
          <span>Total</span>
          <span class="total">₱${order.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
}

// ---------- Update Status ----------
async function updateStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to update status.');
      return;
    }

    // Update local state
    const order = allOrders.find(o => o.id === orderId);
    if (order) order.status = newStatus;

    loadOrders(false);
  } catch (err) {
    alert('Network error. Failed to update status.');
  }
}

// ---------- Send Custom Message ----------
async function sendMessage(orderId) {
  const input = document.getElementById(`msg-input-${orderId}`);
  const message = input.value.trim();

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/message`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({ message })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to send message.');
      return;
    }

    // Update local state and re-render
    const order = allOrders.find(o => o.id === orderId);
    if (order) order.customMessage = message;

    loadOrders(false);
  } catch (err) {
    alert('Network error. Failed to send message.');
  }
}

// ---------- Cancel Order ----------
async function cancelOrder(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  const confirmMsg = `Cancel this order?\n\n#${order.receiptCode}\n${order.name} • ${order.building} Room ${order.roomNumber}\n\nThis will notify them that it's cancelled.`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Token': adminToken }
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to cancel order.');
      return;
    }

    loadOrders(false);
  } catch (err) {
    alert('Network error. Failed to cancel order.');
  }
}

async function trashOrder(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order || order.status !== 'cancelled') return;
  if (!confirm(`Delete cancelled order #${order.receiptCode} permanently?`)) return;

  try {
    const res = await fetch(`/api/admin/orders/${orderId}/trash`, {
      method: 'DELETE',
      headers: { 'X-Admin-Token': adminToken }
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to delete cancelled order.');
      return;
    }
    loadOrders(false);
  } catch (err) {
    alert('Network error. Failed to delete cancelled order.');
  }
}

// ---------- Helpers ----------
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const amp = '\u0026amp;';
  const lt = '\u0026lt;';
  const gt = '\u0026gt;';
  const quot = '\u0026quot;';
  const apos = '\u0026#39;';
  const map = {
    '&': amp,
    '<': lt,
    '>': gt,
    '"': quot,
    "'": apos
  };
  return String(str).replace(/[&<>"']/g, function (ch) {
    return map[ch];
  });
}
