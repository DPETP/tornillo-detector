// =================================================================
// CÓDIGO COMPLETO Y FINAL para backend/static/js/navigation.js
// =================================================================

function navigateTo(path) {
    // Redirige a la nueva página.
    window.location.href = path;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Navigation script cargado y listo.");

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