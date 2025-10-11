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

- **admin**: Acceso completo al sistema
- **cliente**: Solo sus propios datos (RLS aplicado)

> **Nota**: Se simplificó el sistema de roles eliminando `analista` y `cobranzas` para mayor simplicidad y mantenibilidad.

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

### Usuarios (RLS) - **MEJORADO** 🔥

- `GET /usuarios` - Listar usuarios paginados (admin)
- `GET /usuarios/yo` - Mi perfil (admin, cliente)
- `GET /usuarios/:id` - Usuario específico (admin)
- `PUT /usuarios/yo` - Actualizar mi perfil (admin, cliente)
- `DELETE /usuarios/:id` - Desactivar usuario (admin)
- `POST /usuarios/crear-perfil` - Crear perfil con verificación de email
- `POST /usuarios/verificar-email` - Verificar email con token
- `POST /usuarios/reenviar-verificacion` - Reenviar verificación
- `PUT /usuarios/:id/cambiar-email` - Cambiar email (admin)

### Verificación de Identidad

- `POST /verificacion-identidad/:personaId/documentos` - Subir documento
- `GET /verificacion-identidad/:personaId/documentos` - Listar documentos

### Fuentes Externas

- `GET /bcra/:personaId/situacion` - Consultar BCRA (admin, staff)

## ⚙️ Funcionalidades por Rol

### Clientes

- ✅ Crear y actualizar su perfil personal
- ✅ Verificar su email de registro
- ✅ Crear solicitudes de préstamo
- ✅ Ver sus propias solicitudes y préstamos
- ✅ Subir documentos de identidad
- ✅ Agregar garantes a sus solicitudes

### Administradores

- ✅ Acceso completo a todos los módulos
- ✅ Gestión completa de usuarios (listar, ver, desactivar)
- ✅ Cambiar emails de usuarios (con verificación)
- ✅ Auditoría completa del sistema
- ✅ Gestión de solicitudes y evaluaciones
- ✅ Consultar fuentes externas (BCRA)

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

### Sistema de Verificación de Email 🔐

- **Verificación obligatoria** de email al crear perfil
- **Tokens seguros** con expiración de 24 horas
- **Email no modificable** por usuarios (solo admins)
- **Reenvío de verificación** para emails no verificados
- **Auditoría completa** de cambios de email

### Validaciones Robustas ✅

- **Edad mínima**: 18 años para préstamos
- **Teléfono argentino**: Formato +549XXXXXXXX
- **Documentos únicos**: Prevención de duplicados
- **Validación automática**: DTOs con class-validator
- **Transformación de datos**: Automática con ValidationPipe

### Auditoría

- **Registro completo** de todas las acciones
- **Metadatos**: Usuario, IP, User-Agent, timestamp
- **Trazabilidad** en entidades críticas
- **Soft delete**: Mantiene historial de usuarios

## 🚀 Mejoras Recientes (v2.0)

### Sistema de Usuarios Completamente Renovado

- ✅ **Paginación inteligente** en listado de usuarios
- ✅ **Validaciones robustas** con class-validator
- ✅ **Sistema de verificación de email** con tokens seguros
- ✅ **Soft delete** para mantener historial
- ✅ **Validaciones específicas para Argentina** (teléfono, edad)
- ✅ **Endpoints RESTful** completos (CRUD)

### Seguridad Mejorada

- ✅ **Email no modificable** por usuarios regulares
- ✅ **Verificación obligatoria** de email
- ✅ **Tokens criptográficos** con expiración
- ✅ **Prevención de duplicados** en documentos
- ✅ **Validación de edad mínima** (18 años)

### Arquitectura Optimizada

- ✅ **ValidationPipe global** para validación automática
- ✅ **DTOs tipados** con documentación Swagger
- ✅ **Servicios modulares** para mejor mantenibilidad
- ✅ **Manejo de errores** consistente con códigos HTTP apropiados

## 📚 Documentación

### **Documentos Principales:**
- [`ARQUITECTURA_TABLAS_USUARIOS.md`](docs/ARQUITECTURA_TABLAS_USUARIOS.md) - Arquitectura completa del sistema de usuarios
- [`FLUJO_VERIFICACION_EMAIL.md`](docs/FLUJO_VERIFICACION_EMAIL.md) - **NUEVO** - Flujo seguro de verificación de email
- [`REGLAS_SISTEMA_USUARIOS.md`](docs/REGLAS_SISTEMA_USUARIOS.md) - Reglas y validaciones del sistema
- [`CONFIGURACION_BASE_DATOS.md`](docs/CONFIGURACION_BASE_DATOS.md) - Configuración de base de datos
- [`MIGRACION_EMAIL_PRODUCCION.md`](docs/MIGRACION_EMAIL_PRODUCCION.md) - Migración a producción

### **Scripts de Utilidad:**
```bash
# Verificar configuración de SendGrid
node scripts/check-sendgrid-config.js

# Probar nuevo flujo de verificación
node scripts/test-new-user-flow.js

# Limpiar datos de prueba
node scripts/cleanup-test-data.js

# Limpiar todo el sistema
node scripts/cleanup-all-users.js
```

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
