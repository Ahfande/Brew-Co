// login-admin.js
const API_URL = 'https://brew-co-production-56dd.up.railway.app/api';

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
    
    // Disable button sementara
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Loading...';
    submitBtn.disabled = true;
    
    try {
        console.log('Attempting admin login for:', username);
        
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',  // Penting untuk session cookie
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok && data.success) {
            // Simpan ke localStorage
            localStorage.setItem('admin', JSON.stringify(data.user));
            localStorage.setItem('isAdminLoggedIn', 'true');
            
            // Tampilkan pesan sukses
            const form = document.getElementById('loginForm');
            const successMsg = createSuccessMessage('✅ ' + data.message + ' Redirecting ke dashboard...');
            form.parentNode.insertBefore(successMsg, form);
            
            // Redirect ke dashboard admin setelah 1.5 detik
            setTimeout(() => {
                window.location.href = 'dashboard-admin.html';
            }, 1500);
        } else {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.innerHTML = '❌ ' + (data.message || 'Login gagal!');
            errorDiv.style.display = 'block';
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error:', error);
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.innerHTML = '❌ Terjadi kesalahan: ' + error.message + '. Pastikan server backend berjalan di port 3000!';
        errorDiv.style.display = 'block';
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Cek apakah sudah login sebelumnya
// window.addEventListener('DOMContentLoaded', () => {
//     const isLoggedIn = localStorage.getItem('isAdminLoggedIn');
//     const adminData = localStorage.getItem('admin');
    
//     if (isLoggedIn === 'true' && adminData) {
//         // Cek session ke server
//         fetch(`${API_URL}/me`, {
//             credentials: 'include'
//         })
//         .then(res => res.json())
//         .then(data => {
//             if (data.isLoggedIn && data.user.role === 'admin') {
//                 window.location.href = 'dashboard-admin.html';
//             } else {
//                 // Session expired, clear local storage
//                 localStorage.removeItem('isAdminLoggedIn');
//                 localStorage.removeItem('admin');
//             }
//         })
//         .catch(err => console.error('Session check error:', err));
//     }
// });
