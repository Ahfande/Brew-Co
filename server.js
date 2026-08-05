const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const cors = require('cors');
const MySQLStore = require('express-mysql-session')(session);

const app = express();

// ========== CORS ==========
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:8080',
        'https://brew-co-production.up.railway.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
            port: parsed.port || 3306,
            ssl: {
                rejectUnauthorized: false
            }
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

// Buat connection pool
const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ========== SESSION STORE ==========
const sessionStore = new MySQLStore({
    pool: pool,
    tableName: 'sessions',
    createDatabaseTable: true,
    schema: {
        tableName: 'sessions',
        columnNames: {
            session_id: 'session_id',
            expires: 'expires',
            data: 'data'
        }
    }
});

// ========== SESSION ==========
app.use(session({
    name: 'coffeeShopSession',
    secret: process.env.SESSION_SECRET || 'coffeeShopSecretKey2024!',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Test koneksi database
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection error:');
        console.error('   Code:', err.code);
        console.error('   Message:', err.message);
        console.error('\n   Please check your MYSQL_URL environment variable');
        return;
    }
    console.log('✅ Database connected successfully!');
    connection.release();
});

// Escape function
const escape = (str) => {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
};

// ========== REGISTER ==========
app.post('/api/register', (req, res) => {
    const { fullname, username, password } = req.body;
    
    const checkQuery = `SELECT * FROM users WHERE username = '${escape(username)}'`;
    
    pool.query(checkQuery, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error database' });
        }
        
        if (result.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah terdaftar!' });
        }
        
        const insertQuery = `INSERT INTO users (fullname, username, password, role) 
                             VALUES ('${escape(fullname)}', '${escape(username)}', '${escape(password)}', 'user')`;
        
        pool.query(insertQuery, (err) => {
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
    
    console.log('🔐 Login attempt:', username);
    
    const query = `SELECT * FROM users WHERE username = '${escape(username)}' AND password = '${escape(password)}'`;
    
    pool.query(query, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Error database' });
        }
        
        if (result.length > 0) {
            const user = result[0];
            
            if (user.role === 'admin') {
                return res.status(401).json({ success: false, message: 'Akun admin! Silakan login melalui halaman admin.' });
            }
            
            req.session.regenerate((err) => {
                if (err) {
                    console.error('Session regenerate error:', err);
                    return res.status(500).json({ success: false, message: 'Session error' });
                }
                
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.fullname = user.fullname;
                req.session.role = user.role;
                
                req.session.save((err) => {
                    if (err) {
                        console.error('Session save error:', err);
                        return res.status(500).json({ success: false, message: 'Session save error' });
                    }
                    
                    console.log('✅ Session saved for user:', user.username);
                    console.log('   Session ID:', req.sessionID);
                    
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
    
    pool.query(query, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Error database' });
        }
        
        console.log('Query result length:', result.length);
        
        if (result.length > 0) {
            const user = result[0];
            
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
    console.log('Session ID:', req.sessionID);
    console.log('Session userId:', req.session?.userId);
    console.log('Session role:', req.session?.role);
    console.log('Full session:', req.session);
    console.log('Cookies:', req.headers.cookie);
    
    if (req.session && req.session.userId) {
        console.log('✅ User is logged in as:', req.session.username);
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
    
    pool.query(query, (err, results) => {
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
    
    pool.query(query, (err, result) => {
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
    
    pool.query(query, (err, results) => {
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
    
    pool.query(query, (err, results) => {
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
    
    pool.query(query, (err, result) => {
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
    
    pool.query(query, (err, result) => {
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
    
    pool.query(query, (err, result) => {
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
    
    pool.query(query, (err, results) => {
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
    
    pool.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.sqlMessage });
        }
        res.json({ success: true, message: 'Status order berhasil diupdate!' });
    });
});

// ========== ADMIN GET STATS ==========
app.get('/api/admin/stats', isAdmin, (req, res) => {
    const productQuery = `SELECT COUNT(*) as total FROM products WHERE is_active = 1`;
    
    pool.query(productQuery, (err, productResult) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        
        const orderQuery = `SELECT COUNT(*) as total FROM orders`;
        
        pool.query(orderQuery, (err, orderResult) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
            
            const pendingQuery = `SELECT COUNT(*) as total FROM orders WHERE status = 'pending'`;
            
            pool.query(pendingQuery, (err, pendingResult) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                
                const revenueQuery = `SELECT SUM(total_price) as total FROM orders WHERE status = 'selesai'`;
                
                pool.query(revenueQuery, (err, revenueResult) => {
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

// ========== TEST ENDPOINT ==========
app.get('/api/test-session', (req, res) => {
    res.json({
        sessionID: req.sessionID,
        session: req.session,
        cookies: req.headers.cookie,
        isProduction: process.env.NODE_ENV === 'production'
    });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: https://brew-co-production.up.railway.app`);
});
