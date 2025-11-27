// =================================================================
// CÓDIGO COMPLETO Y FINAL para backend/static/js/navigation.js
// =================================================================

function navigateTo(path) {
    // Redirige a la nueva página.
    window.location.href = path;
}

// Configuración de permisos por rol - DEFINITIVO
const PERMISSIONS = {
    'admin': ['nav-dashboard', 'nav-detection', 'nav-config', 'nav-reportes'],
    'soporte_tecnico': ['nav-dashboard', 'nav-detection', 'nav-config'],
    'operario': ['nav-detection']  // Solo detección
};

function applyRoleBasedPermissions() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || !user.role) {
            console.warn('No se encontró información del usuario o rol');
            return;
        }

        const allowedElements = PERMISSIONS[user.role] || [];
        console.log(`Aplicando permisos para rol: ${user.role}`, allowedElements);

        // Ocultar todos los elementos de navegación por defecto
        Object.values(PERMISSIONS).flat().forEach(navId => {
            const element = document.getElementById(navId);
            if (element) {
                element.style.display = 'none';
            }
        });

        // Mostrar solo los elementos permitidos para el rol actual
        allowedElements.forEach(navId => {
            const element = document.getElementById(navId);
            if (element) {
                element.style.display = '';
            }
        });

    } catch (error) {
        console.error('Error aplicando permisos basados en roles:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Navigation script cargado y listo.");

    // Aplicar permisos basados en el rol del usuario
    applyRoleBasedPermissions();

    // Mapeo de IDs de los botones a las rutas de destino
    const navLinks = {
        'nav-dashboard': '/dashboard',
        'nav-detection': '/detection',
        'nav-reportes': '/reportes', // Asumiendo que tendrás esta página
        'nav-config': '/configuracion'
    };

    // Recorremos cada enlace y le asignamos su evento
    for (const id in navLinks) {
        const linkElement = document.getElementById(id);
        if (linkElement) {
            linkElement.addEventListener('click', (event) => {
                event.preventDefault(); // MUY IMPORTANTE: Previene la recarga de la página
                const path = navLinks[id];
                console.log(`Navegando a: ${path}`);
                navigateTo(path);
            });
        }
    }
});