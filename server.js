const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const cors = require('cors');

const app = express();

// ========== CORS ==========
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== SESSION (SATU UNTUK SEMUA) ==========
app.use(session({
    name: 'coffeeShopSession',  // Satu nama cookie
    secret: 'coffeeShopSecretKey2024!',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        secure: false,  // false untuk localhost
        maxAge: 24 * 60 * 60 * 1000, // 24 jam
        sameSite: 'lax'
    }
}));

// ========== DATABASE CONNECTION ==========
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
            port: parsed.port || 3306
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
}

// Buat koneksi dengan mysql2
const db = mysql.createConnection({
    ...dbConfig,
    connectTimeout: 10000,
    // Tambahkan ini untuk mengatasi masalah auth
    authPlugins: {
        mysql_clear_password: () => () => Buffer.from(dbConfig.password + '\0')
    }
});

// Koneksi ke database
db.connect((err) => {
    if (err) {
        console.error('❌ Database connection error:');
        console.error('   Code:', err.code);
        console.error('   Message:', err.message);
        console.error('\n   Please check:');
        console.error('   1. Host:', dbConfig.host);
        console.error('   2. Database:', dbConfig.database);
        console.error('   3. Username:', dbConfig.user);
        console.error('   4. Password: [HIDDEN]');
        console.error('   5. Port:', dbConfig.port);
        return;
    }
    console.log('✅ Database connected successfully!');
});

// Handle database errors
db.on('error', (err) => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('⚠️ Database connection lost.');
    }
});

db.connect((err) => {
    if (err) {
        console.error('Database error:', err);
        return;
    }
    console.log('✅ Database connected');
});

// Escape function (temporary, nanti ganti ke parameterized query)
const escape = (str) => {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
};

// ========== REGISTER ==========
app.post('/api/register', (req, res) => {
    const { fullname, username, password } = req.body;
    
    const checkQuery = `SELECT * FROM users WHERE username = '${escape(username)}'`;
    
    db.query(checkQuery, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error database' });
        }
        
        if (result.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah terdaftar!' });
        }
        
        const insertQuery = `INSERT INTO users (fullname, username, password, role) 
                             VALUES ('${escape(fullname)}', '${escape(username)}', '${escape(password)}', 'user')`;
        
        db.query(insertQuery, (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Gagal register' });
            }
            
            res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
        });
    });
});

// ========== USER LOGIN ==========
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const query = `SELECT * FROM users WHERE username = '${escape(username)}' AND password = '${escape(password)}'`;
    
    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error database' });
        }
        
        if (result.length > 0) {
            const user = result[0];
            
            if (user.role === 'admin') {
                return res.status(401).json({ success: false, message: 'Akun admin! Silakan login melalui halaman admin.' });
            }
            
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.fullname = user.fullname;
            req.session.role = user.role;
            
            req.session.save((err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Session error' });
                }
                
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
        } else {
            res.status(401).json({ success: false, message: 'Username atau password salah!' });
        }
    });
});

// ========== ADMIN LOGIN ==========
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('Admin login attempt:', username);
    
    const query = `SELECT * FROM users WHERE username = '${escape(username)}' AND password = '${escape(password)}' AND role = 'admin'`;
    
    db.query(query, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Error database' });
        }
        
        console.log('Query result length:', result.length);
        
        if (result.length > 0) {
            const user = result[0];
            
            // Regenerate session untuk menghindari session fixation
            req.session.regenerate((err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Session error' });
                }
                
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.fullname = user.fullname;
                req.session.role = user.role;
                
                req.session.save((err) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Session save error' });
                    }
                    
                    console.log('Admin session saved:', req.session);
                    
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
        } else {
            res.status(401).json({ 
                success: false, 
                message: 'Username atau password salah, atau bukan akun admin!' 
            });
        }
    });
});

// ========== CEK SESSION ==========
app.get('/api/me', (req, res) => {
    console.log('\n=== CHECK SESSION ===');
    console.log('Cookie received:', req.headers.cookie);
    console.log('Session ID:', req.session?.id);
    console.log('Session userId:', req.session?.userId);
    console.log('Session role:', req.session?.role);
    console.log('Full session:', req.session);
    
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

// ========== LOGOUT ==========
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout gagal' });
        }
        res.json({ success: true, message: 'Logout berhasil' });
    });
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout gagal' });
        }
        res.json({ success: true, message: 'Admin logout berhasil' });
    });
});

// ========== GET ALL PRODUCTS ==========
app.get('/api/products', (req, res) => {
    const query = `SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC`;
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, products: results });
    });
});

