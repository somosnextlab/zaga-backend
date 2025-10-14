# Arquitectura de Tablas de Usuarios - Zaga

## 📋 **Resumen Ejecutivo**

El sistema de usuarios de Zaga está diseñado con una arquitectura modular que separa las responsabilidades de **autenticación externa** (Supabase), **datos personales** y **relación comercial**. Esta separación garantiza seguridad, flexibilidad y cumplimiento legal.

## 🏗️ **Arquitectura General**

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  Supabase Auth      │    │  seguridad.usuarios │◄──►│ financiera.personas │◄──►│ financiera.clientes │
│  (Autenticación)    │    │   (Control Local)   │    │  (Datos Personales) │    │ (Relación Comercial)│
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### **Relaciones:**

- **1:1** `seguridad.usuarios` ↔ `financiera.personas`
- **1:1** `financiera.personas` ↔ `financiera.clientes`
- **Supabase Auth** → `seguridad.usuarios` (user_id)

## 📊 **Descripción Detallada de Tablas**

### **1. `seguridad.usuarios` - Control Local de Usuarios**

**Propósito:** Gestionar el control local de usuarios, roles y estado de acceso al sistema.

```sql
CREATE TABLE seguridad.usuarios (
  user_id UUID PRIMARY KEY,           -- Identificador único del usuario (de Supabase)
  persona_id UUID UNIQUE,             -- FK a financiera.personas
  rol VARCHAR(20) NOT NULL,           -- 'admin' | 'cliente'
  estado VARCHAR(20) NOT NULL,        -- 'activo' | 'inactivo'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Responsabilidades:**

- ✅ **Control local** - Gestión de roles y estado
- ✅ **Autorización** - Qué permisos tiene (admin/cliente)
- ✅ **Estado de cuenta** - Activo/inactivo
- ✅ **Integración con Supabase** - user_id de Supabase Auth
- ✅ **Auditoría** - Registro de creación y modificaciones

**Campos Clave:**

- `user_id`: Identificador único de Supabase Auth
- `persona_id`: Enlace a datos personales
- `rol`: Determina permisos en el sistema
- `estado`: Control de acceso (activo/inactivo)

---

### **2. `financiera.personas` - Datos Personales**

**Propósito:** Almacenar información personal y legal de los usuarios.

```sql
CREATE TABLE financiera.personas (
  id UUID PRIMARY KEY,                -- Identificador único de la persona
  tipo_doc VARCHAR(20) NOT NULL,      -- 'DNI' | 'PASAPORTE' | 'CUIL'
  numero_doc VARCHAR(20) NOT NULL,    -- Número de documento
  nombre VARCHAR(100) NOT NULL,       -- Nombre de pila
  apellido VARCHAR(100) NOT NULL,     -- Apellido
  email VARCHAR(255) UNIQUE NOT NULL, -- Email de contacto
  telefono VARCHAR(20),               -- Teléfono de contacto
  fecha_nac DATE,                     -- Fecha de nacimiento
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tipo_doc, numero_doc)        -- DNI único por tipo
);
```

**Responsabilidades:**

- ✅ **Identidad legal** - Datos del documento de identidad
- ✅ **Información personal** - Nombre, apellido, fecha nacimiento
- ✅ **Datos de contacto** - Email y teléfono
- ✅ **Cumplimiento legal** - Datos requeridos por regulaciones argentinas
- ✅ **Validación de identidad** - Verificación de datos únicos

**Campos Clave:**

- `tipo_doc + numero_doc`: Identificación legal única
- `email`: Contacto principal (único)
- `nombre + apellido`: Identidad personal

---

### **3. `financiera.clientes` - Relación Comercial**

**Propósito:** Gestionar la relación comercial entre la empresa y los usuarios.

```sql
CREATE TABLE financiera.clientes (
  id UUID PRIMARY KEY,                -- Identificador único del cliente
  persona_id UUID UNIQUE NOT NULL,    -- FK a financiera.personas
  estado VARCHAR(20) NOT NULL,        -- 'activo' | 'inactivo' | 'suspendido'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Responsabilidades:**

- ✅ **Relación comercial** - Estado de cliente con la empresa
- ✅ **Control de acceso** - Quién puede solicitar préstamos
- ✅ **Estado comercial** - Activo, inactivo, suspendido
- ✅ **Auditoría comercial** - Registro de cambios de estado

**Campos Clave:**

- `persona_id`: Enlace a datos personales
- `estado`: Estado comercial del cliente

## 🔄 **Flujo de Creación de Usuario**

### **1. Registro en Supabase Auth**

- Usuario se registra en frontend con Supabase
- Supabase envía email de verificación
- Usuario verifica email haciendo click en link

### **2. Creación de Perfil en Backend**

- Frontend obtiene JWT con `email_verified: true`
- Backend valida JWT con Supabase JWKS
- Se crea registro en `seguridad.usuarios`
- Se crea registro en `financiera.personas`
- Se crea registro en `financiera.clientes` (inmediatamente)

### **3. Usuario Operativo**

- Usuario puede usar la plataforma inmediatamente
- No requiere verificación adicional
- Cliente creado automáticamente

## 🛡️ **Seguridad y Validaciones**

### **Validaciones de Negocio**

- ✅ **DNI único** - No se puede duplicar documento
- ✅ **Email único** - No se puede duplicar email
- ✅ **Edad mínima** - 18 años para operar
- ✅ **Teléfono argentino** - Formato +549XXXXXXXX
- ✅ **Un perfil por usuario** - Prevención de duplicados

### **Seguridad de Datos**

- ✅ **Autenticación externa** - Supabase maneja login/registro
- ✅ **JWT con JWKS** - Validación robusta de tokens
- ✅ **RLS automático** - Row Level Security con Supabase
- ✅ **Email verificado** - Solo usuarios verificados pueden crear perfil

## 📈 **Estados del Usuario**

| Estado              | Supabase Auth     | seguridad.usuarios | financiera.personas    | financiera.clientes | Puede Operar |
| ------------------- | ----------------- | ------------------ | ---------------------- | ------------------- | ------------ |
| **Registrado**      | ✅ email_verified | ❌                 | ❌                     | ❌                  | ❌           |
| **Perfil Básico**   | ✅                | ✅                 | ✅ (nombre, DNI)       | ✅                  | ✅           |
| **Perfil Completo** | ✅                | ✅                 | ✅ (+ fecha_nac, docs) | ✅                  | ✅           |

## 🔧 **Configuración Requerida**

### **Variables de Entorno:**

```env
# Supabase (REQUERIDO)
SUPABASE_PROJECT_URL=https://<project-id>.supabase.co
SUPABASE_JWKS_URL=https://<project-id>.supabase.co/auth/v1/keys
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Base de datos
DATABASE_URL=postgresql://...
```

### **Configuración de Supabase:**

1. **Habilitar email verification** en Authentication settings
2. **Configurar redirect URLs** para verificación
3. **Configurar JWT settings** con expiración apropiada

## 📊 **Beneficios de la Arquitectura**

### **1. Simplicidad**

- ✅ Un solo sistema de autenticación (Supabase)
- ✅ Flujo más directo y comprensible
- ✅ Menos código que mantener

### **2. Seguridad**

- ✅ Verificación robusta por Supabase
- ✅ JWT con JWKS para validación
- ✅ No duplicación de lógica de autenticación

### **3. Escalabilidad**

- ✅ Supabase maneja la escalabilidad de auth
- ✅ Backend se enfoca en lógica de negocio
- ✅ Fácil integración con otros servicios

### **4. Mantenibilidad**

- ✅ Menos servicios que mantener
- ✅ Lógica de auth centralizada
- ✅ Fácil testing y debugging

---

**Documento actualizado:** 2025-01-10  
**Versión:** 2.0  
**Autor:** Sistema Zaga - NextLab
