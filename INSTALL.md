# 📦 Guía de Instalación - Sistema Detector de Tornillos

## Requisitos del Sistema

### Hardware Mínimo
- **CPU:** Intel i5 8th gen o AMD Ryzen 5 (4 núcleos)
- **RAM:** 8 GB mínimo (16 GB recomendado)
- **GPU:** NVIDIA GTX 1650 o superior (con soporte CUDA 11.x)
- **Almacenamiento:** 20 GB libres
- **Cámara:** USB 1080p @ 30fps o IP camera compatible

### Software
- **Sistema Operativo:** Windows 10/11, Ubuntu 20.04+, o macOS
- **Docker Desktop:** 4.20+ con soporte GPU (Windows/Linux)
- **NVIDIA Drivers:** 525.x o superior (para GPU)

---

## 🚀 Instalación Rápida (Docker - RECOMENDADA)

### Paso 1: Instalar Docker Desktop
**Windows:**
```powershell
# Descargar desde: https://www.docker.com/products/docker-desktop
# Asegurarse de habilitar WSL 2 durante instalación
```

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Paso 2: Instalar NVIDIA Container Toolkit (si tienes GPU)
**Windows:** Ya incluido en Docker Desktop + NVIDIA drivers

**Linux:**
```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Paso 3: Configurar variables de entorno
```powershell
# Copiar archivo de ejemplo
Copy-Item .env.example .env

# Editar .env con tus valores
notepad .env
```

### Paso 4: Iniciar el sistema
```powershell
# Construir e iniciar contenedores
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f web
```

### Paso 5: Inicializar base de datos
```powershell
# Ejecutar migraciones
docker-compose exec web flask db upgrade

# (Opcional) Cargar datos de ejemplo
docker-compose exec web python backend/seed_db.py
```

### Paso 6: Acceder al sistema
Abrir navegador en: **http://localhost**

**Credenciales por defecto:**
- Usuario: `admin`
- Contraseña: `admin123`

⚠️ **IMPORTANTE:** Cambiar contraseña en primer inicio

---

## 🔧 Instalación Manual (sin Docker)

### Paso 1: Instalar Python 3.11
**Windows:**
```powershell
# Descargar desde: https://www.python.org/downloads/
# Marcar "Add Python to PATH" durante instalación
python --version  # Verificar: 3.11.x
```

**Linux:**
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip
```

### Paso 2: Clonar repositorio
```powershell
cd C:\
git clone https://github.com/DPETP/tornillo-detector.git
cd tornillo-detector
```

### Paso 3: Crear entorno virtual
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate    # Linux/Mac
```

### Paso 4: Instalar dependencias
```powershell
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Paso 5: Instalar PostgreSQL
**Windows:**
```powershell
# Descargar desde: https://www.postgresql.org/download/windows/
# Usar instalador con pgAdmin incluido
# Crear DB: tornillo_detector
```

**Linux:**
```bash
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb tornillo_detector
sudo -u postgres createuser admin -P  # Ingresar contraseña
```

### Paso 6: Configurar variables de entorno
```powershell
# Crear .env en la raíz
$env:DATABASE_URL="postgresql://admin:password@localhost/tornillo_detector"
$env:FLASK_APP="backend.app:create_app"
$env:SECRET_KEY="your-secret-key"
```

### Paso 7: Ejecutar migraciones
```powershell
cd backend
flask db upgrade
python seed_db.py  # Datos de ejemplo
```

### Paso 8: Iniciar servidor
```powershell
# Desarrollo
flask run --host=0.0.0.0 --port=5000

# Producción
gunicorn --bind 0.0.0.0:5000 --workers 4 wsgi:app
```

---

## 📹 Configuración de Cámara

### Cámara USB
1. Conectar cámara al puerto USB 3.0
2. En el código, verificar índice: `cv2.VideoCapture(0)` 
3. Ajustar resolución: `1920x1080` recomendado

### Cámara IP
```javascript
// En detector.js, cambiar:
const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: 'rtsp://192.168.1.100:554/stream' }
});
```

### Iluminación
- **Tipo:** LED blanca fría (5000-6000K)
- **Potencia:** 20-30W
- **Posición:** 45° desde arriba, evitar sombras
- **Fondo:** Neutro (gris, azul oscuro)

---

## 🧪 Verificación de Instalación

### Test 1: Base de datos
```powershell
docker-compose exec web python -c "from backend.database.models import db; print('DB OK')"
```

### Test 2: Modelo YOLO
```powershell
docker-compose exec web python -c "from ultralytics import YOLO; m = YOLO('backend/uploads/best.pt'); print('Model OK')"
```

### Test 3: GPU (si aplica)
```powershell
docker-compose exec web python -c "import torch; print(f'GPU: {torch.cuda.is_available()}')"
```

### Test 4: API
```powershell
curl http://localhost/api/health
# Respuesta esperada: {"status": "ok", "db": "connected"}
```

---

## 🔄 Actualización del Sistema

```powershell
# Detener contenedores
docker-compose down

# Actualizar código
git pull origin main

# Reconstruir imágenes
docker-compose build

# Aplicar migraciones
docker-compose up -d
docker-compose exec web flask db upgrade
```

---

## 🐛 Solución de Problemas

### Error: "CUDA not available"
**Solución:**
1. Verificar drivers NVIDIA: `nvidia-smi`
2. Reinstalar NVIDIA Container Toolkit
3. Revisar `docker-compose.yml` tiene sección `deploy.resources`

### Error: "Database connection refused"
**Solución:**
```powershell
# Verificar DB está corriendo
docker-compose ps

# Ver logs de DB
docker-compose logs db

# Recrear contenedor DB
docker-compose down db
docker-compose up -d db
```

### Error: "Model file not found"
**Solución:**
1. Verificar archivo existe: `ls backend/uploads/best.pt`
2. Copiar modelo desde backup
3. Subir modelo vía panel admin

### Puerto 5000 ocupado
**Solución:**
```powershell
# Cambiar puerto en docker-compose.yml
ports:
  - "8080:5000"  # Usar 8080 en lugar de 5000
```

---

## 📞 Soporte

- **Email:** soporte@tornillo-detector.com
- **Documentación:** https://docs.tornillo-detector.com
- **Issues:** https://github.com/DPETP/tornillo-detector/issues

---

## 📄 Licencia

Propietario - BGH © 2025
