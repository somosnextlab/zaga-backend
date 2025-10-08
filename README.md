# Zaga Backend

Backend API para el sistema de gestión de préstamos Zaga, construido con NestJS, TypeScript y Prisma.

## 🚀 Características

- **NestJS 10** con arquitectura modular
- **TypeScript ES2022** con configuración estricta
- **Prisma** como ORM con soporte para PostgreSQL (Supabase)
- **Autenticación JWT** con Supabase y verificación JWKS
- **Sistema de roles** (admin, analista, cobranzas, cliente)
- **BullMQ** para procesamiento de colas con Redis
- **Swagger/OpenAPI** para documentación de API
- **Docker** para containerización
- **ESLint + Prettier** para calidad de código
- **Husky + lint-staged** para hooks de Git

## 📋 Requisitos

- Node.js 20+
- PostgreSQL (Supabase)
- Redis
- Docker (opcional)

## 🛠️ Instalación

### Desarrollo Local

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd zaga-backend
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp env.example .env
   ```
   
   Editar `.env` con tus valores:
   ```env
   API_PORT=3000
   NODE_ENV=development
   DATABASE_URL=postgresql://USER:PASS@HOST:PORT/dbname?pgbouncer=true&connection_limit=1
   REDIS_URL=redis://default:pass@host:port
   SUPABASE_PROJECT_URL=https://<project-id>.supabase.co
   SUPABASE_JWKS_URL=https://<project-id>.supabase.co/auth/v1/keys
   SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   BCRA_API_BASE_URL=https://api.bcra.example/v1
   BCRA_API_KEY=changeme
   ```

4. **Configurar base de datos**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Ejecutar la aplicación**
   ```bash
   npm run start:dev
   ```

### Docker

1. **Desarrollo con Docker Compose**
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

2. **Producción**
   ```bash
   docker build -t zaga-backend .
   docker run -p 3000:3000 --env-file .env zaga-backend
   ```

## 📚 API Documentation

Una vez que la aplicación esté ejecutándose, la documentación de la API estará disponible en:

- **Swagger UI**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/salud

## 🔐 Autenticación y RLS

La API utiliza **JWT tokens de Supabase** con implementación del patrón **RLS (Row Level Security) "on-behalf-of user"**.

### Cómo Funciona RLS

1. **Frontend** envía JWT en `Authorization: Bearer <token>`
2. **SupabaseJwtGuard** verifica token con JWKS
3. **SupabaseUserService** crea cliente con token del usuario
4. **Supabase RLS** aplica políticas basadas en `auth.jwt()`
5. **Usuario** solo ve datos permitidos por RLS

### Autenticación

Para autenticarse:

1. Obtén un token JWT de Supabase
2. Incluye el token en el header `Authorization: Bearer <token>`
3. El token debe contener los metadatos de usuario con `rol` y `cliente_id`

### Roles Disponibles

- **admin**: Acceso completo a todos los datos
- **analista**: Gestión de solicitudes y evaluaciones
- **cobranzas**: Gestión de pagos y cobranzas
- **cliente**: Acceso limitado a sus propios datos (RLS aplicado)

### Estructura del Token JWT

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "app_metadata": {
    "role": "cliente",
    "cliente_id": "cliente-uuid-123"
  },
  "user_metadata": {
    "rol": "cliente",
    "persona_id": "persona-uuid-456"
  }
}
```

## 🏗️ Estructura del Proyecto

```
src/
├── config/                 # Configuración y guards
│   ├── config.schema.ts
│   ├── supabase-jwt.guard.ts  # Guard RLS con JWT
│   ├── roles.decorator.ts
│   └── roles.guard.ts
├── supabase/              # Servicios Supabase RLS
│   ├── supabase-user.service.ts  # Servicio RLS por request
│   └── supabase.module.ts
├── shared/                 # Servicios compartidos
│   ├── logger.ts
│   ├── prisma.service.ts
│   ├── redis.provider.ts
│   └── audit.service.ts
├── modules/               # Módulos de negocio
│   ├── salud/
│   ├── clientes/
│   ├── garantes/
│   ├── solicitudes/       # Con RLS implementado
│   ├── evaluaciones/
│   ├── prestamos/         # Con RLS implementado
│   ├── pagos/
│   ├── usuarios/          # Nuevo: endpoint /usuarios/yo
│   ├── verificacion-identidad/
│   ├── fuentes-externas/
│   └── jobs/
├── adapters/              # Adaptadores externos
│   └── jwks.client.ts
└── main.ts
```

## 🔄 Endpoints Principales

### Salud
- `GET /salud` - Estado de la aplicación

