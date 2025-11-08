# ORUS VISION: Sistema de Detección de Tornillos por Visión Artificial

![ORUS VISION Logo](backend/static/assets/logo.png) <!-- Ajusta la ruta a tu logo si es diferente -->

**ORUS VISION** es una aplicación web de control de calidad automatizado diseñada para líneas de ensamblaje industrial. Utiliza visión por computadora en tiempo real para detectar y validar la cantidad de tornillos en piezas manufacturadas, mejorando la eficiencia y reduciendo el error humano.

---

## ✨ Características Principales

-   **Detección en Tiempo Real:** Utiliza un modelo **YOLOv8** para analizar el video de una cámara web y detectar objetos (cabezas de tornillo) en tiempo real.
-   **Ciclo de Inspección Inteligente:** Implementa un sistema de inspección por ciclos configurables, acumulando el conteo máximo de detecciones para mayor precisión en entornos dinámicos.
-   **Panel de Control Dinámico (Dashboard):** Muestra estadísticas de producción en tiempo real (Total de inspecciones, PASS, FAIL).
-   **Sistema de Configuración Avanzado:** Permite a los administradores gestionar:
    -   **Usuarios y Roles:** Control de acceso granular (Admin, Soporte Técnico, Operario).
    -   **Perfiles de Inspección (Modelos AA):** Define reglas específicas por producto (tornillos objetivo, tiempo de ciclo, confianza).
    -   **Modelos de IA:** Carga y activa diferentes modelos de IA (`.pt`) directamente desde la interfaz.
-   **Interfaz de Usuario Adaptativa:** La navegación y las funcionalidades se ajustan automáticamente según el rol del usuario que ha iniciado sesión.

---

## 🚀 Pila Tecnológica (Tech Stack)

| Componente      | Tecnología                                |
| --------------- | ----------------------------------------- |
| **Backend**     | Python 3.12+, Flask                       |
| **Frontend**    | HTML5, CSS3, JavaScript (Vanilla JS)      |
| **Visión IA**   | Ultralytics YOLOv8, OpenCV                |
| **Base de Datos** | SQLite (desarrollo), PostgreSQL (recomendado) |
| **ORM**         | Flask-SQLAlchemy                          |
| **Migraciones** | Flask-Migrate (Alembic)                   |
| **Autenticación**| Flask-JWT-Extended (JSON Web Tokens)      |

---

## 🏛️ Arquitectura del Sistema

El sistema sigue una arquitectura de aplicación web moderna y desacoplada, optimizada para la escalabilidad y el mantenimiento.

```
+--------------------------+
|  FRONTEND (Cliente Web)  |  <-- UI Interactiva (SPA)
|  (HTML, CSS, Vanilla JS) |
+--------------------------+
             |
      (API REST / JWT)
             |
+--------------------------+
|     BACKEND (Servidor)   |  <-- Lógica de Negocio
|     (Python, Flask)      |
+--------------------------+
     |                  |
     | (SQLAlchemy)     | (Llamada a función)
     |                  |
+----------+     +-----------------+
| DATABASE |     | MÓDULO DE VISIÓN|  <-- "Cerebro" y "Ojo"
| (SQLite) |     |  (Python, YOLO) |
+----------+     +-----------------+
```

---

## 📁 Estructura del Proyecto

La organización del código está diseñada para la modularidad y la claridad.

```
/
├── weights/                # Almacena los modelos .pt
├── migrations/             # Scripts de migración de la BD (Alembic)
├── backend/                # Paquete principal de la aplicación Flask
│   ├── __init__.py
│   ├── app.py              # Application Factory
│   ├── config.py           # Configuraciones
│   ├── database/           # Modelos SQLAlchemy
│   ├── routes/             # Blueprints (API endpoints)
│   ├── vision/             # Lógica de YOLO
│   ├── static/             # Archivos CSS, JS, imágenes
│   └── templates/          # Plantillas HTML (Jinja2)
├── .flaskenv               # Variables de entorno para Flask
└── requirements.txt        # Dependencias de Python
```

---

## ⚙️ Guía de Instalación y Puesta en Marcha

Sigue estos pasos para ejecutar el proyecto en un entorno de desarrollo local.

### 1. Prerrequisitos
-   Python 3.10+
-   Git

### 2. Instalación
```bash
# 1. Clona el repositorio
git clone https://github.com/tu-usuario/tu-repositorio.git
cd tornillo-detector

# 2. Crea y activa un entorno virtual
python -m venv venv
# En Windows:
.\venv\Scripts\activate
# En macOS/Linux:
# source venv/bin/activate

# 3. Instala las dependencias
pip install -r requirements.txt
```

### 3. Configuración de la Base de Datos
La primera vez que ejecutes el proyecto, necesitas crear y actualizar la base de datos.

```bash
# 1. Asegúrate de tener el archivo .flaskenv en la raíz del proyecto
#    con el contenido:
#    FLASK_APP=backend/app.py
#    FLASK_DEBUG=1

# 2. Inicializa la base de datos con Alembic
flask db upgrade
```

### 4. Creación de un Usuario Administrador (Opcional)
Puedes crear un usuario administrador inicial ejecutando un script de seed (si lo tienes) o modificando un usuario directamente en la base de datos.

### 5. Ejecución
```bash
# Con el entorno virtual activado y desde la carpeta raíz, ejecuta:
flask run
```
La aplicación estará disponible en `http://localhost:5000`.

---

## 📈 Roadmap y Mejoras Futuras

Este proyecto es una base sólida con un gran potencial de crecimiento. Las próximas mejoras planificadas incluyen:

-   [ ] **Módulo de Reportes:** Desarrollar una interfaz para visualizar, filtrar y exportar el historial de inspecciones.
-   [ ] **WebSockets:** Migrar la transmisión de video a WebSockets para reducir la latencia.
-   [ ] **Ciclo de Reentrenamiento:** Implementar una función para que los operarios capturen imágenes de casos difíciles, facilitando la mejora continua del modelo de IA.
-   [ ] **Dashboard con Gráficos:** Añadir visualizaciones de datos (ej. con Chart.js) para analizar tendencias de producción.

---

Desarrollado por [Tu Nombre/Equipo].
