# Configuración de Base de Datos - Zaga

## 📋 **Resumen**

Configuración de PostgreSQL con Prisma ORM, incluyendo esquemas, migraciones y datos de prueba para el sistema de préstamos Zaga.

## 🗄️ **Base de Datos**

### **PostgreSQL 14+**
- **Host**: Railway PostgreSQL (producción)
- **Local**: Docker PostgreSQL (desarrollo)
- **Pool**: 13 conexiones máximo
- **SSL**: Habilitado en producción

### **Esquemas**
- `seguridad` - Control de acceso y usuarios
- `financiera` - Datos comerciales y préstamos

## 🏗️ **Estructura de Tablas**

### **Seguridad**
```sql
seguridad.usuarios
├── user_id (UUID, PK) - ID de Supabase
├── persona_id (UUID, FK) - Referencia a personas
├── rol (VARCHAR) - admin | usuario | cliente
├── estado (VARCHAR) - activo | inactivo
└── timestamps
```

### **Financiera**
```sql
financiera.personas
├── id (UUID, PK)
├── tipo_doc (VARCHAR) - DNI | PASAPORTE | CUIL
├── numero_doc (VARCHAR) - Número de documento
├── nombre, apellido (VARCHAR)
├── email, telefono (VARCHAR)
├── fecha_nac (DATE)
└── timestamps

financiera.clientes
├── id (UUID, PK)
├── persona_id (UUID, FK) - Referencia a personas
├── estado (VARCHAR) - activo | inactivo | suspendido
└── timestamps
```

## 🔧 **Configuración Prisma**

### **Schema Principal**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### **Variables de Entorno**
```env
# Producción
DATABASE_URL=postgresql://user:pass@host:port/db?pgbouncer=true&connection_limit=1

# Desarrollo
DATABASE_URL=postgresql://postgres:password@localhost:5432/zaga_dev
```

## 🚀 **Comandos de Base de Datos**

### **Desarrollo**
```bash
# Generar cliente Prisma
npm run prisma:generate

# Aplicar cambios al schema
npm run prisma:push

# Abrir Prisma Studio
npm run prisma:studio

# Reset de base de datos
npm run prisma:reset
```

### **Producción**
```bash
# Generar cliente
npx prisma generate

# Aplicar migraciones
npx prisma db push
```

## 📊 **Datos de Prueba**

### **Usuario Admin**
```sql
INSERT INTO seguridad.usuarios VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '8ca53b02-86a4-4aeb-be9f-21b8692d7504',
  'admin',
  'activo',
  NOW(),
  NOW()
);
```

### **Persona de Prueba**
```sql
INSERT INTO financiera.personas VALUES (
  '8ca53b02-86a4-4aeb-be9f-21b8692d7504',
  'DNI',
  '12345678',
  'Juan',
  'Pérez',
  'admin@zaga.com',
  '+54911234567',
  '1990-01-01',
  NOW(),
  NOW()
);
```

## 🛡️ **Seguridad**

### **Row Level Security (RLS)**
- **Habilitado** en todas las tablas
- **Políticas** basadas en JWT de Supabase
- **Acceso** controlado por roles

### **Índices**
```sql
-- Índices únicos
CREATE UNIQUE INDEX ON financiera.personas (tipo_doc, numero_doc);
CREATE UNIQUE INDEX ON financiera.personas (email);
CREATE UNIQUE INDEX ON seguridad.usuarios (persona_id);
```

### **Validaciones**
- ✅ **DNI único** por tipo de documento
- ✅ **Email único** en personas
- ✅ **Un perfil por usuario** en seguridad
- ✅ **Edad mínima** 18 años para clientes

## 🔍 **Monitoreo**

### **Logs de Prisma**
```env
# Desarrollo
DATABASE_URL="postgresql://..."
LOG_LEVEL="query"

# Producción
DATABASE_URL="postgresql://..."
LOG_LEVEL="error"
```

### **Métricas**
- **Conexiones activas**: Monitoreadas
- **Tiempo de consulta**: Logged en desarrollo
- **Errores de conexión**: Capturados

## 🚨 **Troubleshooting**

### **Problemas Comunes**

#### **Error de Conexión**
```bash
# Verificar variables
echo $DATABASE_URL

# Probar conexión
npx prisma db pull --print
```

#### **Schema Desactualizado**
```bash
# Sincronizar schema
npx prisma db push

# Regenerar cliente
npx prisma generate
```

#### **Datos Inconsistentes**
```bash
# Reset completo
npx prisma migrate reset

# Aplicar migraciones
npx prisma migrate deploy
```

## 📈 **Rendimiento**

### **Optimizaciones**
- ✅ **Pool de conexiones** configurado
- ✅ **Índices únicos** en campos críticos
- ✅ **Consultas paginadas** para listados
- ✅ **Relaciones eficientes** entre tablas

### **Métricas Objetivo**
- **Tiempo de respuesta**: < 100ms
- **Conexiones concurrentes**: 13 máximo
- **Disponibilidad**: 99.9%

---

**Documento actualizado:** 2025-01-15  
**Versión:** 3.0  
**Autor:** Sistema Zaga - NextLab