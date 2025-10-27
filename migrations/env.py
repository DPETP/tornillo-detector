import os
import sys
import logging 
from logging.config import fileConfig

from alembic import context
# Importamos la función 'create_app' y el objeto 'db' desde nuestro código
from backend.app import create_app, db

# -------------------------------------------------------------------------
# --- SECCIÓN DE CONFIGURACIÓN DE LA APLICACIÓN FLASK PARA ALEMBIC ---
# -------------------------------------------------------------------------

# 1. Añadimos la ruta del proyecto al path de Python para que pueda encontrar 'backend'
# Sube un nivel desde 'migrations' a la raíz del proyecto.
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '..')))

# 2. Creamos una instancia de la aplicación Flask para obtener su contexto
# Lee la configuración del entorno o usa 'development' por defecto.
app = create_app(os.getenv('FLASK_ENV') or 'development')

# 3. Empujamos el contexto de la aplicación.
# Esto hace que 'current_app' y otras variables de Flask estén disponibles.
app.app_context().push()

# -------------------------------------------------------------------------
# --- CONFIGURACIÓN ESTÁNDAR DE ALEMBIC ---
# -------------------------------------------------------------------------

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = db.metadata  # ¡ESTO ES CRUCIAL! Le decimos a Alembic qué comparar.

def get_engine_url():
    # Obtiene la URL de la base de datos desde la configuración de la app Flask
    return app.config.get('SQLALCHEMY_DATABASE_URI')

config.set_main_option('sqlalchemy.url', get_engine_url().replace('%', '%%'))

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline():
    """Run migrations in 'offline' mode.
    (El resto de esta función y las siguientes se mantienen como en el original,
     ya que dependen de 'target_metadata' y 'config' que ya hemos definido)
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    
    # Obtenemos el engine de la base de datos desde nuestra instancia de 'db'
    connectable = db.engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()