# 🚀 ASLIN 2.0

Sistema modular de gestión administrativa construido con arquitectura moderna y escalable.

## 📋 Descripción

**Aslin 2.0** es una aplicación web full-stack diseñada para gestionar procesos administrativos de manera eficiente. El sistema incluye módulos para gestión de usuarios, autenticación con 2FA, y está preparado para expandirse con módulos de siniestros, bitácoras y reportes.

## 🛠️ Stack Tecnológico

### Backend
- **Python 3.12+** - Lenguaje de programación
- **FastAPI 0.109.0** - Framework web moderno y rápido
- **SQLAlchemy 2.0.25** - ORM para base de datos
- **Alembic 1.13.1** - Migraciones de base de datos
- **Pydantic 2.5.3** - Validación de datos
- **JWT + 2FA (TOTP)** - Autenticación segura con doble factor
- **PostgreSQL 15** - Base de datos relacional
- **Uvicorn** - Servidor ASGI

### Frontend
- **Next.js 15.0.0** - Framework React con App Router
- **TypeScript 5** - Tipado estático
- **Tailwind CSS 3.4.1** - Estilos modernos y responsivos
- **Axios 1.6.5** - Cliente HTTP
- **React Toastify 10.0.4** - Notificaciones
- **React Icons 4.12.0** - Iconografía

### DevOps
- **Docker & Docker Compose** - Contenedorización
- **Makefile** - Automatización de tareas
- **Health Checks** - Monitoreo de servicios

## 🚀 Inicio Rápido

### Requisitos Previos
- Docker Desktop instalado
- Docker Compose

### Levantar el Proyecto

```bash
# Clonar el repositorio
git clone https://github.com/AsicomSoftware/aslinmx-v2.git
cd Aslin

# Opción 1: Usar Makefile (recomendado)
make install

# Opción 2: Docker Compose directo
docker-compose up --build -d

# El backend estará disponible en: http://localhost:8000
# El frontend estará disponible en: http://localhost:3000
# La documentación API (Swagger): http://localhost:8000/docs
# Health Check: http://localhost:8000/health
```

### Comandos Útiles

```bash
# Usar Makefile para comandos comunes
make help                    # Ver todos los comandos disponibles
make up                      # Levantar servicios
make down                    # Detener servicios
make logs                    # Ver logs de todos los servicios
make logs-backend            # Ver logs del backend
make logs-frontend           # Ver logs del frontend
make migrate                 # Aplicar migraciones
make test                    # Ejecutar tests
make clean                   # Limpiar contenedores e imágenes

# Comandos Docker directos
docker-compose down -v       # Detener y eliminar volúmenes (¡CUIDADO!)
docker-compose restart       # Reiniciar todos los servicios
docker-compose exec backend bash  # Acceder al shell del backend
docker-compose exec db psql -U root -d aslin_mx_v2  # Acceder a PostgreSQL
```

## 📁 Estructura del Proyecto

```
Aslin/
├── backend/                    # API REST con FastAPI
│   ├── app/
│   │   ├── api/               # Rutas de la API
│   │   ├── core/              # Configuración y seguridad
│   │   ├── db/                # Base de datos y sesiones
│   │   ├── models/            # Modelos SQLAlchemy
│   │   ├── schemas/           # Esquemas Pydantic
│   │   ├── services/          # Lógica de negocio
│   │   ├── tests/             # Tests unitarios
│   │   └── utils/             # Utilidades
│   ├── alembic/               # Migraciones de BD
│   ├── requirements.txt       # Dependencias Python
│   └── Dockerfile
├── frontend/                   # Aplicación Next.js 15
│   ├── app/                   # App Router
│   │   ├── dashboard/         # Módulo dashboard
│   │   ├── login/             # Módulo login
│   │   └── perfil/            # Módulo perfil
│   ├── components/            # Componentes reutilizables
│   │   └── ui/                # Componentes de UI
│   ├── lib/                   # Servicios y utilidades
│   ├── styles/                # Estilos globales
│   ├── assets/                # Recursos estáticos
│   ├── package.json           # Dependencias Node.js
│   └── Dockerfile
├── docs/                      # Documentación del proyecto
├── db/                        # Scripts de base de datos
├── reports/                   # Reportes del proyecto
├── docker-compose.yml         # Orquestación de servicios
├── Makefile                   # Automatización de tareas
├── .env-example               # Variables de entorno de ejemplo
└── README.md
```

## 📚 Documentación

Para más información detallada, consulta la carpeta `docs/`:

- [Quick Start](./docs/QUICK_START.md) - Inicio rápido en 5 minutos
- [Setup Guide](./docs/SETUP.md) - Guía completa de instalación y configuración
- [API Guide](./docs/API_GUIDE.md) - Documentación completa de la API
- [Frontend Guide](./docs/FRONT_GUIDE.md) - Guía del frontend y componentes

## 🔒 Seguridad

- **JWT** para autenticación con tokens seguros
- **2FA (TOTP)** para autenticación de doble factor
- **Bcrypt** para hash de contraseñas
- **CORS** configurado para orígenes específicos
- **Validación** de datos con Pydantic
- **Variables de entorno** para credenciales sensibles
- **Health checks** para monitoreo de servicios

## 🔄 Despliegue (GitHub Actions + Docker)

El workflow `.github/workflows/deploy.yml` construye y publica imágenes en GHCR; el servidor ejecuta `docker-compose.prod.yml`.

### Secretos del repositorio (Actions)

Configura en **Settings → Secrets and variables → Actions** (además de los secretos de SSH/servidor que ya usa el workflow) al menos:

| Secreto | Uso |
|--------|-----|
| `NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID` | Build del frontend (Google Calendar en el cliente) |
| `NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY` | Build del frontend (Google Calendar en el cliente) |

