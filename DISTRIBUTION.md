# 📦 Guía de Distribución del Sistema

## Opción 1: Distribuir via ZIP/Instalador

### Para crear paquete portable:

```powershell
# 1. Crear carpeta de distribución
New-Item -ItemType Directory -Force "tornillo-detector-installer"

# 2. Copiar archivos esenciales
Copy-Item -Recurse backend, migrations, docker-compose.yml, Dockerfile, nginx.conf, .env.example, install.ps1, INSTALL.md tornillo-detector-installer\

# 3. Comprimir
Compress-Archive -Path tornillo-detector-installer -DestinationPath tornillo-detector-v1.0.0.zip
```

### El cliente debe:
1. Descomprimir ZIP
2. Instalar Docker Desktop (si no tiene)
3. Ejecutar `install.ps1` como administrador
4. Sistema listo en http://localhost

---

## Opción 2: Distribuir via Instalador .exe (Windows)

### Usar Inno Setup para crear instalador:

1. Instalar Inno Setup: https://jrsoftware.org/isdl.php
2. Crear script `installer.iss`:

```iss
[Setup]
AppName=Tornillo Detector
AppVersion=1.0.0
DefaultDirName={autopf}\TornilloDetector
OutputBaseFilename=TornilloDetectorSetup
Compression=lzma2
SolidCompression=yes

[Files]
Source: "backend\*"; DestDir: "{app}\backend"; Flags: recursesubdirs
Source: "migrations\*"; DestDir: "{app}\migrations"; Flags: recursesubdirs
Source: "docker-compose.yml"; DestDir: "{app}"
Source: "Dockerfile"; DestDir: "{app}"
Source: ".env.example"; DestDir: "{app}"

[Run]
Filename: "{app}\install.ps1"; Description: "Iniciar instalación"; Flags: postinstall shellexec
```

3. Compilar: `iscc installer.iss`
4. Distribuir `TornilloDetectorSetup.exe`

---

## Opción 3: Distribuir via Docker Hub (Recomendado para empresas)

### Subir imagen a registry:

```powershell
# 1. Build imagen
docker build -t tornillo-detector:1.0.0 .

# 2. Tag para Docker Hub
docker tag tornillo-detector:1.0.0 tuusuario/tornillo-detector:1.0.0

# 3. Push
docker login
docker push tuusuario/tornillo-detector:1.0.0

# 4. Actualizar docker-compose.yml en cliente:
# services:
#   web:
#     image: tuusuario/tornillo-detector:1.0.0  # En lugar de build: .
```

### El cliente solo necesita:
```powershell
# Descargar docker-compose.yml
curl -O https://raw.githubusercontent.com/DPETP/tornillo-detector/main/docker-compose.yml

# Iniciar
docker-compose up -d
```

---

## Opción 4: USB Booteable con Sistema Completo

### Para instalaciones offline:

```powershell
# 1. Guardar imágenes Docker
docker save -o tornillo-detector-images.tar tornillo-detector:1.0.0 postgres:15-alpine nginx:alpine

# 2. Copiar a USB junto con:
# - docker-compose.yml
# - install.ps1
# - INSTALL.md

# 3. En máquina cliente (offline):
docker load -i tornillo-detector-images.tar
docker-compose up -d
```

---

## Checklist de archivos para distribuir:

### ✅ Archivos esenciales:
- [ ] `docker-compose.yml`
- [ ] `Dockerfile`
- [ ] `nginx.conf`
- [ ] `.env.example`
- [ ] `INSTALL.md`
- [ ] `install.ps1` (Windows) o `install.sh` (Linux)
- [ ] `backend/` (código fuente)
- [ ] `migrations/` (scripts DB)

### ✅ Archivos opcionales:
- [ ] `README.md` (documentación general)
- [ ] `backend/uploads/best.pt` (modelo pre-entrenado)
- [ ] `backend/static/assets/logo.png` (favicon)
- [ ] Certificados SSL (si aplica)

### ✅ Documentación:
- [ ] Manual de usuario (PDF)
- [ ] Guía de troubleshooting
- [ ] Video tutorial de instalación
- [ ] Contactos de soporte

---

## Versionado y Updates:

### Crear nueva versión:
```powershell
# 1. Actualizar version en docker-compose.yml
# services:
#   web:
#     image: tornillo-detector:1.1.0

# 2. Tag en Git
git tag v1.1.0
git push origin v1.1.0

# 3. Build nueva imagen
docker build -t tornillo-detector:1.1.0 .

# 4. Crear release notes
```

### Cliente puede actualizar con:
```powershell
docker-compose down
docker-compose pull
docker-compose up -d
docker-compose exec web flask db upgrade  # Si hay cambios en DB
```

---

## Licenciamiento (si aplica):

### Agregar validación de licencia en `backend/app.py`:

```python
import os
from datetime import datetime

def validate_license():
    license_key = os.getenv('LICENSE_KEY')
    expiry_date = os.getenv('LICENSE_EXPIRY', '2099-12-31')
    
    if not license_key:
        raise Exception("Licencia no encontrada")
    
    if datetime.now() > datetime.strptime(expiry_date, '%Y-%m-%d'):
        raise Exception("Licencia expirada")
    
    # Validar contra servidor de licencias (opcional)
    return True

# Llamar en app factory
validate_license()
```

### Variables en .env del cliente:
```
LICENSE_KEY=XXXX-XXXX-XXXX-XXXX
LICENSE_EXPIRY=2025-12-31
```
