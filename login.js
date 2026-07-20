// login.js
const API_URL = 'http://localhost:3000/api';

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
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',  // ← INI PENTING! Kirim cookie
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Simpan ke localStorage untuk info
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('isLoggedIn', 'true');
            
            // Tampilkan pesan sukses
            const form = document.getElementById('loginForm');
            const successMsg = createSuccessMessage('✅ ' + data.message + ' Redirecting ke dashboard...');
            form.parentNode.insertBefore(successMsg, form);
            
            // Redirect ke index.html setelah 1.5 detik
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            const errorDiv = document.getElementById('errorMessage');
            errorDiv.innerHTML = '❌ ' + data.message;
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.innerHTML = '❌ Terjadi kesalahan, pastikan server backend berjalan!';
        errorDiv.style.display = 'block';
    }
});