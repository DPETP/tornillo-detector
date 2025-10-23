from app import create_app, db
from database.models import User

app = create_app()
with app.app_context():
    users = User.query.all()
    print(f"Total de usuarios: {len(users)}")
    for user in users:
        print(f"  - Usuario: {user.username}, Email: {user.email}")