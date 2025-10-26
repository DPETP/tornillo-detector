// =================================================================
// REEMPLAZA EL CONTENIDO COMPLETO DE backend/static/js/main.js
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    // --- LÓGICA DE REDIRECCIÓN CORREGIDA ---
    // Si ya existe un token, el usuario ya está autenticado.
    // Lo redirigimos a la página principal de la aplicación ('/dashboard').
    if (localStorage.getItem('accessToken')) {
        window.location.href = '/dashboard'; // USAR RUTA ABSOLUTA Y LIMPIA
        return; // Detener la ejecución para evitar que se añadan listeners innecesarios
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            errorMessage.classList.remove('show');
            errorMessage.textContent = '';

            try {
                // Asumimos que 'api' está disponible globalmente desde api.js
                const response = await api.login(username, password);
                
                // Guardar datos del usuario y token
                localStorage.setItem('accessToken', response.access_token);
                localStorage.setItem('user', JSON.stringify(response.user));

                // Redirigir al dashboard INMEDIATAMENTE tras un login exitoso
                window.location.href = '/dashboard'; // USAR RUTA ABSOLUTA Y LIMPIA

            } catch (error) {
                errorMessage.textContent = 'Error en inicio de sesión. Verifique sus credenciales.';
                errorMessage.classList.add('show');
                console.error('Error de login:', error);
            }
        });
    }

    // Toggle password visibility (tu código estaba bien)
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (togglePassword) {
        togglePassword.addEventListener('click', (e) => {
            e.preventDefault();
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            // Puedes mejorar los íconos si usas una librería como FontAwesome
            togglePassword.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
        });
    }
});