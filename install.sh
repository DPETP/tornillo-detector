#!/bin/bash
# Script de instalación automática para Linux

set -e

echo "🔧 Instalador - Sistema Detector de Tornillos"
echo "=============================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar si es root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Este script debe ejecutarse como root (sudo)${NC}"
   exit 1
fi

# Detectar distribución
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
fi

echo -e "${GREEN}✓${NC} Sistema detectado: $OS $VER"
echo ""

# Función para verificar comando
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 instalado"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $1 no encontrado"
        return 1
    fi
}

# Verificar dependencias
echo "📋 Verificando dependencias..."
INSTALL_DOCKER=false
INSTALL_NVIDIA=false

if ! check_command docker; then
    INSTALL_DOCKER=true
fi

if ! check_command nvidia-smi; then
    echo -e "${YELLOW}⚠${NC} NVIDIA drivers no detectados (opcional para GPU)"
else
    INSTALL_NVIDIA=true
fi

echo ""

# Instalar Docker
if [ "$INSTALL_DOCKER" = true ]; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $SUDO_USER
    rm get-docker.sh
    echo -e "${GREEN}✓${NC} Docker instalado"
fi

# Instalar Docker Compose
if ! check_command docker-compose; then
    echo "📦 Instalando Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓${NC} Docker Compose instalado"
fi

# Instalar NVIDIA Container Toolkit
if [ "$INSTALL_NVIDIA" = true ]; then
    echo "🎮 Instalando NVIDIA Container Toolkit..."
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
    curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add -
    curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | tee /etc/apt/sources.list.d/nvidia-docker.list
    apt-get update
    apt-get install -y nvidia-container-toolkit
    systemctl restart docker
    echo -e "${GREEN}✓${NC} NVIDIA Container Toolkit instalado"
fi

echo ""
echo "⚙️  Configurando aplicación..."

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠${NC} Archivo .env creado desde plantilla"
    echo "   Por favor editar .env con tus valores antes de continuar"
    echo ""
    read -p "¿Deseas editar .env ahora? (s/n): " edit_env
    if [ "$edit_env" = "s" ]; then
        ${EDITOR:-nano} .env
    fi
fi

# Crear directorios necesarios
mkdir -p backend/uploads
mkdir -p backend/static/assets

echo ""
echo "🚀 Iniciando sistema..."
docker-compose up -d

echo ""
echo "⏳ Esperando que los servicios estén listos..."
sleep 10

echo ""
echo "💾 Inicializando base de datos..."
docker-compose exec -T web flask db upgrade

echo ""
echo -e "${GREEN}✅ Instalación completada!${NC}"
echo ""
echo "📍 Acceder al sistema en: http://localhost"
echo ""
echo "📊 Comandos útiles:"
echo "   Ver logs:        docker-compose logs -f"
echo "   Detener:         docker-compose down"
echo "   Reiniciar:       docker-compose restart"
echo "   Estado:          docker-compose ps"
echo ""
echo "⚠️  Recuerda cambiar las contraseñas por defecto en la primera ejecución"
