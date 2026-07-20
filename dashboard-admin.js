// dashboard-admin.js
const API_URL = 'https://brew-co-production.up.railway.app/api';
let currentAdmin = null;
let products = [];
let orders = [];
let selectedImageBase64 = null;
let currentOrderId = null;

// ========== HELPER FUNCTIONS ==========
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.background = isError ? '#DC2626' : '#4CAF50';
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function getStatusText(status) {
    switch(status) {
        case 'pending': return '⏳ Pending';
        case 'proses': return '🔄 Diproses';
        case 'selesai': return '✅ Selesai';
        default: return status;
    }
}

// ========== CHECK ADMIN LOGIN ==========
async function checkAdminLogin() {
    console.log('=== CHECKING ADMIN LOGIN ===');
    
    try {
        const response = await fetch(`${API_URL}/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Session data:', data);
        
        if (data.isLoggedIn && data.user) {
            console.log('User role:', data.user.role);
            
            if (data.user.role === 'admin') {
                currentAdmin = data.user;
                console.log('✅ Admin verified:', currentAdmin.username);
                
                // Tampilkan nama admin
                const adminNameElement = document.querySelector('.user-info span');
                if (adminNameElement) {
                    adminNameElement.textContent = currentAdmin.fullname || currentAdmin.username;
                }
                
                return true;
            } else {
                console.log('❌ User is not admin, role:', data.user.role);
                showNotification('Akses ditolak! Halaman khusus admin.', true);
                setTimeout(() => {
                    window.location.href = 'login-admin.html';
                }, 2000);
                return false;
            }
        } else {
            console.log('❌ No session found');
            window.location.href = 'login-admin.html';
            return false;
        }
    } catch (error) {
        console.error('❌ Error checking admin:', error);
        window.location.href = 'login-admin.html';
        return false;
    }
}

// Test function - panggil dari console browser
window.testSession = async () => {
    const response = await fetch(`${API_URL}/me`, {
        credentials: 'include'
    });
    const data = await response.json();
    console.log('Session test:', data);
    return data;
};

// Initialize
async function init() {
    console.log('Initializing admin dashboard...');
    const isAdmin = await checkAdminLogin();
    console.log('Is admin logged in?', isAdmin);
    
    if (isAdmin) {
        await loadStats();
        await loadProducts();
        await loadOrders();
    }
}

// Start
init();

// ========== LOAD STATS ==========
async function loadStats() {
    try {
        console.log('Loading stats...');
        console.log('Checking statsContainer element:', document.getElementById('statsContainer'));
        
        const statsContainer = document.getElementById('statsContainer');
        if (!statsContainer) {
            console.error('statsContainer element NOT FOUND! Pastikan id="statsContainer" ada di HTML');
            return;
        }
        
        const response = await fetch(`${API_URL}/admin/stats`, {
            credentials: 'include'
        });
        
        console.log('Stats response status:', response.status);
        
        if (response.status === 401 || response.status === 403) {
            console.log('Unauthorized, redirecting to login...');
            window.location.href = 'login-admin.html';
            return;
        }
        
        const data = await response.json();
        console.log('Stats data:', data);
        
        // Tampilkan box statistik (KOSONG atau isi)
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-box"></i></div>
                <div class="stat-number">${data.success ? (data.stats.totalProducts || 0) : '0'}</div>
                <div class="stat-label">Total Produk</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-shopping-cart"></i></div>
                <div class="stat-number">${data.success ? (data.stats.totalOrders || 0) : '0'}</div>
                <div class="stat-label">Total Order</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-clock"></i></div>
                <div class="stat-number">${data.success ? (data.stats.pendingOrders || 0) : '0'}</div>
                <div class="stat-label">Order Pending</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-money-bill"></i></div>
                <div class="stat-number">Rp ${data.success ? (data.stats.totalRevenue || 0).toLocaleString() : '0'}</div>
                <div class="stat-label">Total Pendapatan</div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading stats:', error);
        
        // Tampilkan box statistik dengan angka 0 jika error
        const statsContainer = document.getElementById('statsContainer');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-box"></i></div>
                    <div class="stat-number">0</div>
                    <div class="stat-label">Total Produk</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-shopping-cart"></i></div>
                    <div class="stat-number">0</div>
                    <div class="stat-label">Total Order</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-number">0</div>
                    <div class="stat-label">Order Pending</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-money-bill"></i></div>
                    <div class="stat-number">Rp 0</div>
                    <div class="stat-label">Total Pendapatan</div>
                </div>
            `;
        }
        
        showNotification('Gagal memuat statistik', true);
    }
}

