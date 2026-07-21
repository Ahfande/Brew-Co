const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const cors = require('cors');

const app = express();

// ========== CORS ==========
// Ambil URL dari environment atau gunakan default
const allowedOrigins = [
    'https://brew-co-production.up.railway.app',  // URL Railway Anda
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            console.log('❌ Blocked by CORS:', origin);
            callback(null, true); // Sementara izinkan semua untuk debugging
            // callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// OPTIONS pre-flight
app.options('*', cors());

app.use(express.static(__dirname));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== SESSION ==========
app.use(session({
    name: 'coffeeShopSession',
    secret: process.env.SESSION_SECRET || 'coffeeShopSecretKey2024!',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',  // true di production
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',  // CRUCIAL!
        domain: process.env.NODE_ENV === 'production' ? '.railway.app' : undefined
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
            port: parsed.port || 3306,
            // Tambahan untuk Railway MySQL
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

// Buat pool connection (lebih baik dari createConnection)
const db = mysql.createPool({
    ...dbConfig,
    connectionLimit: 10,
    connectTimeout: 10000,
    waitForConnections: true
});

// Test koneksi
db.getConnection((err, connection) => {
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
    connection.release();
});

// Handle database errors
db.on('error', (err) => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('⚠️ Database connection lost. Reconnecting...');
    }
});

// ========== REST API ==========

// REGISTER
app.post('/api/register', (req, res) => {
    const { fullname, username, password } = req.body;
    
    // Gunakan parameterized query
    const checkQuery = 'SELECT * FROM users WHERE username = ?';
    
    db.query(checkQuery, [username], (err, result) => {
        if (err) {
            console.error('Register check error:', err);
            return res.status(500).json({ success: false, message: 'Error database' });
        }
        
        if (result.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah terdaftar!' });
        }
        
        // INSERT dengan parameterized query
        const insertQuery = 'INSERT INTO users (fullname, username, password, role) VALUES (?, ?, ?, ?)';
        
        db.query(insertQuery, [fullname, username, password, 'user'], (err, result) => {
            if (err) {
                console.error('Register insert error:', err);
                return res.status(500).json({ success: false, message: 'Gagal register' });
            }
            
            res.json({ success: true, message: 'Registrasi berhasil! Silakan login.' });
        });
    });
});

// ========== USER LOGIN (FIXED) ==========
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Login attempt:', { username, password: '***' });
    
    // Gunakan parameterized query untuk mencegah SQL Injection
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
        
        if (result.length > 0) {
            const user = result[0];
            
            // Cek apakah admin
            if (user.role === 'admin') {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Akun admin! Silakan login melalui halaman admin.' 
                });
            }
            
            // Set session dengan regenerate
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
                    
                    console.log('✅ Login successful for:', user.username);
                    console.log('📋 Session ID:', req.session.id);
                    console.log('📋 Session data:', req.session);
                    
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
            console.log('❌ Login failed - invalid credentials');
            res.status(401).json({ 
                success: false, 
                message: 'Username atau password salah!' 
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

// ... (sisa kode sama seperti sebelumnya)

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 CORS allowed origins:`, allowedOrigins);
});
