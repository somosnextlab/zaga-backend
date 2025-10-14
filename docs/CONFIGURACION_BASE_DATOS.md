# 🗄️ Configuración de Base de Datos - Zaga Backend

## ✅ **Estado: Base de Datos Sincronizada Correctamente**

### **📊 Esquemas Creados**

#### **🔐 Esquema `seguridad`**

- **Propósito**: Gestión de usuarios y autenticación
- **Tablas**: 1 tabla
  - `usuarios` - Usuarios del sistema con roles

#### **💰 Esquema `financiera`**

- **Propósito**: Gestión de datos financieros y de préstamos
- **Tablas**: 12 tablas
  - `personas` - Datos personales
  - `clientes` - Clientes del sistema
  - `garantes` - Garantes de préstamos
  - `solicitudes` - Solicitudes de préstamos
  - `solicitud_garantes` - Relación solicitudes-garantes
  - `documentos_identidad` - Documentos de identidad
  - `evaluaciones` - Evaluaciones crediticias
  - `prestamos` - Préstamos aprobados
  - `cronogramas` - Cronogramas de pago
  - `pagos` - Pagos realizados
  - `fuentes_externas` - Fuentes de datos externas
  - `auditoria` - Log de auditoría

### **🔗 Estructura de Relaciones**

#### **Tablas Principales para Fase 1**

##### **1. `seguridad.usuarios`**

```sql
user_id     UUID PRIMARY KEY    -- ID del usuario en Supabase
persona_id  UUID NULL           -- Referencia a financiera.personas
rol         VARCHAR DEFAULT 'cliente'  -- admin o cliente
estado      VARCHAR DEFAULT 'activo'   -- activo/inactivo
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()
```

##### **2. `financiera.personas`**

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
tipo_doc    VARCHAR NOT NULL           -- DNI, CUIL, etc.
numero_doc  VARCHAR NOT NULL           -- Número de documento
nombre      VARCHAR NOT NULL           -- Nombre
apellido    VARCHAR NOT NULL           -- Apellido
email       VARCHAR NULL               -- Email
telefono    VARCHAR NULL               -- Teléfono
fecha_nac   DATE NULL                  -- Fecha de nacimiento
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()

UNIQUE(tipo_doc, numero_doc)           -- DNI único por tipo
```

##### **3. `financiera.clientes`**

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
persona_id  UUID NOT NULL              -- Referencia a financiera.personas
estado      VARCHAR DEFAULT 'activo'   -- activo/inactivo/suspendido
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()

FOREIGN KEY (persona_id) REFERENCES financiera.personas(id)
```

## 🔄 **Flujo de Datos Actualizado**

### **1. Registro de Usuario**

1. **Usuario se registra** en Supabase Auth
2. **Supabase envía** email de verificación
3. **Usuario verifica** email en Supabase
4. **Frontend obtiene** JWT con `email_verified: true`

### **2. Creación de Perfil**

1. **Backend valida** JWT con Supabase JWKS
2. **Se crea usuario** en `seguridad.usuarios`
3. **Se crea persona** en `financiera.personas`
4. **Se crea cliente** en `financiera.clientes` (automáticamente)

### **3. Usuario Operativo**

- **Usuario puede operar** inmediatamente
- **No requiere verificación** adicional
- **Cliente creado** automáticamente

## 🛡️ **Seguridad Implementada**

### **Row Level Security (RLS)**

- ✅ **Políticas activas** en todas las tablas
- ✅ **Acceso basado en JWT** de Supabase
- ✅ **Prevención de escalación** de privilegios
- ✅ **Aislamiento de datos** por usuario

### **Validaciones de Negocio**

- ✅ **DNI único** por tipo de documento
- ✅ **Email único** en el sistema
- ✅ **Edad mínima** de 18 años
- ✅ **Teléfono argentino** válido

## 📊 **Estado Actual de la Base de Datos**

### **Tablas Limpias**

- ✅ **Sin campos obsoletos** (`email_verificado`, `email_verificado_at`)
- ✅ **Sin tablas obsoletas** (`tokens_verificacion`)
- ✅ **Schema sincronizado** con Prisma
- ✅ **Relaciones optimizadas**

### **Datos de Prueba**

- ✅ **Usuario de desarrollo** creado
- ✅ **Perfil completo** con datos válidos
- ✅ **Cliente activo** listo para operar
- ✅ **Datos consistentes** entre tablas

## 🔧 **Configuración Requerida**

### **Variables de Entorno**

```env
# Base de datos
DATABASE_URL=postgresql://user:password@host:port/database

# Supabase
SUPABASE_PROJECT_URL=https://<project-id>.supabase.co
SUPABASE_JWKS_URL=https://<project-id>.supabase.co/auth/v1/keys
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### **Configuración de Supabase**

1. **Habilitar email verification** en Authentication settings
2. **Configurar redirect URLs** para verificación
3. **Configurar JWT settings** con expiración apropiada
4. **Crear usuario admin** manualmente en Dashboard

## 🚀 **Comandos de Mantenimiento**

### **Generar Cliente Prisma**

```bash
npx prisma generate
```

### **Sincronizar Schema**

```bash
npx prisma db push
```

### **Verificar Conexión**

```bash
npm run verify:db
```

### **Abrir Prisma Studio**

```bash
npm run prisma:studio
```

## 📈 **Métricas de Rendimiento**

### **Conexiones**

- ✅ **Pool de conexiones** configurado (13 conexiones)
- ✅ **Conexión estable** verificada
- ✅ **Latencia baja** en consultas

### **Consultas Optimizadas**

- ✅ **Índices únicos** en campos críticos
- ✅ **Relaciones eficientes** entre tablas
- ✅ **Consultas paginadas** para listados

## 🔍 **Monitoreo y Logs**

### **Logs de Prisma**

- ✅ **Consultas SQL** registradas en desarrollo
- ✅ **Tiempo de ejecución** monitoreado
- ✅ **Errores de conexión** capturados

### **Logs de Aplicación**

- ✅ **Creación de usuarios** registrada
- ✅ **Errores de validación** capturados
- ✅ **Operaciones de base de datos** auditadas

## 🚨 **Troubleshooting**

### **Problemas Comunes**

#### **Error de Conexión**

```bash
# Verificar variables de entorno
echo $DATABASE_URL

# Probar conexión
npx prisma db pull --print
```

#### **Schema Desincronizado**

```bash
# Regenerar cliente
npx prisma generate

# Sincronizar schema
npx prisma db push
```

#### **Error de RLS**

```bash
# Verificar políticas
npm run verify:rls
```

## 📚 **Documentación Relacionada**

- [`FLUJO_AUTENTICACION_SUPABASE.md`](FLUJO_AUTENTICACION_SUPABASE.md) - Flujo de autenticación
- [`ARQUITECTURA_TABLAS_USUARIOS.md`](ARQUITECTURA_TABLAS_USUARIOS.md) - Arquitectura de usuarios
- [`REGLAS_SISTEMA_USUARIOS.md`](REGLAS_SISTEMA_USUARIOS.md) - Reglas del sistema

---

**Documento actualizado:** 2025-01-10  
**Versión:** 2.0  
**Autor:** Sistema Zaga - NextLab
