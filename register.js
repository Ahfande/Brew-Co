// register.js
const API_URL = 'brew-co-production-f788.up.railway.app';

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Ambil nilai dari form
    const fullname = document.getElementById('fullname').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validasi password match
    if (password !== confirmPassword) {
        document.getElementById('passwordError').style.display = 'block';
        return;
    } else {
        document.getElementById('passwordError').style.display = 'none';
    }
    
    // Validasi minimal password 6 karakter
    if (password.length < 6) {
        alert('Password minimal 6 karakter!');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                fullname: fullname,
                username: username,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Tampilkan pesan sukses
            const successDiv = document.getElementById('successMessage');
            successDiv.innerHTML = data.message;
            successDiv.style.display = 'block';
            
            // Reset form
            document.getElementById('registerForm').reset();
            
            // Redirect ke login setelah 2 detik
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            alert('Registrasi gagal: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan, pastikan server backend berjalan!');
    }
});
