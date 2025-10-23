from app import create_app, db
from database.models import User
from werkzeug.security import generate_password_hash

app = create_app()
with app.app_context():
    # Verificar si el usuario ya existe
    existing_user = User.query.filter_by(username='admin').first()
    if existing_user:
        print("El usuario 'admin' ya existe")
    else:
        # Crear nuevo usuario
        user = User(
            username='admin',
            email='admin@bgh.com',
            password_hash=generate_password_hash('admin123'),
            team='QA Team',
            role='admin'
        )
        db.session.add(user)
        db.session.commit()
        print("✓ Usuario 'admin' creado exitosamente")
        print("  Usuario: admin")
        print("  Contraseña: admin123")