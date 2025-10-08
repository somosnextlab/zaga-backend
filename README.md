# Zaga Backend

Backend API para el sistema de gestión de préstamos Zaga, construido con NestJS, TypeScript y Prisma.

## 🚀 Stack Tecnológico

- **NestJS 10** + **TypeScript** + **Prisma ORM**
- **PostgreSQL** (Supabase) + **Redis** + **BullMQ**
- **Autenticación JWT** con **RLS (Row Level Security)**
- **Swagger/OpenAPI** + **Docker** + **Railway**

## 🛠️ Instalación Rápida

```bash
# 1. Clonar e instalar
git clone <repository-url>
cd zaga-backend
npm install

# 2. Configurar variables de entorno
cp env.example .env
# Editar .env con tus valores

# 3. Configurar base de datos
npx prisma generate
npx prisma db push

# 4. Ejecutar
npm run start:dev
```

### Variables de Entorno Principales

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SUPABASE_PROJECT_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 📚 API Documentation

- **Swagger UI**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/salud

## 🔐 Autenticación

### Sistema JWT con Supabase + RLS

1. **Frontend** envía JWT en `Authorization: Bearer <token>`
2. **SupabaseJwtGuard** verifica token con JWKS
3. **RLS** aplica políticas automáticamente basadas en `auth.jwt()`

### Roles Disponibles

- **admin**: Acceso completo
- **analista**: Gestión de solicitudes y evaluaciones
- **cobranzas**: Gestión de pagos
- **cliente**: Solo sus propios datos (RLS aplicado)

## 🏗️ Arquitectura

### Módulos Principales

- **`clientes/`** - Gestión de clientes
- **`solicitudes/`** - Solicitudes de préstamos (RLS)
- **`prestamos/`** - Préstamos aprobados (RLS)
- **`pagos/`** - Gestión de pagos
- **`evaluaciones/`** - Evaluaciones crediticias
- **`usuarios/`** - Información de usuarios (RLS)
- **`verificacion-identidad/`** - Documentos de identidad
- **`fuentes-externas/`** - Integración BCRA/AFIP
- **`jobs/`** - Procesamiento asíncrono BullMQ

### Servicios Compartidos

- **PrismaService** - ORM global
- **AuditService** - Trazabilidad completa
- **Logger** - Sistema de logging con Pino
- **RedisProvider** - Cache distribuido

## 🔄 Endpoints Principales

### Salud

- `GET /salud` - Estado de la aplicación

### Clientes

- `GET /clientes` - Listar clientes (admin, analista)
- `POST /clientes` - Crear cliente (admin, analista)
- `GET /clientes/:id` - Obtener cliente (admin, analista)

### Solicitudes (RLS)

- `GET /solicitudes` - Listar solicitudes (RLS aplicado)
- `POST /solicitudes` - Crear solicitud (cliente_id del JWT)
- `POST /solicitudes/:id/evaluar` - Iniciar evaluación (admin, analista)
- `POST /solicitudes/:id/garantes` - Agregar garante

### Préstamos (RLS)

- `GET /prestamos` - Listar préstamos (RLS aplicado)
- `GET /prestamos/:id` - Obtener préstamo (RLS aplicado)

### Usuarios (RLS)

- `GET /usuarios/yo` - Información del usuario (RLS aplicado)

### Verificación de Identidad

- `POST /verificacion-identidad/:personaId/documentos` - Subir documento
- `GET /verificacion-identidad/:personaId/documentos` - Listar documentos

### Fuentes Externas

- `GET /bcra/:personaId/situacion` - Consultar BCRA (admin, staff)

## ⚙️ Funcionalidades por Rol

### Clientes

- Crear solicitudes de préstamo
- Ver sus propias solicitudes y préstamos
- Subir documentos de identidad
- Agregar garantes a sus solicitudes

### Analistas

- Gestionar solicitudes de préstamos
- Iniciar evaluaciones crediticias
- Consultar fuentes externas (BCRA)
- Ver todos los clientes y solicitudes

### Cobranzas

- Consultar pagos y préstamos
- Ver documentos de identidad
- Seguimiento de cronogramas de pago

### Administradores

- Acceso completo a todos los módulos
- Gestión de usuarios y roles
- Auditoría completa del sistema

## 🔄 Sistema de Colas (BullMQ)

### Procesamiento Asíncrono

- **Cola de evaluación**: `evaluacion`
- **Jobs**: `consulta_fuente:BCRA`, `consolidar_evaluacion`
- **Integración BCRA**: Consulta situación crediticia en background

## 🧪 Testing

```bash
npm run test          # Tests unitarios
npm run test:watch    # Tests en modo watch
npm run test:cov      # Coverage
npm run test:e2e      # Tests end-to-end
```

## 📝 Scripts Principales

```bash
# Desarrollo
npm run start:dev     # Modo desarrollo con hot reload
npm run start:debug   # Modo debug

# Producción
npm run build         # Compilar TypeScript
npm run start         # Ejecutar compilado

# Base de datos
npm run prisma:generate    # Generar cliente Prisma
npm run prisma:migrate:deploy  # Aplicar migraciones
npm run prisma:studio      # Abrir Prisma Studio

# Calidad de código
npm run lint          # ESLint con auto-fix
npm run format        # Prettier
```

## 🚀 Despliegue

### Railway (Recomendado)

1. Conecta tu repositorio a Railway
2. Configura las variables de entorno
3. Railway detectará automáticamente el `Dockerfile`

### Docker

```bash
# Desarrollo
docker-compose -f docker-compose.dev.yml up

# Producción
docker build -t zaga-backend .
docker run -p 3000:3000 --env-file .env zaga-backend
```

## 🛡️ Seguridad

### RLS (Row Level Security)

- **Seguridad a nivel de fila** automática con Supabase
- **Políticas granulares** por rol y cliente
- **Prevención de manipulación** de cliente_id (server-side)

### Auditoría

- **Registro completo** de todas las acciones
- **Metadatos**: Usuario, IP, User-Agent, timestamp
- **Trazabilidad** en entidades críticas

## 📈 Escalabilidad

- **Arquitectura modular** para fácil mantenimiento
- **Procesamiento asíncrono** con BullMQ
- **Cache distribuido** con Redis
- **Logging estructurado** para monitoreo

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Estándares

- Sigue los principios **SOLID**
- Usa **TypeScript** con tipado estricto
- Aplica **BEM** si ayuda a la claridad
- Sigue las recomendaciones de **ESLint**

## 📄 Licencia

Este proyecto es privado y confidencial.

## 🆘 Soporte

Para soporte técnico, contacta al equipo de desarrollo.