// ========== LOAD PRODUCTS ==========
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/admin/products`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            products = data.products;
            renderProductsTable();
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Gagal memuat produk', true);
    }
}

// ========== LOAD ORDERS ==========
async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/admin/orders`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success) {
            orders = data.orders;
            renderOrdersTable();
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Gagal memuat order', true);
    }
}

// ========== RENDER PRODUCTS TABLE ==========
function renderProductsTable() {
    const searchTerm = document.getElementById('searchProduct')?.value.toLowerCase() || '';
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchTerm));
    
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = filtered.map(product => `
        <tr>
            <td>${product.id}</td>
            <td><img src="${product.image_url || 'https://placehold.co/150x150?text=Coffee'}" alt="${product.name}" class="product-image" onerror="this.src='https://placehold.co/150x150?text=No+Image'"></td>
            <td>${product.name}</td>
            <td>Rp ${parseInt(product.price).toLocaleString()}</td>
            <td>${product.description ? product.description.substring(0, 50) : '-'}${product.description && product.description.length > 50 ? '...' : ''}</td>
            <td class="action-buttons">
                <button class="btn-edit" onclick="editProduct(${product.id})"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-delete" onclick="deleteProduct(${product.id})"><i class="fas fa-trash"></i> Hapus</button>
            </td>
        </tr>
    `).join('');
}

// ========== RENDER ORDERS TABLE ==========
function renderOrdersTable() {
    const searchTerm = document.getElementById('searchOrder')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';
    
    let filtered = [...orders];
    if (searchTerm) {
        filtered = filtered.filter(o => 
            o.id.toString().includes(searchTerm) || 
            o.customer_name?.toLowerCase().includes(searchTerm) ||
            o.product_name?.toLowerCase().includes(searchTerm)
        );
    }
    if (statusFilter !== 'all') {
        filtered = filtered.filter(o => o.status === statusFilter);
    }
    
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = filtered.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${order.customer_name || order.username}</td>
            <td>${order.product_name}</td>
            <td>${order.quantity}</td>
            <td>Rp ${parseInt(order.total_price).toLocaleString()}</td>
            <td><span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></td>
            <td>${new Date(order.created_at).toLocaleString('id-ID')}</td>
            <td class="action-buttons">
                <button class="btn-edit" onclick="openStatusModal(${order.id})"><i class="fas fa-sync-alt"></i> Update</button>
            </td>
        </tr>
    `).join('');
}

// ========== CRUD PRODUCTS ==========
function showAddProductModal() {
    document.getElementById('modalTitle').textContent = 'Tambah Produk';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('currentImageInfo').style.display = 'none';
    selectedImageBase64 = null;
    document.getElementById('productModal').classList.add('active');
}

async function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (product) {
        document.getElementById('modalTitle').textContent = 'Edit Produk';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productDesc').value = product.description || '';
        
        const currentImageInfo = document.getElementById('currentImageInfo');
        currentImageInfo.style.display = 'block';
        currentImageInfo.innerHTML = `<strong>Gambar saat ini:</strong><br><img src="${product.image_url}" style="max-width:100px; border-radius:8px; margin-top:5px;" onerror="this.src='https://placehold.co/150x150?text=No+Image'">`;
        
        document.getElementById('imagePreview').innerHTML = '';
        selectedImageBase64 = null;
        document.getElementById('productModal').classList.add('active');
    }
}

async function deleteProduct(id) {
    if (confirm('Yakin ingin menghapus produk ini?')) {
        try {
            const response = await fetch(`${API_URL}/admin/products/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await response.json();
            
            if (data.success) {
                showNotification('Produk berhasil dihapus!');
                loadProducts();
                loadStats();
            } else {
                showNotification('Gagal menghapus produk', true);
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Terjadi kesalahan', true);
        }
    }
}

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Buat canvas untuk kompres
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Maksimal ukuran 800px
            const maxSize = 800;
            if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            }
            if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Kompres ke JPEG dengan kualitas 70%
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(compressedDataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function previewImage(input) {
    const preview = document.getElementById('imagePreview');
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Validasi tipe file
        if (!file.type.startsWith('image/')) {
            showNotification('File harus berupa gambar!', true);
            input.value = '';
            return;
        }
        
        // Validasi ukuran file (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showNotification('Ukuran gambar maksimal 2MB!', true);
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImageBase64 = e.target.result;
            console.log('Image loaded, length:', selectedImageBase64.length);
            preview.innerHTML = `<img src="${selectedImageBase64}" alt="Preview" style="max-width:150px; max-height:150px; border-radius:12px;">`;
        };
        reader.onerror = function(e) {
            console.error('FileReader error:', e);
            showNotification('Gagal membaca file gambar', true);
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
        selectedImageBase64 = null;
    }
}