### Clientes
- `GET /clientes` - Listar clientes
- `POST /clientes` - Crear cliente
- `GET /clientes/:id` - Obtener cliente
- `PATCH /clientes/:id` - Actualizar cliente
- `DELETE /clientes/:id` - Eliminar cliente

### Solicitudes (RLS Implementado)
- `GET /solicitudes` - Listar solicitudes (RLS: admin ve todo, cliente solo las suyas)
- `POST /solicitudes` - Crear solicitud (cliente_id extraído del JWT)
- `GET /solicitudes/:id` - Obtener solicitud
- `POST /solicitudes/:id/evaluar` - Evaluar solicitud
- `POST /solicitudes/:id/garantes` - Agregar garante
- `GET /solicitudes/:id/garantes` - Listar garantes
- `GET /solicitudes/:id/evaluaciones` - Listar evaluaciones

### Préstamos (RLS Implementado)
- `GET /prestamos` - Listar préstamos (RLS: admin ve todo, cliente solo los suyos)
- `GET /prestamos/:id` - Obtener préstamo

### Usuarios (RLS Implementado)
- `GET /usuarios/yo` - Información del usuario autenticado (RLS: solo sus datos)

### Verificación de Identidad
- `POST /verificacion-identidad/:personaId/documentos` - Subir documento
- `GET /verificacion-identidad/:personaId/documentos` - Listar documentos

### Fuentes Externas
- `GET /bcra/:personaId/situacion` - Consultar BCRA (solo admin/staff)

## 🧪 Testing

```bash
# Ejecutar tests
npm run test

# Tests en modo watch
npm run test:watch

# Coverage
npm run test:cov

# Tests e2e
npm run test:e2e
```

### Archivos de Prueba

- `test/rls.e2e-spec.ts` - Tests e2e para funcionalidad RLS
- `mock/` - Archivos de prueba y datos mock
  - `mock/README.md` - Documentación de archivos de prueba
  - `mock/test-tokens.json` - Tokens de prueba para diferentes roles
  - `mock/test-data.sql` - Datos de prueba y políticas RLS para Supabase
  - `mock/curl-examples.sh` - Ejemplos de curl para probar endpoints (Linux/Mac)
  - `mock/powershell-examples.ps1` - Ejemplos de PowerShell para probar endpoints (Windows)

## 📝 Scripts Disponibles

```bash
# Desarrollo
npm run start:dev          # Ejecutar en modo desarrollo
npm run start:debug        # Ejecutar en modo debug

# Producción
npm run build              # Compilar TypeScript
npm run start              # Ejecutar compilado
npm run start:prod         # Ejecutar en producción

# Calidad de código
npm run lint               # Ejecutar ESLint
npm run format             # Formatear con Prettier

# Base de datos
npm run prisma:generate    # Generar cliente Prisma
npm run prisma:migrate:deploy  # Aplicar migraciones
npm run prisma:studio      # Abrir Prisma Studio
```

## 🚀 Despliegue

### Railway

1. Conecta tu repositorio a Railway
2. Configura las variables de entorno
3. Railway detectará automáticamente el `Dockerfile`
4. Asegúrate de tener Redis configurado

### Variables de Entorno Requeridas

- `DATABASE_URL`: URL de conexión a PostgreSQL
- `REDIS_URL`: URL de conexión a Redis
- `SUPABASE_PROJECT_URL`: URL del proyecto Supabase
- `SUPABASE_JWKS_URL`: URL de las claves JWKS
- `SUPABASE_ANON_KEY`: Clave anónima de Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Clave de servicio de Supabase

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial.

## 🔐 Implementación RLS

Este proyecto implementa el patrón **RLS (Row Level Security) "on-behalf-of user"** con Supabase.

### Características RLS

- **Seguridad a nivel de fila** automática basada en el contexto del usuario
- **Tokens JWT** verificados con JWKS de Supabase
- **Políticas granulares** por rol y cliente
- **Cliente_id server-side** para prevenir manipulación

### Documentación RLS

- **Implementación completa**: `docs/RLS_IMPLEMENTATION.md`
- **Resumen técnico**: `IMPLEMENTACION_RLS_RESUMEN.md`
- **Archivos de prueba**: `mock/README.md`

### Endpoints con RLS

- `GET /prestamos` - Lista préstamos (RLS aplicado)
- `GET /solicitudes` - Lista solicitudes (RLS aplicado)
- `POST /solicitudes` - Crea solicitud (cliente_id del JWT)
- `GET /usuarios/yo` - Información del usuario (RLS aplicado)

## 🆘 Soporte

Para soporte técnico, contacta al equipo de desarrollo.
