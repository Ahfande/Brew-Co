const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const cors = require('cors');

const app = express();

// ============================================================
// 1. CORS CONFIGURATION
// ============================================================
app.use(cors({
    origin: true,  // Izinkan semua origin (untuk debugging)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept']
}));

// ============================================================
// 2. MIDDLEWARE
// ============================================================
app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// 3. SESSION CONFIGURATION
// ============================================================
app.use(session({
    name: 'coffeeShopSession',
    secret: process.env.SESSION_SECRET || 'coffeeShopSecretKey2024!',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' ? true : false,
        maxAge: 24 * 60 * 60 * 1000, // 24 jam
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// ============================================================
// 4. DATABASE CONNECTION
// ============================================================
console.log('🔍 Connecting to database...');

let dbConfig = {};

if (process.env.MYSQL_URL) {
    try {
        const parsed = new URL(process.env.MYSQL_URL);
        dbConfig = {
            host: parsed.hostname,
            user: parsed.username,
            password: parsed.password,
            database: parsed.pathname.slice(1),
            port: parsed.port || 3306,
            ssl: { rejectUnauthorized: false }
        };
        console.log('✅ Using MYSQL_URL from Railway');
        console.log('   Host:', dbConfig.host);
        console.log('   Database:', dbConfig.database);
    } catch (error) {
        console.error('❌ Error parsing MYSQL_URL:', error.message);
        process.exit(1);
    }
} else {
    dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'coffee_shop',
        port: process.env.DB_PORT || 3306
    };
    console.log('✅ Using individual DB variables');
    console.log('   Host:', dbConfig.host);
    console.log('   Database:', dbConfig.database);
}

const db = mysql.createPool({
    ...dbConfig,
    connectionLimit: 10,
    connectTimeout: 10000,
    waitForConnections: true
});

// Test koneksi database
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection error:');
        console.error('   Code:', err.code);
        console.error('   Message:', err.message);
        console.error('\n   Please check your database configuration!');
        return;
    }
    console.log('✅ Database connected successfully!');
    connection.release();
});

// Handle database errors
db.on('error', (err) => {
    console.error('❌ Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('⚠️ Database connection lost. Reconnecting...');
    }
});

// ============================================================
// 5. HELPER FUNCTIONS
// ============================================================
// Escape function untuk keamanan (fallback)
const escape = (str) => {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'");
};

// ============================================================
// 6. AUTHENTICATION ROUTES
// ============================================================

// ---------- REGISTER ----------
app.post('/api/register', (req, res) => {
    const { fullname, username, password } = req.body;

    console.log('📝 Register attempt:', username);

    // Cek username sudah terdaftar
    const checkQuery = 'SELECT * FROM users WHERE username = ?';
    db.query(checkQuery, [username], (err, result) => {
        if (err) {
            console.error('❌ Register check error:', err);
            return res.status(500).json({
                success: false,
                message: 'Error database: ' + err.message
            });
        }

        if (result.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Username sudah terdaftar!'
            });
        }

        // Insert user baru
        const insertQuery = 'INSERT INTO users (fullname, username, password, role) VALUES (?, ?, ?, ?)';
        db.query(insertQuery, [fullname, username, password, 'user'], (err) => {
            if (err) {
                console.error('❌ Register insert error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Gagal register: ' + err.message
                });
            }

            console.log('✅ Register successful:', username);
            res.json({
                success: true,
                message: 'Registrasi berhasil! Silakan login.'
            });
        });
    });
});

// ---------- USER LOGIN ----------
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    console.log('🔐 Login attempt:', { username, password: '***' });

    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, result) => {
        if (err) {
            console.error('❌ Login query error:', err);
            return res.status(500).json({
                success: false,
                message: 'Database error: ' + err.message
            });
        }

        console.log('📊 Query result count:', result.length);

        if (result.length === 0) {
            console.log('❌ Login failed - invalid credentials');
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah!'
            });
        }

        const user = result[0];

        // Cek role admin
        if (user.role === 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Akun admin! Silakan login melalui halaman admin.'
            });
        }

        // Regenerate session untuk keamanan
        req.session.regenerate((err) => {
            if (err) {
                console.error('❌ Session regenerate error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Session error'
                });
            }

            // Set session data
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.fullname = user.fullname;
            req.session.role = user.role;

            req.session.save((err) => {
                if (err) {
                    console.error('❌ Session save error:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Session save error'
                    });
                }

                console.log('✅ Login successful for:', user.username);
                console.log('📋 Session ID:', req.session.id);

                res.json({
                    success: true,
                    message: 'Login berhasil!',
                    user: {
                        id: user.id,
                        username: user.username,
                        fullname: user.fullname,
                        role: user.role
                    }
                });
            });
        });
    });
});

