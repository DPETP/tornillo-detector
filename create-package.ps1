# Script para crear paquete de distribución
# Ejecutar: .\create-package.ps1

param(
    [string]$Version = "1.0.0"
)

$PackageName = "tornillo-detector-v$Version"
$PackageDir = "dist\$PackageName"

Write-Host "📦 Creando paquete de distribución v$Version" -ForegroundColor Cyan
Write-Host ""

# Crear directorio de distribución
Write-Host "📁 Creando estructura de directorios..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $PackageDir | Out-Null

# Copiar archivos esenciales
Write-Host "📋 Copiando archivos del proyecto..." -ForegroundColor Yellow

# Backend (código fuente)
Copy-Item -Recurse -Path "backend" -Destination "$PackageDir\backend" -Force
Remove-Item -Recurse -Force "$PackageDir\backend\__pycache__" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$PackageDir\backend\*\__pycache__" -ErrorAction SilentlyContinue

# Migraciones
Copy-Item -Recurse -Path "migrations" -Destination "$PackageDir\migrations" -Force

# Archivos Docker
Copy-Item "docker-compose.yml" -Destination "$PackageDir\" -Force
Copy-Item "Dockerfile" -Destination "$PackageDir\" -Force
Copy-Item "nginx.conf" -Destination "$PackageDir\" -Force
Copy-Item ".dockerignore" -Destination "$PackageDir\" -Force

# Configuración
Copy-Item ".env.example" -Destination "$PackageDir\" -Force

# Scripts de instalación
Copy-Item "install.ps1" -Destination "$PackageDir\" -Force
Copy-Item "install.sh" -Destination "$PackageDir\" -Force

# Documentación
Copy-Item "INSTALL.md" -Destination "$PackageDir\" -Force
Copy-Item "DISTRIBUTION.md" -Destination "$PackageDir\" -Force
Copy-Item "README.md" -Destination "$PackageDir\" -Force -ErrorAction SilentlyContinue

# wsgi.py
Copy-Item "wsgi.py" -Destination "$PackageDir\" -Force -ErrorAction SilentlyContinue

Write-Host "✓ Archivos copiados" -ForegroundColor Green

# Crear README de instalación rápida
Write-Host "📝 Generando README de instalación..." -ForegroundColor Yellow
$QuickStart = @"
Sistema Detector de Tornillos v$Version

Instalacion Rapida

Windows:
1. Instalar Docker Desktop desde: https://www.docker.com/products/docker-desktop
2. Reiniciar computadora
3. Ejecutar como administrador: install.ps1
4. Abrir navegador en: http://localhost

Linux:
1. Ejecutar: sudo bash install.sh
2. Abrir navegador en: http://localhost

Credenciales por defecto:
- Usuario: admin
- Contraseña: admin123

IMPORTANTE: Cambiar contraseña en primer acceso

Documentacion completa:
Ver archivo INSTALL.md

Soporte:
- Email: soporte@tornillo-detector.com
- GitHub: https://github.com/DPETP/tornillo-detector

BGH 2025 - Sistema de Inspeccion Automatizada
"@

$QuickStart | Out-File -FilePath "$PackageDir\README_INSTALACION.txt" -Encoding UTF8

Write-Host "✓ README creado" -ForegroundColor Green

# Crear archivo de versión
Write-Host "🏷️  Registrando versión..." -ForegroundColor Yellow
$VersionInfo = @"
Version: $Version
Build Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Platform: Windows/Linux
Docker Required: Yes
GPU Support: NVIDIA CUDA 11.8+
"@

$VersionInfo | Out-File -FilePath "$PackageDir\VERSION.txt" -Encoding UTF8
Write-Host "✓ Versión registrada" -ForegroundColor Green

# Comprimir paquete
Write-Host ""
Write-Host "🗜️  Comprimiendo paquete..." -ForegroundColor Yellow
$ZipPath = "dist\$PackageName.zip"
Compress-Archive -Path "$PackageDir\*" -DestinationPath $ZipPath -Force

Write-Host "✓ Paquete comprimido" -ForegroundColor Green

# Estadísticas
$ZipSize = (Get-Item $ZipPath).Length / 1MB
Write-Host ""
Write-Host "✅ Paquete creado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Información:" -ForegroundColor Cyan
Write-Host "   Archivo: $ZipPath" -ForegroundColor White
Write-Host "   Tamaño: $($ZipSize.ToString('F2')) MB" -ForegroundColor White
Write-Host ""
Write-Host "📦 Contenido del paquete:" -ForegroundColor Cyan
Get-ChildItem -Path $PackageDir -Recurse -File | ForEach-Object {
    Write-Host "   - $($_.FullName.Replace($PackageDir + '\', ''))" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Siguiente paso:" -ForegroundColor Yellow
Write-Host "   Distribuir archivo: $ZipPath" -ForegroundColor White
Write-Host ""
Write-Host "💡 El cliente debe:" -ForegroundColor Yellow
Write-Host "   1. Descomprimir ZIP" -ForegroundColor White
Write-Host "   2. Instalar Docker Desktop (si no tiene)" -ForegroundColor White
Write-Host "   3. Ejecutar install.ps1 como administrador" -ForegroundColor White
Write-Host "   4. Acceder a http://localhost" -ForegroundColor White
Write-Host ""

# Preguntar si abrir carpeta
$OpenFolder = Read-Host "¿Abrir carpeta de distribución? (S/N)"
if ($OpenFolder -eq "S" -or $OpenFolder -eq "s") {
    explorer.exe (Resolve-Path "dist").Path
}
