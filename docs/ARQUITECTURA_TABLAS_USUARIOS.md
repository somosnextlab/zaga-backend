# Arquitectura de Tablas de Usuarios - Zaga

## 📋 **Resumen**

Sistema de usuarios con 3 roles granulares: `admin`, `usuario`, `cliente`. Separación clara entre autenticación (Supabase), datos personales y relación comercial.

## 🏗️ **Arquitectura**

```
Supabase Auth → seguridad.usuarios → financiera.personas → financiera.clientes
```

### **Relaciones**
- **1:1** `seguridad.usuarios` ↔ `financiera.personas`
- **1:1** `financiera.personas` ↔ `financiera.clientes`
- **Supabase Auth** → `seguridad.usuarios` (user_id)

## 📊 **Tablas**

### **1. `seguridad.usuarios` - Control de Acceso**
```sql
CREATE TABLE seguridad.usuarios (
  user_id    UUID PRIMARY KEY,     -- ID de Supabase
  persona_id UUID UNIQUE,          -- FK a personas
  rol        VARCHAR(20) NOT NULL, -- 'admin' | 'usuario' | 'cliente'
  estado     VARCHAR(20) NOT NULL, -- 'activo' | 'inactivo'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Responsabilidades:**
- ✅ Control de roles y permisos
- ✅ Estado de cuenta (activo/inactivo)
- ✅ Integración con Supabase Auth

### **2. `financiera.personas` - Datos Personales**
```sql
CREATE TABLE financiera.personas (
  id         UUID PRIMARY KEY,
  tipo_doc   VARCHAR(20) NOT NULL,    -- 'DNI' | 'PASAPORTE' | 'CUIL'
  numero_doc VARCHAR(20) NOT NULL,    -- Número de documento
  nombre     VARCHAR(100) NOT NULL,
  apellido   VARCHAR(100) NOT NULL,
  email      VARCHAR(255) UNIQUE,
  telefono   VARCHAR(20),
  fecha_nac  DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tipo_doc, numero_doc)
);
```

**Responsabilidades:**
- ✅ Identidad legal (DNI, nombre, apellido)
- ✅ Datos de contacto (email, teléfono)
- ✅ Cumplimiento legal argentino

### **3. `financiera.clientes` - Relación Comercial**
```sql
CREATE TABLE financiera.clientes (
  id         UUID PRIMARY KEY,
  persona_id UUID UNIQUE NOT NULL,    -- FK a personas
  estado     VARCHAR(20) NOT NULL,    -- 'activo' | 'inactivo' | 'suspendido'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Responsabilidades:**
- ✅ Relación comercial con la empresa
- ✅ Control de acceso a préstamos
- ✅ Estado comercial del cliente

## 🔄 **Flujo de Creación**

### **1. Registro (Frontend + Supabase)**
- Usuario se registra con email/password
- Supabase envía email de verificación
- Usuario verifica email → `email_verified: true`

### **2. Registro Inicial (Backend)**
- Frontend obtiene JWT válido (email verificado)
- Backend valida JWT con Supabase
- Se crea solo `seguridad.usuarios` con rol 'usuario'

### **3. Creación de Perfil Completo (Backend)**
- Usuario carga datos personales
- Backend crea `financiera.personas` y `financiera.clientes`
- Se actualiza rol de 'usuario' a 'cliente'

### **4. Progresión de Roles**
```
Registro → email verificado → usuario (rol: 'usuario') → Carga datos → cliente (rol: 'cliente')
```

## 🎯 **Estados del Usuario**

| Estado | Supabase | usuarios | personas | clientes | Puede Operar |
|--------|----------|----------|----------|----------|--------------|
| **Registrado** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Usuario** | ✅ | ✅ | ✅ | ✅ | ✅ (básico) |
| **Cliente** | ✅ | ✅ | ✅ | ✅ | ✅ (completo) |

## 🛡️ **Seguridad**

### **Validaciones**
- ✅ **DNI único** - No duplicados
- ✅ **Email único** - No duplicados
- ✅ **Edad mínima** - 18 años
- ✅ **Un perfil por usuario** - Prevención duplicados

### **Autenticación**
- ✅ **Supabase Auth** - Manejo externo
- ✅ **JWT con clave secreta** - Validación robusta
- ✅ **Roles granulares** - Permisos específicos

## 📈 **Beneficios**

### **1. Simplicidad**
- Un solo sistema de autenticación
- Flujo directo y comprensible
- Menos código que mantener

### **2. Seguridad**
- Verificación robusta por Supabase
- Roles granulares para control fino
- No duplicación de lógica

### **3. Escalabilidad**
- Supabase maneja escalabilidad de auth
- Backend se enfoca en lógica de negocio
- Fácil integración con otros servicios

---

**Documento actualizado:** 2025-01-15  
**Versión:** 3.0  
**Autor:** Sistema Zaga - NextLab