En **Next.js**, las variables `NEXT_PUBLIC_*` se resuelven **al hacer `next build`** dentro de la imagen Docker. Por eso deben pasarse como `--build-arg` en CI (ya configurado en el workflow), no solo en el `.env` del servidor tras un `docker compose up`.

Desarrollo local con `docker-compose.dev.yml`: define las mismas claves en tu `.env` en la raíz del proyecto (o en `frontend/.env.local` si corres Next fuera de Docker).

## 🚀 Características Principales

- **Arquitectura modular** con separación clara de responsabilidades
- **API REST** documentada con Swagger/OpenAPI
- **Autenticación robusta** con JWT y 2FA (TOTP)
- **Interfaz moderna** con Next.js 15 y Tailwind CSS
- **Base de datos** PostgreSQL con estructura completamente en español
- **Multiempresa** con control de acceso por empresa (RLS)
- **Contenedorización** completa con Docker
- **Hot reload** para desarrollo ágil
- **Tests automatizados** con pytest

## 🗄️ Estructura de Base de Datos

El sistema utiliza una base de datos normalizada completamente en español:

### Tablas Principales
- **`usuarios`** - Cuentas de usuario con autenticación
- **`empresas`** - Información de empresas y branding
- **`roles`** - Roles y permisos del sistema
- **`usuario_perfiles`** - Datos personales de usuarios
- **`usuario_contactos`** - Información de contacto
- **`usuario_direcciones`** - Direcciones de usuarios
- **`usuario_2fa`** - Configuración de autenticación de doble factor
- **`menus`** - Estructura de navegación del sistema
- **`accesos`** - Log de accesos al sistema

### Características
- **UUIDs** como identificadores únicos
- **Row Level Security (RLS)** para control de acceso por empresa
- **Estructura multiempresa** con soporte para usuarios que trabajan en múltiples empresas
- **Auditoría** con timestamps de creación y actualización
- **Soft delete** para eliminación lógica de registros

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit tus cambios (`git commit -m 'feat: agregar nueva característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abre un Pull Request

Para más detalles sobre el proceso de contribución, consulta [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📄 Licencia

Este proyecto es privado y confidencial.

## 👥 Equipo

Desarrollado por **Asicom Software** para Aslin 2.0

## 🖥️ Características ideales del servidor dedicado

Recomendaciones para montar **ASLIN 2.0** en un servidor dedicado en producción.

### Requisitos mínimos recomendados

| Recurso   | Mínimo   | Recomendado (producción) |
|----------|----------|----------------------------|
| **CPU**  | 2 núcleos | 4 núcleos o más            |
| **RAM**  | 4 GB     | 8 GB (16 GB si muchos PDFs/concurrentes) |
| **Disco**| 40 GB SSD | 80–100 GB SSD (datos + logs + backups) |
| **Red**  | 100 Mbps | 1 Gbps simétrico           |

### Sistema operativo

- **Recomendado:** **Ubuntu Server 22.04 LTS** (o 24.04 LTS).
- Alternativas: Debian 12, Rocky Linux 9, AlmaLinux 9.
- Evitar Windows como host si se usa Docker (más consumo y complejidad).

### Software base en el servidor

- **Docker** 24.x y **Docker Compose** v2.x (para orquestar backend, frontend y PostgreSQL).
- **PostgreSQL 15** (en contenedor o nativo; el stack actual usa contenedor).
- **Nginx** (o Caddy) como reverse proxy delante de frontend y backend: SSL, dominio, compresión.
- **Certificado SSL**: Let's Encrypt (certbot) o certificado comercial.

### Consideraciones por componente

- **PostgreSQL:** Reservar al menos 1–2 GB RAM para el contenedor/instancia; disco en SSD para datos y WAL.
- **Backend (FastAPI + WeasyPrint):** Generación de PDFs es costosa en CPU y RAM; con muchos PDFs simultáneos, 4 núcleos y 8 GB RAM ayudan a evitar cuellos de botella.
- **Frontend (Next.js):** En producción conviene build estático (`next build` + `next start` o servido por Nginx) para reducir uso de RAM y CPU.
- **Celery + Redis** (si se usan tareas en background): Añadir ~512 MB–1 GB RAM para Redis y 1 worker Celery; ajustar según cola de tareas.

### Seguridad y operación

- **Firewall:** Solo puertos 80, 443 y 22 (SSH) abiertos; resto filtrado.
- **SSH:** Claves en lugar de contraseña; usuario no root.
- **Backups:** Copias automáticas diarias de la base PostgreSQL y, si aplica, de volúmenes Docker (uploads, datos persistentes).
- **Actualizaciones:** Parches de seguridad del SO y de las imágenes Docker de forma periódica.
- **Variables de entorno:** `.env` con secretos (JWT, BD, SMTP); nunca en el repositorio.
- **Dominio:** Apuntar el DNS al servidor y configurar Nginx/Caddy con el nombre del sistema (ej. `app.aslin.com`).

### Resumen rápido

- **Entorno pequeño (pocos usuarios, pocos PDFs):** 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 22.04, Docker + Nginx + SSL.
- **Producción estable (varios usuarios, reportes y PDFs frecuentes):** 4 vCPU, 8 GB RAM, 80–100 GB SSD, Ubuntu 22.04 LTS, reverse proxy con SSL, backups automáticos y monitoreo básico (logs, health checks).

---

## 🔗 Enlaces Útiles

- **Repositorio**: https://github.com/AsicomSoftware/aslinmx-v2.git
- **API Docs**: http://localhost:8000/docs (cuando esté ejecutándose)
- **Health Check**: http://localhost:8000/health

---

**¿Necesitas ayuda?** Revisa la documentación en `docs/` o contacta al equipo de desarrollo.

