// login.js
const API_URL = 'https://brew-co-production.up.railway.app/api';

// Buat elemen notifikasi sukses
const createSuccessMessage = (message) => {
    const successDiv = document.createElement('div');
    successDiv.id = 'successMessage';
    successDiv.className = 'success-message';
    successDiv.innerHTML = message;
    successDiv.style.cssText = `
        background-color: #4CAF50;
        color: white;
        padding: 12px;
        border-radius: 5px;
        margin-bottom: 15px;
        text-align: center;
        display: block;
    `;
    return successDiv;
};

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Sembunyikan error message sebelumnya
    const existingError = document.getElementById('errorMessage');
    if (existingError) {
        existingError.style.display = 'none';
    }
    
    // Hapus success message jika ada
    const existingSuccess = document.getElementById('successMessage');
    if (existingSuccess) {
        existingSuccess.remove();
    }
    
    // Disable button saat proses
    const loginBtn = document.querySelector('.btn-login');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Loading...';
    
    try {
        console.log('📤 Sending login request...');
        console.log('📝 Username:', username);
        
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',  // INI PENTING! Kirim cookie
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:', [...response.headers.entries()]);
        
        const data = await response.json();
        console.log('📦 Response data:', data);
        
        if (response.ok && data.success) {
            // Simpan ke localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('username', data.user.username);
            
            console.log('✅ Login successful, redirecting...');
            
            // Tampilkan pesan sukses
            const form = document.getElementById('loginForm');
            const successMsg = createSuccessMessage('✅ ' + data.message + ' Redirecting ke dashboard...');
            form.parentNode.insertBefore(successMsg, form);
            
            // Redirect ke index.html
            setTimeout(() => {
                window.location.href = 'index.html';
                window.location.replace('index.html'); // Force redirect
            }, 1500);
        } else {
            console.log('❌ Login failed:', data.message);
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.innerHTML = '❌ ' + (data.message || 'Login gagal');
            errorDiv.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login →';
        }
    } catch (error) {
        console.error('❌ Fetch error:', error);
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.innerHTML = '❌ Terjadi kesalahan: ' + error.message;
        errorDiv.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login →';
    }
});

// Cek jika sudah login, redirect ke dashboard
window.addEventListener('load', async () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        console.log('⚠️ User already logged in, redirecting to dashboard...');
        window.location.href = 'index.html';
        return;
    }
    
    // Cek session di server
    try {
        const response = await fetch(`${API_URL}/me`, {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.isLoggedIn) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('isLoggedIn', 'true');
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.log('ℹ️ Not logged in');
    }
});
