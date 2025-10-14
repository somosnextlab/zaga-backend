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

### **4. Autenticación con Supabase**
- ✅ **Email verificado** antes de crear perfil
- ✅ **JWT válido** requerido para operaciones
- ✅ **Un solo sistema** de autenticación
- ✅ **Cliente creado** inmediatamente tras verificación

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

### **Modo Desarrollo (Sin Supabase)**
- ✅ **Bypass de autenticación** cuando no hay configuración
- ✅ **Usuario mock** creado automáticamente
- ✅ **Email verificado** siempre true en desarrollo
- ✅ **Testing simplificado** sin tokens reales

### **Modo Producción (Con Supabase)**
- ✅ **JWT válido** requerido
- ✅ **Validación JWKS** con Supabase
- ✅ **Email verificado** del JWT
- ✅ **Roles** extraídos del JWT

## 🔐 **Reglas de Seguridad**

### **1. Email No Modificable por Usuarios**
- ❌ **Usuarios NO pueden** cambiar su email
- ✅ **Solo administradores** pueden cambiar emails
- ⚠️ **Requiere actualización manual** en Supabase
- ✅ **Auditoría completa** de cambios

### **2. Verificación de Email Obligatoria**
- ✅ **Email verificado** antes de crear perfil
- ✅ **Supabase maneja** la verificación
- ✅ **No duplicación** de lógica de verificación
- ✅ **Seguridad robusta** garantizada

### **3. Roles y Permisos**
- ✅ **admin**: Acceso completo al sistema
- ✅ **cliente**: Solo sus propios datos
- ✅ **RLS automático** basado en JWT
- ✅ **Prevención de escalación** de privilegios

## 📊 **Estados del Usuario**

### **Estado 1: Registrado en Supabase**
- ✅ **Email verificado** en Supabase
- ❌ **Sin perfil** en backend
- ❌ **No puede operar** en la plataforma

### **Estado 2: Perfil Creado**
- ✅ **Email verificado** en Supabase
- ✅ **Usuario creado** en backend
- ✅ **Persona creada** con datos básicos
- ✅ **Cliente creado** automáticamente
- ✅ **Puede operar** en la plataforma

### **Estado 3: Perfil Completo**
- ✅ **Todos los datos** personales completos
- ✅ **Documentos** subidos (opcional)
- ✅ **Acceso completo** a funcionalidades

## 🚫 **Restricciones de Negocio**

### **1. Un Perfil por Usuario**
- ❌ **No permitir** múltiples perfiles
- ✅ **Error 409** si ya existe perfil
- ✅ **Prevención** de duplicados

### **2. Documentos Únicos**
- ❌ **No permitir** mismo DNI en diferentes cuentas
- ❌ **No permitir** mismo email en diferentes cuentas
- ✅ **Validación** en creación y actualización

### **3. Edad Mínima**
- ✅ **18 años mínimo** para operar
- ✅ **Validación** en fecha de nacimiento
- ✅ **Cumplimiento legal** argentino

## 🔄 **Flujo de Validación**

### **Crear Perfil:**
1. ✅ **Verificar JWT** válido
2. ✅ **Verificar email** verificado en JWT
3. ✅ **Verificar usuario** no tiene perfil
4. ✅ **Verificar DNI** único
5. ✅ **Verificar email** único
6. ✅ **Crear usuario** + persona + cliente

### **Actualizar Perfil:**
1. ✅ **Verificar JWT** válido
2. ✅ **Verificar usuario** existe
3. ✅ **Verificar perfil** existe
4. ✅ **Validar campos** opcionales
5. ✅ **Actualizar** datos personales

## 📝 **Códigos de Error**

### **400 - Bad Request**
- Datos de entrada inválidos
- Validación de campos fallida

### **401 - Unauthorized**
- JWT inválido o expirado
- Token no proporcionado

### **403 - Forbidden**
- Sin permisos para la operación
- Rol insuficiente

### **409 - Conflict**
- Usuario ya tiene perfil
- DNI ya existe
- Email ya existe

### **404 - Not Found**
- Usuario no encontrado
- Perfil no existe

## 🧪 **Testing**

### **Casos de Prueba Obligatorios:**
1. ✅ **Crear perfil** exitoso
2. ✅ **Error 409** si perfil existe
3. ✅ **Error 409** si DNI existe
4. ✅ **Error 409** si email existe
5. ✅ **Actualizar perfil** exitoso
6. ✅ **Error 401** sin JWT
7. ✅ **Error 403** con rol insuficiente

### **Datos de Prueba:**
```typescript
const testUser = {
  tipo_doc: 'DNI',
  numero_doc: '12345678',
  nombre: 'Juan',
  apellido: 'Pérez',
  email: 'juan@example.com',
  telefono: '+54911234567',
  fecha_nac: '1990-01-01'
};
```

## 🚀 **Mejoras Implementadas**

### **v2.0 - Integración Supabase**
- ✅ **Eliminación** de verificación de email propia
- ✅ **Simplificación** del flujo de autenticación
- ✅ **Cliente creado** automáticamente
- ✅ **Código más limpio** y mantenible

### **Beneficios:**
- ✅ **Menos código** que mantener
- ✅ **Mayor seguridad** con Supabase
- ✅ **Mejor rendimiento** sin duplicación
- ✅ **Escalabilidad** mejorada

---

**Documento actualizado:** 2025-01-10  
**Versión:** 2.0  
**Autor:** Sistema Zaga - NextLab