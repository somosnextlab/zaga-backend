# Zaga Backend API

API REST para el sistema de préstamos Zaga, desarrollada con NestJS y PostgreSQL.

## 🚀 **Inicio Rápido**

### **Prerrequisitos**
- Node.js 18+
- PostgreSQL 14+
- Supabase account

### **Instalación**
```bash
npm install
cp env.example .env
# Configurar variables de entorno
npm run build
npm run start:dev
```

### **Variables de Entorno**
```env
DATABASE_URL=postgresql://user:pass@host:port/db
SUPABASE_PROJECT_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🏗️ **Arquitectura**

### **Roles del Sistema**
- **`admin`**: Gestión completa del sistema
- **`usuario`**: Usuario registrado con perfil básico
- **`cliente`**: Usuario con datos completos para préstamos

### **Flujo de Usuario**
```
Registro → usuario → Carga datos → cliente
```

### **Tablas Principales**
- `seguridad.usuarios` - Control de acceso y roles
- `financiera.personas` - Datos personales
- `financiera.clientes` - Relación comercial

## 📋 **Endpoints Principales**

### **Autenticación**
- `POST /auth/login` - Login con email/password
- `GET /auth/health` - Estado del servicio

### **Usuarios**
- `GET /usuarios` - Lista usuarios (admin)
- `GET /usuarios/:id` - Usuario específico (admin, usuario)
- `POST /usuarios/registro-inicial` - Registro inicial (usuario)
- `POST /usuarios/crear-perfil` - Crear perfil completo (usuario)
- `DELETE /usuarios/:id` - Desactivar usuario (admin, usuario)

### **Clientes**
- `GET /clientes` - Lista clientes (admin, cliente)
- `GET /clientes/:id` - Cliente específico (admin, cliente)
- `DELETE /clientes/:id` - Desactivar cliente (admin)

## 🔧 **Comandos**

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod

# Base de datos
npm run prisma:generate
npm run prisma:push
npm run prisma:studio

# Testing
npm run test
npm run test:e2e
```

## 🛡️ **Seguridad**

- **Autenticación**: Supabase Auth con JWT
- **Autorización**: Roles granulares (admin/usuario/cliente)
- **Validación**: DTOs con class-validator
- **Base de datos**: Row Level Security (RLS)

## 📊 **Swagger**

Documentación interactiva disponible en:
```
http://localhost:3000/api
```

## 🚀 **Despliegue**

### **Railway**
1. Conectar repositorio GitHub
2. Configurar variables de entorno
3. Deploy automático en push

### **Variables de Producción**
- `NODE_ENV=production`
- `DATABASE_URL` (Railway PostgreSQL)
- Variables de Supabase configuradas

## 📝 **Desarrollo**

### **Estructura del Proyecto**
```
src/
├── config/          # Configuración de auth y roles
├── modules/         # Módulos de la aplicación
│   ├── auth/        # Autenticación
│   ├── usuarios/    # Gestión de usuarios
│   └── clientes/    # Gestión de clientes
└── shared/          # Servicios compartidos
```

### **Principios de Desarrollo**
- **SOLID**: Principios de diseño orientado a objetos
- **KISS**: Mantener simplicidad
- **DRY**: No repetir código
- **TypeScript**: Tipado estricto

## 🔗 **Enlaces Útiles**

- [Documentación NestJS](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

---

**Desarrollado por NextLab** | **Versión 2.0** | **2025**