// ---------- ADMIN LOGIN ----------
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    console.log('🔐 Admin login attempt:', { username, password: '***' });

    const query = 'SELECT * FROM users WHERE username = ? AND password = ? AND role = ?';
    db.query(query, [username, password, 'admin'], (err, result) => {
        if (err) {
            console.error('❌ Admin login error:', err);
            return res.status(500).json({
                success: false,
                message: 'Database error: ' + err.message
            });
        }

        if (result.length === 0) {
            console.log('❌ Admin login failed');
            return res.status(401).json({
                success: false,
                message: 'Username atau password salah, atau bukan akun admin!'
            });
        }

        const user = result[0];

        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Session error'
                });
            }

            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.fullname = user.fullname;
            req.session.role = user.role;

            req.session.save((err) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Session save error'
                    });
                }

                console.log('✅ Admin login successful:', user.username);

                res.json({
                    success: true,
                    message: 'Login admin berhasil!',
                    user: {
                        id: user.id,
                        username: user.username,
                        fullname: user.fullname,
                        role: user.role
                    }
                });
            });
        });
    });
});

// ---------- CHECK SESSION ----------
app.get('/api/me', (req, res) => {
    console.log('\n=== CHECK SESSION ===');
    console.log('Cookie received:', req.headers.cookie);
    console.log('Session ID:', req.session?.id);
    console.log('Session userId:', req.session?.userId);
    console.log('Session role:', req.session?.role);

    if (req.session && req.session.userId) {
        console.log('✅ User is logged in');
        res.json({
            isLoggedIn: true,
            user: {
                id: req.session.userId,
                username: req.session.username,
                fullname: req.session.fullname,
                role: req.session.role
            }
        });
    } else {
        console.log('❌ No user logged in');
        res.json({ isLoggedIn: false });
    }
    console.log('==================\n');
});

// ---------- LOGOUT ----------
app.post('/api/logout', (req, res) => {
    console.log('🚪 Logout attempt');

    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Logout error:', err);
            return res.status(500).json({
                success: false,
                message: 'Logout gagal'
            });
        }
        console.log('✅ Logout successful');
        res.json({
            success: true,
            message: 'Logout berhasil'
        });
    });
});

// ---------- ADMIN LOGOUT ----------
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Logout gagal'
            });
        }
        res.json({
            success: true,
            message: 'Admin logout berhasil'
        });
    });
});

// ============================================================
// 7. PRODUCT ROUTES
// ============================================================

// ---------- GET ALL PRODUCTS (PUBLIC) ----------
app.get('/api/products', (req, res) => {
    const query = 'SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Products error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
        res.json({
            success: true,
            products: results
        });
    });
});

// ============================================================
// 8. ORDER ROUTES
// ============================================================

