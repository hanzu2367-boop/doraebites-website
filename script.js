// ---------- Global State ----------
let menuItems = [];
let selectedItems = {};
let trackedReceiptCode = '';
let trackingStream = null;
let lastTrackedStatus = null;

const fallbackMenuItems = [
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

let currentCategoryFilter = null;

function renderMenu() {
  const grid = document.getElementById('menu-grid');

  // Group items by category
  const groups = {};
  menuItems.filter(item => !isAddOn(item)).forEach(item => {
    const cat = item.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  // Render each category with a heading. Clicking the category or an item shows that category in the selector.
  grid.innerHTML = Object.keys(groups).map(cat => `
    <div class="menu-category">
      <h3 class="menu-category-title">${cat}</h3>
      <div class="menu-category-grid">
        ${groups[cat].map(item => `
          <div class="menu-card" onclick="showCategory('${cat}','${item.id}')">
            <div class="menu-card-emoji">${item.image ? `<img src="${item.image}" alt="${item.name}">` : (item.emoji || '🍽️')}</div>
            <div class="menu-card-body">
              <h3>${item.name}</h3>
              <div class="menu-price">₱${item.price}.00</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function showCategory(cat, itemId) {
  // Set filter and render selector with only items from this category
  currentCategoryFilter = cat;
  renderItemSelector();
  // Scroll to selector for convenience
  const el = document.getElementById('item-selector');
  if (el) el.scrollIntoView({ behavior: 'smooth' });

  // If itemId provided and it's a main item (like cake), optionally open its qty controls
  if (itemId) {
    setTimeout(() => {
      const card = document.getElementById(`item-${itemId}`);
      if (card) card.click();
    }, 300);
  }
}

// ---------- Load Menu ----------
async function loadMenu() {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('Menu API unavailable');
    menuItems = await res.json();
  } catch (err) {
    menuItems = fallbackMenuItems;
  }

  renderMenu();
  renderItemSelector();
}


function renderItemSelector(filterCategory) {
  const container = document.getElementById('item-selector');
  const items = (typeof filterCategory === 'string')
    ? menuItems.filter(i => (i.category || 'Other') === filterCategory && !isAddOn(i))
    : menuItems.filter(i => !isAddOn(i));

  container.innerHTML = items.map(item => `
    <div class="item-card${selectedItems[item.id] ? ' selected' : ''}" id="item-${item.id}" onclick="toggleItem('${item.id}')">
      <div class="item-card-top">
        <span class="item-card-emoji">${item.image ? `<img class="item-thumb" src="${item.image}" alt="${item.name}">` : (item.emoji || '')}</span>
        <span class="item-card-price">₱${item.price}.00</span>
      </div>
      <strong>${item.name}</strong>
      <div class="quantity-controls" style="display:${selectedItems[item.id] ? 'flex' : 'none'}" id="qty-${item.id}" onclick="event.stopPropagation()">
        <button type="button" class="qty-btn" onclick="changeQty('${item.id}', -1)">−</button>
        <span class="qty-value" id="qty-val-${item.id}">1</span>
        <button type="button" class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
      </div>
      ${selectedItems[item.id] && !isAddOn(item) ? renderInlineAddons(item) : ''}
    </div>
  `).join('');

}

// ---------- Item Selection ----------

function isAddOn(item) {
  return item.id.startsWith('topping_') || item.id === 'yakult';
}

function renderInlineAddons(item) {
  const addons = item.category === 'Drinks'
    ? menuItems.filter(addon => addon.id === 'yakult')
    : menuItems.filter(addon => addon.id.startsWith('topping_'));
  return `<div class="inline-addons" onclick="event.stopPropagation()"><strong>${item.category === 'Drinks' ? 'Lemonade Add-ons' : 'Japanese Cake Add-ons'}</strong>${addons.map(addon => `
    <label>
      <input type="checkbox" onchange="toggleAddOn('${addon.id}')" ${selectedItems[addon.id] ? 'checked' : ''}>
      <span>${addon.name} (₱${addon.price})</span>
    </label>
  `).join('')}</div>`;
}

function toggleAddOn(addonId) {
  if (selectedItems[addonId]) delete selectedItems[addonId];
  else selectedItems[addonId] = 1;
  updateTotal();
  renderItemSelector();
}

function toggleItem(itemId) {
  const card = document.getElementById(`item-${itemId}`);
  const qtyControls = document.getElementById(`qty-${itemId}`);
  if (selectedItems[itemId]) {
    delete selectedItems[itemId];
    if (card) card.classList.remove('selected');
    if (qtyControls) qtyControls.style.display = 'none';
  } else {
    selectedItems[itemId] = 1;
    if (card) card.classList.add('selected');
    if (qtyControls) qtyControls.style.display = 'flex';
    const qtyEl = document.getElementById(`qty-val-${itemId}`);
    if (qtyEl) qtyEl.textContent = 1;
  }
  updateTotal();

  renderItemSelector();
}

function changeQty(itemId, delta) {
  const current = selectedItems[itemId] || 1;
  const newQty = current + delta;
  if (newQty < 1) {
    // Remove item if quantity goes below 1
    toggleItem(itemId);
    return;
  }
  selectedItems[itemId] = newQty;
  document.getElementById(`qty-val-${itemId}`).textContent = newQty;
  updateTotal();
}

function updateTotal() {
  let total = 0;
  for (const [id, qty] of Object.entries(selectedItems)) {
    const item = menuItems.find(m => m.id === id);
    if (item) total += item.price * qty;
  }
  const totalEl = document.getElementById('order-total');
  if (totalEl) totalEl.textContent = `₱${total.toFixed(2)}`;
}

// ---------- Place Order ----------
document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const building = document.getElementById('building').value.trim();
  const roomNumber = document.getElementById('room-number').value.trim();
  const note = document.getElementById('note').value.trim();

  const items = Object.entries(selectedItems).map(([id, quantity]) => ({ id, quantity }));
  const total = items.reduce((sum, item) => {
    const menuItem = menuItems.find(m => m.id === item.id);
    return sum + (menuItem ? menuItem.price * item.quantity : 0);
  }, 0);

  // Show summary confirmation
  const itemSummary = items.map(item => {
    const menuItem = menuItems.find(m => m.id === item.id);
    return `${item.quantity}x ${menuItem.name}`;
  }).join(', ');

  if (!items.length) {
    alert('Please select at least one item from the menu.');
    return;
  }

  const confirmMsg = `Confirm your order?\n\nName: ${name}\nBuilding: ${building}\nRoom: ${roomNumber}\nItems: ${itemSummary}\nTotal: ₱${total.toFixed(2)}${note ? `\nNote: ${note}` : ''}`;

  if (!confirm(confirmMsg)) return;

  if (window.location.hostname.endsWith('github.io')) {
    alert('Ordering is unavailable on GitHub Pages because it cannot run the order server. Run the Doraebites Node server and open http://localhost:3000 to place orders.');
    return;
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, building, roomNumber, items, note })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Something went wrong. Please try again.');
      return;
    }

    // Show success modal with receipt code
    document.getElementById('new-receipt-code').textContent = data.order.receiptCode;
    document.getElementById('success-modal').classList.add('show');

    // Reset form
    e.target.reset();
    selectedItems = {};
    updateTotal();
    document.querySelectorAll('.item-card').forEach(card => {
      card.classList.remove('selected');
      card.querySelector('.quantity-controls').style.display = 'none';
    });
  } catch (err) {
    alert('Network error. Please try again.');
  }
});

