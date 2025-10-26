// =================================================================
// CÓDIGO COMPLETO Y FINAL para backend/static/js/authGuard.js
// =================================================================

// Función para cerrar sesión
function handleLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Guardián de ruta: se auto-ejecuta inmediatamente
(function() {
    const token = localStorage.getItem('accessToken');
    // Si no hay token Y NO estamos en la página de login...
    if (!token && window.location.pathname !== '/') {
        window.location.href = '/'; // ...redirigir al login.
    }

    // Añadir el listener para el botón de logout cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', () => {
        const logoutButton = document.getElementById('logoutBtn');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }
    });
})();