// ---------- CREATE ORDER ----------
app.post('/api/orders', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'Harap login terlebih dahulu'
        });
    }

    const {
        product_id,
        quantity,
        notes,
        total_price,
        customer_name,
        customer_phone,
        customer_address
    } = req.body;

    const user_id = req.session.userId;

    const query = `INSERT INTO orders 
        (user_id, product_id, quantity, notes, total_price, customer_name, customer_phone, customer_address, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(query, [
        user_id,
        product_id,
        quantity,
        notes || '',
        total_price,
        customer_name || '',
        customer_phone || '',
        customer_address || '',
        'pending'
    ], (err, result) => {
        if (err) {
            console.error('❌ Create order error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        res.json({
            success: true,
            orderId: result.insertId,
            message: 'Order berhasil dibuat!'
        });
    });
});

// ---------- GET ORDERS BY USER ----------
app.get('/api/orders/user/:userId', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'Harap login terlebih dahulu'
        });
    }

    const requestedUserId = parseInt(req.params.userId);

    if (req.session.userId !== requestedUserId && req.session.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Anda tidak memiliki akses ke order ini'
        });
    }

    const query = `
        SELECT o.*, p.name as product_name, p.price as product_price, p.image_url 
        FROM orders o 
        JOIN products p ON o.product_id = p.id 
        WHERE o.user_id = ? 
        ORDER BY o.id DESC
    `;

    db.query(query, [requestedUserId], (err, results) => {
        if (err) {
            console.error('❌ Get orders error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
        res.json({
            success: true,
            orders: results
        });
    });
});

// ============================================================
// 9. ADMIN MIDDLEWARE & ROUTES
// ============================================================

// ---------- ADMIN MIDDLEWARE ----------
const isAdmin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized - Login required'
        });
    }

    if (req.session.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Forbidden - Admin access required'
        });
    }

    next();
};

// ---------- ADMIN GET ALL PRODUCTS ----------
app.get('/api/admin/products', isAdmin, (req, res) => {
    const query = 'SELECT * FROM products ORDER BY id DESC';

    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
        res.json({
            success: true,
            products: results
        });
    });
});

// ---------- ADMIN CREATE PRODUCT ----------
app.post('/api/admin/products', isAdmin, (req, res) => {
    const { name, price, description, image_url } = req.body;

    const query = 'INSERT INTO products (name, price, description, image_url, is_active) VALUES (?, ?, ?, ?, ?)';

    db.query(query, [name, price, description || '', image_url || '', 1], (err, result) => {
        if (err) {
            console.error('❌ Create product error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        res.json({
            success: true,
            productId: result.insertId,
            message: 'Produk berhasil ditambahkan!'
        });
    });
});

// ---------- ADMIN UPDATE PRODUCT ----------
app.put('/api/admin/products/:id', isAdmin, (req, res) => {
    const productId = req.params.id;
    const { name, price, description, image_url } = req.body;

    const query = 'UPDATE products SET name = ?, price = ?, description = ?, image_url = ? WHERE id = ?';

    db.query(query, [name, price, description || '', image_url || '', productId], (err, result) => {
        if (err) {
            console.error('❌ Update product error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan'
            });
        }

        res.json({
            success: true,
            message: 'Produk berhasil diupdate!'
        });
    });
});

// ---------- ADMIN DELETE PRODUCT ----------
app.delete('/api/admin/products/:id', isAdmin, (req, res) => {
    const productId = req.params.id;

    const query = 'DELETE FROM products WHERE id = ?';

    db.query(query, [productId], (err, result) => {
        if (err) {
            console.error('❌ Delete product error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan'
            });
        }

        res.json({
            success: true,
            message: 'Produk berhasil dihapus permanen!'
        });
    });
});

// ---------- ADMIN GET ALL ORDERS ----------
app.get('/api/admin/orders', isAdmin, (req, res) => {
    const query = `
        SELECT o.*, p.name as product_name, u.fullname as customer_name, u.username 
        FROM orders o 
        JOIN products p ON o.product_id = p.id 
        JOIN users u ON o.user_id = u.id 
        ORDER BY o.id DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Get admin orders error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
        res.json({
            success: true,
            orders: results
        });
    });
});

// ---------- ADMIN UPDATE ORDER STATUS ----------
app.put('/api/admin/orders/:id/status', isAdmin, (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;

    const query = 'UPDATE orders SET status = ? WHERE id = ?';

    db.query(query, [status, orderId], (err, result) => {
        if (err) {
            console.error('❌ Update order status error:', err);
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order tidak ditemukan'
            });
        }

        res.json({
            success: true,
            message: 'Status order berhasil diupdate!'
        });
    });
});

// ---------- ADMIN GET STATS ----------
app.get('/api/admin/stats', isAdmin, (req, res) => {
    const queries = {
        products: 'SELECT COUNT(*) as total FROM products WHERE is_active = 1',
        orders: 'SELECT COUNT(*) as total FROM orders',
        pending: 'SELECT COUNT(*) as total FROM orders WHERE status = "pending"',
        revenue: 'SELECT SUM(total_price) as total FROM orders WHERE status = "selesai"'
    };

    let stats = {
        totalProducts: 0,
        totalOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0
    };

    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        db.query(query, (err, result) => {
            if (err) {
                console.error(`❌ Stats error (${key}):`, err);
            } else {
                const keyMap = {
                    products: 'totalProducts',
                    orders: 'totalOrders',
                    pending: 'pendingOrders',
                    revenue: 'totalRevenue'
                };
                stats[keyMap[key]] = result[0]?.total || 0;
            }

            completed++;
            if (completed === totalQueries) {
                res.json({
                    success: true,
                    stats: stats
                });
            }
        });
    });
});

// ============================================================
// 10. ERROR HANDLER (harus di paling akhir)
// ============================================================
app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// ============================================================
// 11. START SERVER
// ============================================================
const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 CORS: Enabled (all origins)`);
    console.log('========================================');
});
