"""
Aplicación Flask principal para Tornillo Detector
Versión final con estructura de paquete para importaciones robustas.
"""

import os
from flask import Flask, jsonify, send_from_directory, render_template, abort, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from dotenv import load_dotenv

# --- CAMBIO CRÍTICO: IMPORTACIONES RELATIVAS ---
# Ahora que 'backend' es un paquete, usamos el punto '.' para indicar
# que importamos desde el mismo paquete.
from .config import config
from .database.models import db

# Cargar variables de entorno
load_dotenv()

# --- Inicialización de Extensiones Globales ---
jwt = JWTManager()
migrate = Migrate()


def create_app(config_name=None):
    """
    Factory function para crear y configurar la aplicación Flask.
    """
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app = Flask(
        __name__,
        # Las rutas son relativas a la carpeta 'backend' donde vive este archivo.
        template_folder='templates',
        static_folder='static'
    )
    
    app.config.from_object(config[config_name])

    # ============================================================
    # INICIALIZAR EXTENSIONES CON LA APP
    # ============================================================
    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    # Pasamos 'db' y el directorio de migraciones a Migrate
    # El path 'migrations' es relativo a la raíz del proyecto.
    migrate.init_app(app, db, directory=os.path.join(os.path.dirname(app.root_path), 'migrations'))


    # ============================================================
    # REGISTRAR BLUEPRINTS (RUTAS DE LA API)
    # ============================================================
    # --- CAMBIO CRÍTICO: IMPORTACIONES RELATIVAS ---
    from .routes.auth import auth_bp
    from .routes.detection import detection_bp
    from .routes.dashboard import dashboard_bp
    from .routes.history import history_bp
    from .routes.admin import admin_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(detection_bp, url_prefix='/api/detection')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(history_bp, url_prefix='/api/history')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    # ============================================================
    # MANEJADORES DE ERRORES PERSONALIZADOS
    # ============================================================
    # (Tu código de error handlers es correcto, lo mantenemos)
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify(success=False, code=400, error="Bad Request", message=str(error)), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify(success=False, code=401, error="Unauthorized", message="Token inválido o expirado"), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify(success=False, code=403, error="Forbidden", message="No tienes permisos"), 403

    @app.errorhandler(404)
    def not_found(error):
        if request.path.startswith('/api/'):
            return jsonify(success=False, code=404, error="Not Found", message="El recurso API no existe"), 404
        return render_template('index.html'), 404
    
    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify(success=False, code=500, error="Internal Server Error", message="Error en el servidor"), 500

    # ============================================================
    # RUTA "CATCH-ALL" PARA SERVIR LA SINGLE PAGE APP (SPA)
    # ============================================================
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        spa_routes = {
            "dashboard": "dashboard.html",
            "detection": "detection.html",
            "configuracion": "configuration.html",
        }
        if path in spa_routes:
            return render_template(spa_routes[path])
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        if '.' in path:
            abort(404)
        return render_template('index.html')

    return app

# ============================================================
# PUNTO DE ENTRADA (SOLO PARA EJECUCIÓN DIRECTA)
# ============================================================
if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)