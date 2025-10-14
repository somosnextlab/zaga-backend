# Zaga Backend

Backend API para el sistema de gestión de préstamos Zaga, construido con NestJS, TypeScript y Prisma.

## 🚀 Stack Tecnológico

- **NestJS 10** + **TypeScript** + **Prisma ORM**
- **PostgreSQL** (Supabase) + **Redis** + **BullMQ**
- **Autenticación Supabase Auth** con **JWT** y **RLS (Row Level Security)**
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
SUPABASE_PROJECT_URL=https://<project-id>.supabase.co
SUPABASE_JWKS_URL=https://<project-id>.supabase.co/auth/v1/keys
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 📚 API Documentation

- **Swagger UI**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/salud

## 🔐 Autenticación con Supabase

### Flujo de Autenticación Simplificado

1. **Usuario se registra** en frontend con Supabase Auth (`signUp()`)
2. **Supabase envía email** de verificación automáticamente
3. **Usuario verifica email** haciendo click en link de Supabase
4. **Frontend obtiene JWT** con `email_verified: true`
5. **Backend valida JWT** con JWKS y crea perfil del usuario
6. **Usuario puede operar** inmediatamente (cliente creado automáticamente)

### Roles Disponibles

- **admin**: Creado manualmente en Supabase Dashboard
- **cliente**: Se registra mediante la app (Supabase Auth)

## 🏗️ Arquitectura

### Módulos Principales

- **`usuarios/`** - Gestión de usuarios y perfiles
- **`salud/`** - Health checks del sistema
- **`financiera/`** - Módulos financieros (próximamente)

### Servicios Compartidos

- **PrismaService** - ORM global
- **Logger** - Sistema de logging
- **SupabaseJwtGuard** - Validación JWT con Supabase

## 🔄 Endpoints Principales

### Salud

- `GET /salud` - Estado de la aplicación

### Usuarios

- `GET /usuarios` - Listar usuarios paginados (admin)
- `GET /usuarios/yo` - Mi perfil (admin, cliente)
- `PUT /usuarios/yo` - Actualizar mi perfil (admin, cliente)
- `POST /usuarios/crear-perfil` - Crear perfil (cliente autenticado)
- `GET /usuarios/:id` - Usuario específico (admin)
- `DELETE /usuarios/:id` - Desactivar usuario (admin)
- `PUT /usuarios/:id/cambiar-email` - Cambiar email (admin)

## ⚙️ Funcionalidades por Rol

### Clientes

- ✅ Crear perfil personal (una sola vez)
- ✅ Actualizar datos personales
- ✅ Ver su perfil completo
- ✅ Email verificado automáticamente por Supabase

### Administradores

- ✅ Acceso completo a todos los módulos
- ✅ Gestión completa de usuarios
- ✅ Cambiar emails de usuarios (requiere actualización manual en Supabase)

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

# Producción
npm run build         # Compilar TypeScript
npm run start         # Ejecutar compilado

# Base de datos
npm run prisma:generate    # Generar cliente Prisma
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

### Autenticación con Supabase

- **JWT con JWKS** para validación robusta
- **Email verificado** antes de crear perfil
- **RLS automático** basado en JWT
- **Tokens seguros** con expiración

### Validaciones Robustas

- **Edad mínima**: 18 años para préstamos
- **Teléfono argentino**: Formato +549XXXXXXXX
- **Documentos únicos**: Prevención de duplicados
- **Validación automática**: DTOs con class-validator

### Auditoría

- **Registro completo** de todas las acciones
- **Metadatos**: Usuario, IP, User-Agent, timestamp
- **Soft delete**: Mantiene historial de usuarios

## 🚀 Mejoras Recientes (v2.0)

### Sistema de Autenticación Renovado

- ✅ **Integración completa con Supabase Auth**
- ✅ **Eliminación de verificación de email propia**
- ✅ **Flujo simplificado** de registro y login
- ✅ **Cliente creado automáticamente** tras verificación

### Arquitectura Optimizada

- ✅ **Código más limpio** sin servicios obsoletos
- ✅ **Menor superficie de ataque**
- ✅ **Mejor rendimiento** con menos dependencias
- ✅ **Mantenimiento simplificado**

## 📚 Documentación

### Documentos Principales:

- [`FLUJO_AUTENTICACION_SUPABASE.md`](docs/FLUJO_AUTENTICACION_SUPABASE.md) - Flujo completo de autenticación
- [`ARQUITECTURA_TABLAS_USUARIOS.md`](docs/ARQUITECTURA_TABLAS_USUARIOS.md) - Arquitectura del sistema de usuarios
- [`REGLAS_SISTEMA_USUARIOS.md`](docs/REGLAS_SISTEMA_USUARIOS.md) - Reglas y validaciones
- [`CONFIGURACION_BASE_DATOS.md`](docs/CONFIGURACION_BASE_DATOS.md) - Configuración de base de datos

## 📈 Escalabilidad

- **Arquitectura modular** para fácil mantenimiento
- **Autenticación externa** con Supabase
- **Logging estructurado** para monitoreo
- **Base de datos optimizada** sin campos obsoletos

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Estándares

- Sigue los principios **SOLID**
- Usa **TypeScript** con tipado estricto
- Sigue las recomendaciones de **ESLint**

## 📄 Licencia

Este proyecto es privado y confidencial.

## 🆘 Soporte

Para soporte técnico, contacta al equipo de desarrollo de NextLab.
