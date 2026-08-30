const API_URL = 'https://brew-co-production-56dd.up.railway.app/api';
let currentUser = null;
let products = [];

// Show notification
function showNotification(message, isError = false) {
  const notification = document.getElementById("notification");
  notification.textContent = message;
  notification.style.background = isError ? "#DC2626" : "#4CAF50";
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

// Check login status
async function checkLogin() {
  try {
    const response = await fetch(`${API_URL}/me`, {
      credentials: "include",
    });
    const data = await response.json();

    if (data.isLoggedIn) {
      currentUser = data.user;
      document.getElementById("usernameDisplay").textContent =
        currentUser.fullname;
      document.getElementById("welcomeMessage").innerHTML =
        `Selamat Datang, ${currentUser.fullname}! ☕`;
      document.getElementById("customerName").value = currentUser.fullname;
      return true;
    } else {
      window.location.href = "login.html";
      return false;
    }
  } catch (error) {
    console.error("Error:", error);
    window.location.href = "login.html";
    return false;
  }
}

// Load products from database
async function loadProducts() {
  try {
    const response = await fetch(`${API_URL}/products`);
    const data = await response.json();

    if (data.success) {
      products = data.products;
      renderCoffeeGrid();
      populateProductSelect();
    }
  } catch (error) {
    console.error("Error loading products:", error);
    showNotification("Gagal memuat produk", true);
  }
}

// Render coffee grid
function renderCoffeeGrid() {
  const grid = document.getElementById("coffeeGrid");
  if (products.length === 0) {
    grid.innerHTML =
      '<div class="empty-orders">Belum ada produk tersedia</div>';
    return;
  }

  grid.innerHTML = products
    .map(
      (product) => `
                <div class="coffee-card" onclick="selectProductToOrder(${product.id})">
                    <div class="coffee-icon">
                        <img src="${product.image_url || "https://via.placeholder.com/200x200?text=Coffee"}" alt="${product.name}">
                    </div>
                    <h3>${product.name}</h3>
                    <p>${product.description || "Nikmati kesegaran kopi pilihan"}</p>
                    <div class="price">Rp ${parseInt(product.price).toLocaleString()}</div>
                    <button class="order-btn" onclick="event.stopPropagation(); selectProductToOrder(${product.id})">
                        Pesan Sekarang →
                    </button>
                </div>
            `,
    )
    .join("");
}

// Populate product dropdown
function populateProductSelect() {
  const select = document.getElementById("selectedProduct");
  select.innerHTML =
    '<option value="">Pilih kopi favorit Anda</option>' +
    products
      .map(
        (product) =>
          `<option value="${product.id}" data-price="${product.price}">${product.name} - Rp ${parseInt(product.price).toLocaleString()}</option>`,
      )
      .join("");
}

// Select product and go to order page
window.selectProductToOrder = function (productId) {
  const product = products.find((p) => p.id === productId);
  if (product) {
    // Switch to order section
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("data-section") === "order") {
        link.classList.add("active");
      }
    });
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });
    document.getElementById("order").classList.add("active");

    // Hide welcome section
    document.getElementById("welcomeSection").classList.add("hide");

    // Set selected product
    document.getElementById("selectedProduct").value = product.id;
    calculateTotal();
    showNotification(`${product.name} dipilih! Silakan lanjutkan pesanan.`);
  }
};

// Calculate total price
function calculateTotal() {
  const select = document.getElementById("selectedProduct");
  const selectedOption = select.options[select.selectedIndex];
  const price = selectedOption ? parseInt(selectedOption.dataset.price) : 0;
  const quantity = parseInt(document.getElementById("quantity").value) || 0;
  const total = price * quantity;
  document.getElementById("totalPrice").value =
    total > 0 ? `Rp ${total.toLocaleString()}` : "Rp 0";
  return total;
}

