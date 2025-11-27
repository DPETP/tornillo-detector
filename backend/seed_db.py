"""
Script de inicialización de la base de datos
Crea usuarios por defecto y configuración inicial
"""

import sys
import os

# --- CORRECCIÓN DE ARQUITECTURA ---
# Obtenemos la ruta de la carpeta actual (backend) y la del padre (raíz del proyecto).
# Agregamos el padre al sistema para que Python pueda importar 'backend' como un paquete completo.
# Esto soluciona el error de "attempted relative import" en app.py definitivamente.
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# Importaciones corregidas usando la ruta absoluta del paquete 'backend'
from backend.app import create_app
from backend.database.models import db, User, Settings, SystemLog
from werkzeug.security import generate_password_hash


def seed_database():
    """Inicializa la base de datos con datos por defecto"""
    
    app = create_app()
    
    with app.app_context():
        print("\n" + "=" * 70)
        print("INICIALIZANDO BASE DE DATOS - TORNILLO DETECTOR")
        print("=" * 70)
        
        try:
            # --- PASO CRÍTICO: CREACIÓN DE TABLAS ---
            # Como es una base de datos nueva (tornillo_dev.db), las tablas no existen.
            # Esto las crea basándose en tus modelos antes de insertar datos.
            db.create_all()
            print("✓ Estructura de tablas creada correctamente")

            # ========================================================
            # 1. CREAR USUARIO ADMINISTRADOR
            # ========================================================
            admin = User.query.filter_by(username='admin').first()
            if not admin:
                admin = User(
                    username='admin',
                    email='admin@bgh.com',
                    password_hash=generate_password_hash('admin123'),
                    team='Administración',
                    role='admin',
                    is_active=True
                )
                db.session.add(admin)
                db.session.commit()
                print("✓ Usuario ADMINISTRADOR creado: admin / admin123")
            else:
                print("✓ Usuario ADMINISTRADOR ya existe")
            
            # ========================================================
            # 2. CREAR USUARIO SOPORTE TÉCNICO
            # ========================================================
            soporte = User.query.filter_by(username='soporte').first()
            if not soporte:
                soporte = User(
                    username='soporte',
                    email='soporte@bgh.com',
                    password_hash=generate_password_hash('soporte123'),
                    team='Soporte Técnico',
                    role='soporte_tecnico',
                    is_active=True,
                    creado_por_id=admin.id
                )
                db.session.add(soporte)
                db.session.commit()
                print("✓ Usuario SOPORTE TÉCNICO creado: soporte / soporte123")
            else:
                print("✓ Usuario SOPORTE TÉCNICO ya existe")
            
            # ========================================================
            # 3. CREAR USUARIO OPERARIO
            # ========================================================
            operario = User.query.filter_by(username='operario').first()
            if not operario:
                operario = User(
                    username='operario',
                    email='operario@bgh.com',
                    password_hash=generate_password_hash('operario123'),
                    team='QA Team',
                    role='operario',
                    is_active=True,
                    creado_por_id=admin.id
                )
                db.session.add(operario)
                db.session.commit()
                print("✓ Usuario OPERARIO DE CALIDAD creado: operario / operario123")
            else:
                print("✓ Usuario OPERARIO DE CALIDAD ya existe")
            
            # ========================================================
            # 4. CREAR CONFIGURACIÓN INICIAL
            # ========================================================
            settings = Settings.query.first()
            if not settings:
                settings = Settings(
                    ac_model_activo_id=None,
                    permitir_registro_publico=False
            )
                db.session.add(settings)
                db.session.commit()
                print("✓ Configuración inicial creada")
            else:
                print("✓ Configuración ya existe")
            
            # ========================================================
            # 5. CREAR LOG INICIAL
            # ========================================================
            log = SystemLog(
                level='INFO',
                message='Base de datos inicializada correctamente'
            )
            db.session.add(log)
            db.session.commit()
            
            # ========================================================
            # RESUMEN
            # ========================================================
            print("\n" + "=" * 70)
            print("✓✓✓ BASE DE DATOS INICIALIZADA CORRECTAMENTE ✓✓✓")
            print("=" * 70)
            print("\nUsuarios disponibles:")
            print("  1. admin          / admin123       (Rol: ADMINISTRADOR)")
            print("  2. soporte        / soporte123     (Rol: SOPORTE TÉCNICO)")
            print("  3. operario       / operario123    (Rol: OPERARIO DE CALIDAD)")
            print("\nConfiguración inicial:")
            print("  - Tornillos objetivo: 100")
            print("  - Umbral de confianza: 0.5")
            print("  - Registro público: Deshabilitado")
            print("\n" + "=" * 70 + "\n")
            
        except Exception as e:
            print(f"\n✗ Error durante la inicialización: {str(e)}")
            db.session.rollback()
            raise


if __name__ == '__main__':
    seed_database()