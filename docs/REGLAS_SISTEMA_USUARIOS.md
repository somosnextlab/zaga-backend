# Reglas del Sistema de Usuarios - Zaga

## 📋 **Reglas Establecidas**

### **1. Relación Usuario-Persona (1:1)**
- ✅ **1 user_id = 1 persona_id**
- ✅ **Un usuario** = Una persona física
- ✅ **Un perfil** por usuario
- ❌ **No cambiar** - Es la arquitectura correcta

### **2. Email Único (1:1)**
- ✅ **1 email = 1 cuenta**
- ✅ **Email único** por usuario
- ✅ **No permitir** múltiples cuentas con mismo email
- ✅ **Evitar confusión** y problemas de seguridad

### **3. DNI Único (1:1)**
- ✅ **DNI único** por persona física
- ✅ **No permitir** mismo DNI en diferentes cuentas
- ✅ **Cumplimiento legal** argentino
- ✅ **Identidad única** garantizada

## 🛠️ **Validaciones Implementadas**

### **En `crearPerfil()`:**
```typescript
// 1. Verificar si usuario ya tiene perfil
if (usuarioExistente.persona_id) {
  throw new ConflictException('El usuario ya tiene un perfil creado');
}

// 2. Verificar DNI único
const personaExistente = await this.prisma.financiera_personas.findFirst({
  where: { tipo_doc: createPerfilDto.tipo_doc, numero_doc: createPerfilDto.numero_doc }
});
if (personaExistente) {
  throw new ConflictException(`Ya existe una persona con ${createPerfilDto.tipo_doc} número ${createPerfilDto.numero_doc}`);
}

// 3. Verificar email único
const emailExistente = await this.prisma.financiera_personas.findFirst({
  where: { email: createPerfilDto.email }
});
if (emailExistente) {
  throw new ConflictException(`Ya existe una cuenta con el email ${createPerfilDto.email}`);
}
```

## 🧪 **Para Desarrollo**

### **Script de Limpieza:**
```bash
node scripts/cleanup-test-data.js
```

**¿Qué hace?**
- ✅ Elimina tokens de verificación
- ✅ Elimina cliente asociado
- ✅ Elimina persona asociada
- ✅ Resetea usuario de desarrollo
- ✅ Permite crear nuevo usuario

### **Flujo de Pruebas (Nuevo Flujo Seguro):**
1. **Crear usuario** con datos únicos
2. **Crear perfil** (se crea persona, NO cliente)
3. **Recibir email** de verificación (obligatorio)
4. **Verificar email** (crea cliente automáticamente)
5. **Limpiar datos** con script
6. **Repetir** con nuevos datos

## 🔄 **Nuevo Flujo de Verificación de Email**

### **🛡️ Principios de Seguridad:**
- ✅ **Email verificado** antes de crear datos financieros
- ✅ **Cliente creado** solo después de verificación
- ✅ **Error si falla email** - Usuario debe reintentar
- ✅ **Datos personales** se crean inmediatamente (para identificación)

### **📋 Pasos del Flujo:**

1. **Crear Perfil** (`POST /usuarios/crear-perfil`):
   - ✅ Crea `seguridad.usuarios`
   - ✅ Crea `financiera.personas`
   - ✅ Envía email de verificación
   - ❌ **NO crea** `financiera.clientes`

2. **Verificar Email** (`POST /usuarios/verificar-email`):
   - ✅ Valida token de verificación
   - ✅ Marca email como verificado
   - ✅ **AHORA SÍ crea** `financiera.clientes`

### **🎯 Estados del Usuario:**

| Estado | Usuario | Persona | Cliente | Email Verificado |
|--------|---------|---------|---------|------------------|
| **Registrado** | ✅ | ❌ | ❌ | ❌ |
| **Perfil Creado** | ✅ | ✅ | ❌ | ❌ |
| **Email Verificado** | ✅ | ✅ | ✅ | ✅ |

## 🎯 **Casos de Uso**

### **✅ Permitido:**
- Crear usuario con email único
- Crear usuario con DNI único
- Crear perfil sin cliente (pendiente verificación)
- Verificar email y crear cliente automáticamente
- Actualizar perfil del usuario
- Reenviar email de verificación

### **❌ No Permitido:**
- Múltiples cuentas con mismo email
- Múltiples cuentas con mismo DNI
- Múltiples perfiles por usuario
- Email duplicado en diferentes usuarios
- Crear cliente sin email verificado
- Usar plataforma sin email verificado

## 📊 **Estructura de Datos**

```
seguridad.usuarios
├── user_id (UUID) - ÚNICO
├── persona_id (UUID) - ÚNICO por usuario
├── rol (enum)
├── estado (enum)
└── email_verificado (boolean)

financiera.personas
├── id (UUID) - ÚNICO
├── email (string) - ÚNICO
├── tipo_doc + numero_doc - ÚNICO
├── nombre, apellido
└── telefono, fecha_nac

financiera.clientes
├── id (UUID) - ÚNICO
├── persona_id (UUID) - FK a personas
└── estado (enum)
```

## 🔒 **Seguridad**

- ✅ **Email único** previene cuentas duplicadas
- ✅ **DNI único** garantiza identidad única
- ✅ **Tokens de verificación** con expiración
- ✅ **Validaciones robustas** en DTOs
- ✅ **Soft delete** para usuarios

## 📝 **Notas Importantes**

1. **En desarrollo:** Usar script de limpieza entre pruebas
2. **En producción:** Cada usuario real tendrá user_id único
3. **Email:** Debe ser único en toda la plataforma
4. **DNI:** Debe ser único en toda la plataforma
5. **Verificación:** Email debe ser verificado para usar la plataforma