async function saveProduct(event) {
    event.preventDefault();
    
    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value;
    const price = parseInt(document.getElementById('productPrice').value);
    const description = document.getElementById('productDesc').value;
    
    let imageUrl = selectedImageBase64;
    
    if (!imageUrl && id) {
        const existingProduct = products.find(p => p.id == id);
        imageUrl = existingProduct ? existingProduct.image_url : 'https://placehold.co/150x150?text=Coffee';
    } 
    else if (!imageUrl) {
        imageUrl = 'https://placehold.co/150x150?text=Coffee';
    }
    
    // Validasi input
    if (!name || !price) {
        showNotification('Nama dan harga produk wajib diisi!', true);
        return;
    }
    
    try {
        let response;
        if (id) {
            // Edit
            response = await fetch(`${API_URL}/admin/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, price, description, image_url: imageUrl })
            });
        } else {
            // Tambah
            response = await fetch(`${API_URL}/admin/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, price, description, image_url: imageUrl })
            });
        }
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(id ? 'Produk berhasil diupdate!' : 'Produk berhasil ditambahkan!');
            closeModal();
            await loadProducts();
            await loadStats();
            
            // Reset form
            document.getElementById('productForm').reset();
            document.getElementById('imagePreview').innerHTML = '';
            selectedImageBase64 = null;
        } else {
            showNotification(data.message || 'Gagal menyimpan produk', true);
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Terjadi kesalahan: ' + error.message, true);
    }
}

// ========== ORDER MANAGEMENT ==========
function openStatusModal(orderId) {
    currentOrderId = orderId;
    const order = orders.find(o => o.id === orderId);
    if (order) {
        document.getElementById('orderStatus').value = order.status;
        document.getElementById('statusModal').classList.add('active');
    }
}

async function updateOrderStatus() {
    const newStatus = document.getElementById('orderStatus').value;
    
    try {
        const response = await fetch(`${API_URL}/admin/orders/${currentOrderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Status order #${currentOrderId} diupdate menjadi ${getStatusText(newStatus)}`);
            closeStatusModal();
            loadOrders();
            loadStats();
        } else {
            showNotification('Gagal update status', true);
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Terjadi kesalahan', true);
    }
}

// ========== FILTER FUNCTIONS ==========
function filterOrders() {
    renderOrdersTable();
}

// ========== MODAL FUNCTIONS ==========
function closeModal() {
    document.getElementById('productModal').classList.remove('active');
    selectedImageBase64 = null;
}

function closeStatusModal() {
    document.getElementById('statusModal').classList.remove('active');
}

// ========== LOGOUT ==========
async function logout() {
    if (confirm('Yakin ingin logout dari Admin Panel?')) {
        try {
            // Gunakan endpoint logout admin, BUKAN user logout
            const response = await fetch(`${API_URL}/admin/logout`, { 
                method: 'POST', 
                credentials: 'include' 
            });
            
            if (response.ok) {
                console.log('Admin logout successful');
            }
            
            localStorage.removeItem('admin');
            localStorage.removeItem('isAdminLoggedIn');
            window.location.href = 'login-admin.html';
        } catch (error) {
            console.error('Error:', error);
            window.location.href = 'login-admin.html';
        }
    }
}

// ========== NAVIGATION ==========
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', async (e) => {
        const section = link.getAttribute('data-section');
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.getElementById(section).classList.add('active');
        
        if (section === 'dashboard') {
            await loadStats();
        } else if (section === 'produk') {
            await loadProducts();
        } else if (section === 'order') {
            await loadOrders();
        }
    });
});

// ========== EVENT LISTENERS ==========
if (document.getElementById('searchProduct')) {
    document.getElementById('searchProduct').addEventListener('keyup', renderProductsTable);
}
if (document.getElementById('searchOrder')) {
    document.getElementById('searchOrder').addEventListener('keyup', filterOrders);
}
if (document.getElementById('productForm')) {
    document.getElementById('productForm').addEventListener('submit', saveProduct);
}

// ========== INITIALIZE ==========
async function init() {
    console.log('Initializing admin dashboard...');
    
    // Cek apakah user login sebagai admin
    const isLoggedIn = await checkAdminLogin();
    console.log('Is logged in as admin:', isLoggedIn);
    
    if (isLoggedIn) {
        // Tampilkan nama admin
        const userNameSpan = document.querySelector('.user-info span');
        if (userNameSpan && currentAdmin) {
            userNameSpan.textContent = currentAdmin.fullname || 'Admin';
        }
        
        // Load semua data
        await loadStats();
        await loadProducts();
        await loadOrders();
    }
}

init();
