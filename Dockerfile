# Imagen base con Python y CUDA para GPU
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Instalar Python y dependencias del sistema
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar requirements primero (cache de Docker)
COPY backend/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY backend/ ./backend/
COPY migrations/ ./migrations/

# Crear directorios necesarios
RUN mkdir -p backend/uploads backend/static/assets

# Variables de entorno
ENV FLASK_APP=backend.app:create_app
ENV PYTHONUNBUFFERED=1

# Exponer puerto
EXPOSE 5000

# Comando de inicio
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "backend.app:create_app()"]