// Save order to database
async function saveOrder(event) {
  event.preventDefault();

  const productId = parseInt(document.getElementById("selectedProduct").value);
  const quantity = parseInt(document.getElementById("quantity").value);
  const notes = document.getElementById("notes").value;
  const totalPrice = calculateTotal();
  const customerName = document.getElementById("customerName").value;
  const customerPhone = document.getElementById("customerPhone").value;
  const customerAddress = document.getElementById("customerAddress").value;

  if (!productId) {
    showNotification("Silakan pilih kopi terlebih dahulu!", true);
    return;
  }

  if (!customerName || !customerPhone || !customerAddress) {
    showNotification("Silakan isi data diri lengkap!", true);
    return;
  }

  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        user_id: currentUser.id,
        product_id: productId,
        quantity: quantity,
        notes: notes,
        total_price: totalPrice,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
      }),
    });

    const data = await response.json();

    if (data.success) {
      showNotification(`Pesanan berhasil dibuat! Order ID: #${data.orderId}`);

      // Reset form
      document.getElementById("orderForm").reset();
      document.getElementById("totalPrice").value = "Rp 0";
      document.getElementById("customerName").value = currentUser.fullname;

      // Ask to view orders
      setTimeout(() => {
        if (confirm("Pesanan berhasil! Lihat order sekarang?")) {
          document.querySelector('[data-section="lihatorder"]').click();
        }
      }, 500);
    } else {
      showNotification("Gagal membuat pesanan", true);
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("Terjadi kesalahan", true);
  }
}

// Load orders from database
async function loadOrders() {
  if (!currentUser) return;

  try {
    const response = await fetch(`${API_URL}/orders/user/${currentUser.id}`, {
      credentials: "include",
    });
    const data = await response.json();
    const ordersContainer = document.getElementById("ordersList");

    if (data.success && data.orders.length > 0) {
      ordersContainer.innerHTML = data.orders
        .map(
          (order) => `
                        <div class="order-item">
                            <div class="order-header">
                                <span class="order-id">#${order.id}</span>
                                <span class="order-status status-${order.status}">
                                    ${order.status === "pending" ? "⏳ Pending" : order.status === "proses" ? "🔄 Diproses" : "✅ Selesai"}
                                </span>
                            </div>
                            <div class="order-details">
                                <p><strong>☕ Kopi:</strong> ${order.product_name}</p>
                                <p><strong>📦 Jumlah:</strong> ${order.quantity} pcs</p>
                                <p><strong>📍 Alamat:</strong> ${order.customer_address}</p>
                                <p><strong>📞 No. HP:</strong> ${order.customer_phone}</p>
                                ${order.notes ? `<p><strong>📝 Catatan:</strong> ${order.notes}</p>` : ""}
                                <p><strong>📅 Tanggal:</strong> ${new Date(order.created_at).toLocaleString("id-ID")}</p>
                                <div class="order-price">💰 Total: Rp ${parseInt(order.total_price).toLocaleString()}</div>
                            </div>
                        </div>
                    `,
        )
        .join("");
    } else {
      ordersContainer.innerHTML = `
                        <div class="empty-orders">
                            <i class="fas fa-coffee" style="font-size: 50px; margin-bottom: 20px;"></i>
                            <p>Belum ada order</p>
                            <p style="margin-top: 10px;">Yuk pesan kopi dulu!</p>
                        </div>
                    `;
    }
  } catch (error) {
    console.error("Error loading orders:", error);
    showNotification("Gagal memuat order", true);
  }
}

// Navigation
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    const section = link.getAttribute("data-section");

    // Update active class
    document
      .querySelectorAll(".nav-link")
      .forEach((l) => l.classList.remove("active"));
    link.classList.add("active");

    // Show section
    document
      .querySelectorAll(".content-section")
      .forEach((s) => s.classList.remove("active"));
    document.getElementById(section).classList.add("active");

    // Hide welcome section when not on pilihkopi
    const welcomeSection = document.getElementById("welcomeSection");
    if (section === "pilihkopi") {
      welcomeSection.classList.remove("hide");
    } else {
      welcomeSection.classList.add("hide");
    }

    // Load data
    if (section === "order") {
      calculateTotal();
    } else if (section === "lihatorder") {
      await loadOrders();
    }
  });
});

// Logout function
async function logout() {
  if (confirm("Yakin ingin logout?")) {
    try {
      await fetch(`${API_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "login.html";
    } catch (error) {
      console.error("Error:", error);
      window.location.href = "login.html";
    }
  }
}

// Event listeners
document.getElementById("orderForm").addEventListener("submit", saveOrder);
document
  .getElementById("selectedProduct")
  .addEventListener("change", calculateTotal);
document.getElementById("quantity").addEventListener("input", calculateTotal);

// Initialize
(async function init() {
  const loggedIn = await checkLogin();
  if (loggedIn) {
    await loadProducts();
    calculateTotal();
  }
})();
