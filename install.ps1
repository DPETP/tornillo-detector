# Script de instalacion automatica para Windows
# Ejecutar con: .\install.ps1

$ErrorActionPreference = "Stop"

Write-Host "Instalador - Sistema Detector de Tornillos" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Funcion para verificar si un comando existe
function Test-Command {
    param($Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Verificar privilegios de administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Este script debe ejecutarse como Administrador" -ForegroundColor Red
    Write-Host "Haz clic derecho en PowerShell y selecciona 'Ejecutar como administrador'" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "OK: Ejecutando con privilegios de administrador" -ForegroundColor Green
Write-Host ""

# Verificar Docker Desktop
Write-Host "Verificando dependencias..." -ForegroundColor Cyan
if (-not (Test-Command docker)) {
    Write-Host "ERROR: Docker Desktop no esta instalado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor instalar Docker Desktop:" -ForegroundColor Yellow
    Write-Host "1. Descargar desde: https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host "2. Ejecutar instalador" -ForegroundColor White
    Write-Host "3. Reiniciar computadora" -ForegroundColor White
    Write-Host "4. Habilitar WSL 2 si se solicita" -ForegroundColor White
    Write-Host "5. Volver a ejecutar este script" -ForegroundColor White
    Write-Host ""
    $open = Read-Host "Abrir pagina de descarga ahora? (S/N)"
    if ($open -eq "S" -or $open -eq "s") {
        Start-Process "https://www.docker.com/products/docker-desktop"
    }
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "OK: Docker Desktop instalado" -ForegroundColor Green

# Verificar que Docker esta corriendo
try {
    docker ps 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Host "OK: Docker Desktop esta corriendo" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker Desktop no esta corriendo" -ForegroundColor Red
    Write-Host "Por favor iniciar Docker Desktop y esperar a que se complete" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Verificar NVIDIA GPU (opcional)
Write-Host ""
Write-Host "Verificando GPU NVIDIA..." -ForegroundColor Cyan
if (Test-Command nvidia-smi) {
    $gpuInfo = nvidia-smi --query-gpu=name --format=csv,noheader 2>$null
    if ($gpuInfo) {
        Write-Host "OK: GPU detectada: $gpuInfo" -ForegroundColor Green
    }
} else {
    Write-Host "ADVERTENCIA: GPU NVIDIA no detectada" -ForegroundColor Yellow
    Write-Host "El sistema funcionara con CPU (mas lento)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Configurando aplicacion..." -ForegroundColor Cyan

# Crear archivo .env si no existe
if (-not (Test-Path .env)) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-Host "OK: Archivo .env creado desde plantilla" -ForegroundColor Green
    } else {
        Write-Host "ADVERTENCIA: .env.example no encontrado" -ForegroundColor Yellow
    }
}

# Crear directorios necesarios
New-Item -ItemType Directory -Force -Path "backend\uploads" -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory -Force -Path "backend\static\assets" -ErrorAction SilentlyContinue | Out-Null
Write-Host "OK: Directorios creados" -ForegroundColor Green

Write-Host ""
Write-Host "Construyendo e iniciando sistema..." -ForegroundColor Cyan
Write-Host "(Esto puede tardar varios minutos la primera vez)" -ForegroundColor Yellow
Write-Host ""

try {
    docker-compose up -d --build
    if ($LASTEXITCODE -ne 0) { throw "Error al iniciar contenedores" }
} catch {
    Write-Host "ERROR: No se pudo iniciar el sistema" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "Esperando que los servicios esten listos..." -ForegroundColor Cyan
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "Inicializando base de datos..." -ForegroundColor Cyan
try {
    docker-compose exec -T web flask db upgrade 2>&1 | Out-Null
    Write-Host "OK: Base de datos inicializada" -ForegroundColor Green
} catch {
    Write-Host "ADVERTENCIA: Error al inicializar DB (puede ser normal en primera ejecucion)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Instalacion completada!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Acceder al sistema en: http://localhost" -ForegroundColor Cyan
Write-Host ""
Write-Host "Credenciales por defecto:" -ForegroundColor Yellow
Write-Host "  Usuario: admin" -ForegroundColor White
Write-Host "  Contrasena: admin123" -ForegroundColor White
Write-Host ""
Write-Host "Comandos utiles:" -ForegroundColor Cyan
Write-Host "  Ver logs:    docker-compose logs -f" -ForegroundColor White
Write-Host "  Detener:     docker-compose down" -ForegroundColor White
Write-Host "  Reiniciar:   docker-compose restart" -ForegroundColor White
Write-Host "  Estado:      docker-compose ps" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANTE: Cambiar contrasena en primer acceso" -ForegroundColor Yellow
Write-Host ""

$open = Read-Host "Abrir sistema en navegador? (S/N)"
if ($open -eq "S" -or $open -eq "s") {
    Start-Process "http://localhost"
}

Read-Host "Presiona Enter para salir"