// ========== CREATE ORDER ==========
app.post('/api/orders', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Harap login terlebih dahulu' });
    }
    
    const { product_id, quantity, notes, total_price, customer_name, customer_phone, customer_address } = req.body;
    const user_id = req.session.userId;
    
    const query = `INSERT INTO orders (user_id, product_id, quantity, notes, total_price, customer_name, customer_phone, customer_address, status) 
                   VALUES (${user_id}, ${product_id}, ${quantity}, '${escape(notes)}', ${total_price}, '${escape(customer_name)}', '${escape(customer_phone)}', '${escape(customer_address)}', 'pending')`;
    
    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, orderId: result.insertId, message: 'Order berhasil dibuat!' });
    });
});

// ========== GET ORDERS BY USER ==========
app.get('/api/orders/user/:userId', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Harap login terlebih dahulu' });
    }
    
    const requestedUserId = parseInt(req.params.userId);
    if (req.session.userId !== requestedUserId && req.session.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke order ini' });
    }
    
    const query = `SELECT o.*, p.name as product_name, p.price as product_price, p.image_url 
                   FROM orders o 
                   JOIN products p ON o.product_id = p.id 
                   WHERE o.user_id = ${requestedUserId} 
                   ORDER BY o.id DESC`;
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, orders: results });
    });
});

// ========== ADMIN MIDDLEWARE ==========
const isAdmin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized - Login required' });
    }
    
    if (req.session.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Forbidden - Admin access required' });
    }
    
    next();
};

// ========== ADMIN GET ALL PRODUCTS ==========
app.get('/api/admin/products', isAdmin, (req, res) => {
    const query = `SELECT * FROM products ORDER BY id DESC`;
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, products: results });
    });
});

// ========== ADMIN CREATE PRODUCT ==========
app.post('/api/admin/products', isAdmin, (req, res) => {
    const { name, price, description, image_url } = req.body;
    
    const query = `INSERT INTO products (name, price, description, image_url, is_active) 
                   VALUES ('${escape(name)}', ${price}, '${escape(description)}', '${escape(image_url)}', 1)`;
    
    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, productId: result.insertId, message: 'Produk berhasil ditambahkan!' });
    });
});

// ========== ADMIN UPDATE PRODUCT ==========
app.put('/api/admin/products/:id', isAdmin, (req, res) => {
    const productId = req.params.id;
    const { name, price, description, image_url } = req.body;
    
    const query = `UPDATE products SET 
                   name = '${escape(name)}', 
                   price = ${price}, 
                   description = '${escape(description)}', 
                   image_url = '${escape(image_url)}' 
                   WHERE id = ${productId}`;
    
    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, message: 'Produk berhasil diupdate!' });
    });
});

// ========== ADMIN DELETE PRODUCT ==========
app.delete('/api/admin/products/:id', isAdmin, (req, res) => {
    const productId = req.params.id;
    
    const query = `DELETE FROM products WHERE id = ${productId}`;
    
    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
        }
        
        res.json({ success: true, message: 'Produk berhasil dihapus permanen!' });
    });
});

// ========== ADMIN GET ALL ORDERS ==========
app.get('/api/admin/orders', isAdmin, (req, res) => {
    const query = `SELECT o.*, p.name as product_name, u.fullname as customer_name, u.username 
                   FROM orders o 
                   JOIN products p ON o.product_id = p.id 
                   JOIN users u ON o.user_id = u.id 
                   ORDER BY o.id DESC`;
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, orders: results });
    });
});

// ========== ADMIN UPDATE ORDER STATUS ==========
app.put('/api/admin/orders/:id/status', isAdmin, (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    
    const query = `UPDATE orders SET status = '${escape(status)}' WHERE id = ${orderId}`;
    
    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, message: 'Status order berhasil diupdate!' });
    });
});

// ========== ADMIN GET STATS ==========
app.get('/api/admin/stats', isAdmin, (req, res) => {
    const productQuery = `SELECT COUNT(*) as total FROM products WHERE is_active = 1`;
    
    db.query(productQuery, (err, productResult) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        
        const orderQuery = `SELECT COUNT(*) as total FROM orders`;
        
        db.query(orderQuery, (err, orderResult) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            
            const pendingQuery = `SELECT COUNT(*) as total FROM orders WHERE status = 'pending'`;
            
            db.query(pendingQuery, (err, pendingResult) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                
                const revenueQuery = `SELECT SUM(total_price) as total FROM orders WHERE status = 'selesai'`;
                
                db.query(revenueQuery, (err, revenueResult) => {
                    if (err) {
                        return res.status(500).json({ success: false, error: err.message });
                    }
                    
                    const stats = {
                        totalProducts: productResult[0].total || 0,
                        totalOrders: orderResult[0].total || 0,
                        pendingOrders: pendingResult[0].total || 0,
                        totalRevenue: revenueResult[0].total || 0
                    };
                    
                    res.json({ success: true, stats: stats });
                });
            });
        });
    });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