function closeModal() {
  document.getElementById('success-modal').classList.remove('show');
}

// Close modal on click outside
document.getElementById('success-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ---------- Track Order ----------
async function trackOrder(silent = false) {
  const code = document.getElementById('track-code').value.trim();
  const resultDiv = document.getElementById('track-result');

  if (!code) {
    resultDiv.innerHTML = `<div class="track-card error">Please enter your receipt code.</div>`;
    return;
  }

  if (!silent) resultDiv.innerHTML = `<div class="track-card error">Searching...</div>`;

  try {
    const res = await fetch(`/api/orders/track/${encodeURIComponent(code)}`);
    const data = await res.json();

    if (!res.ok) {
      resultDiv.innerHTML = `<div class="track-card error">❌ ${data.error || 'Order not found.'}</div>`;
      return;
    }

    if (trackingStream && trackedReceiptCode !== data.order.receiptCode) {
      trackingStream.close();
      trackingStream = null;
    }
    renderTrackResult(data.order, resultDiv);
    trackedReceiptCode = data.order.receiptCode;
    connectTrackingStream();
  } catch (err) {
    resultDiv.innerHTML = `<div class="track-card error">Network error. Please try again.</div>`;
  }
}

function connectTrackingStream() {
  if (trackingStream || !trackedReceiptCode) return;
  trackingStream = new EventSource(`/api/orders/stream/${encodeURIComponent(trackedReceiptCode)}`);
  trackingStream.onmessage = () => trackOrder(true);
  trackingStream.onerror = () => {
    trackingStream.close();
    trackingStream = null;
    setTimeout(connectTrackingStream, 3000);
  };
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

function renderTrackResult(order, container) {
  // Build items list
  const itemsHtml = order.items.map(item => `
    <div class="track-item">
      <span><span class="track-item-qty">${item.quantity}×</span> ${escapeHtml(item.name)}</span>
      <span>₱${(item.price * item.quantity).toFixed(2)}</span>
    </div>
  `).join('');

  const statusLabels = {
    schedule: 'Scheduled',
    preparing: 'Preparing',
    serving: 'Serving Your Order',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  const statusText = statusLabels[order.status] || order.status;

  // Timeline (hide for cancelled/completed)
  let timelineHtml = '';
  if (order.status !== 'cancelled') {
    const steps = ['schedule', 'preparing', 'serving'];
    const currentStepIndex = steps.indexOf(order.status);
    const doneClass = order.status === 'completed'
      ? 'done'
      : '';

    timelineHtml = `<div class="track-timeline">${steps.map((step, i) => {
      const isDone = i < currentStepIndex;
      const isActive = i === currentStepIndex;
      const cls = isDone ? 'done' : (isActive ? 'active' : '');
      return `<div class="timeline-step ${cls}">
        <div class="timeline-dot">${isDone ? '✓' : (isActive ? '●' : '')}</div>
        <div class="timeline-label">${statusLabels[step]}</div>
      </div>`;
    }).join('')}</div>`;
  }

  // Custom message from admin
  const msgHtml = order.customMessage
    ? `<div class="track-msg">📢 <strong>Message from Doraebites:</strong> ${escapeHtml(order.customMessage)}</div>`
    : '';

  const replyHtml = order.customMessage
    ? `<div class="customer-reply-box">
        <textarea id="customer-reply" placeholder="Reply to Doraebites..."></textarea>
        <button class="btn btn-primary btn-small" onclick="sendCustomerReply('${order.receiptCode}')">Send Reply</button>
      </div>`
    : '';

  const cancelledBadge = order.status === 'cancelled'
    ? '<div class="track-msg" style="background:#f8d7da;border-color:#e74c3c;color:#721c24">❌ This order has been cancelled.</div>'
    : '';

  const statusChanged = lastTrackedStatus !== null && lastTrackedStatus !== order.status;
  lastTrackedStatus = order.status;
  container.innerHTML = `
    <div class="track-card${statusChanged ? ' status-changed' : ''}"${order.status === 'cancelled' ? ' style="border-top-color:#e74c3c"' : ''}>
      <div class="track-card-header">
        <div class="track-receipt">Receipt Code: <span>${order.receiptCode}</span></div>
        <span class="status-badge ${order.status}${statusChanged ? ' status-pulse' : ''}">${statusText}</span>
      </div>

      <div class="track-order-info">
        <div>
          <div class="track-info-label">Ordered By</div>
          <div class="track-info-value">${escapeHtml(order.name)}</div>
        </div>
        <div>
          <div class="track-info-label">Building</div>
          <div class="track-info-value">${escapeHtml(order.building)}</div>
        </div>
        <div>
          <div class="track-info-label">Room</div>
          <div class="track-info-value">${escapeHtml(order.roomNumber)}</div>
        </div>
        <div>
          <div class="track-info-label">Ordered At</div>
          <div class="track-info-value">${formatDate(order.createdAt)}</div>
        </div>
      </div>

      <div class="track-items">${itemsHtml}</div>
      ${msgHtml}
      ${replyHtml}
      ${cancelledBadge}
      ${timelineHtml}

      <div class="track-total">
        <span>Total</span>
        <span>₱${order.total.toFixed(2)}</span>
      </div>
    </div>
  `;
}

async function sendCustomerReply(receiptCode) {
  const input = document.getElementById('customer-reply');
  const message = input.value.trim();
  if (!message) return;

  const res = await fetch(`/api/orders/${receiptCode}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error || 'Failed to send reply.');
    return;
  }
  input.value = '';
  alert('Reply sent.');
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Allow Enter key on track input
document.getElementById('track-code').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    trackOrder();
  }
});

// ---------- Init ----------
loadMenu();