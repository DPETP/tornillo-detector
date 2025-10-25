document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    // Verificar si ya hay sesión iniciada
    if (localStorage.getItem('accessToken')) {
        window.location.href = 'dashboard.html';
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        errorMessage.classList.remove('show');
        errorMessage.textContent = '';

        try {
            const response = await api.login(username, password);
            
            // Guardar datos del usuario
            localStorage.setItem('accessToken', response.access_token);
            localStorage.setItem('user', JSON.stringify(response.user));

            // Redirigir al dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        } catch (error) {
            errorMessage.textContent = 'Error en inicio de sesión. Verifique sus credenciales.';
            errorMessage.classList.add('show');
            console.error('Error:', error);
        }
    });
    // Toggle password visibility
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

if (togglePassword) {
    togglePassword.addEventListener('click', (e) => {
        e.preventDefault();
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    });
}
});