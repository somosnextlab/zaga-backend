# Flujo de Verificación de Email - Zaga

## 📋 **Resumen Ejecutivo**

El sistema de verificación de email de Zaga implementa un flujo seguro que garantiza que los datos financieros solo se crean después de verificar la identidad del usuario a través de su email. Esto mejora la seguridad y previene la creación de cuentas con emails inválidos.

## 🛡️ **Principios de Seguridad**

### **1. Verificación Obligatoria**
- ✅ **Email verificado** antes de crear datos financieros
- ✅ **Cliente creado** solo después de verificación
- ✅ **Error si falla email** - Usuario debe reintentar
- ✅ **Datos personales** se crean inmediatamente (para identificación)

### **2. Separación de Responsabilidades**
- **Datos de Identificación** → Se crean inmediatamente
- **Datos Financieros** → Se crean solo con email verificado
- **Control de Acceso** → Independiente de verificación

## 🔄 **Flujo Detallado**

### **Paso 1: Crear Perfil de Usuario**

**Endpoint:** `POST /usuarios/crear-perfil`

**Acciones:**
1. Crear registro en `seguridad.usuarios`
2. Crear registro en `financiera.personas`
3. Asociar usuario con persona
4. Generar token de verificación
5. Enviar email de verificación

**Respuesta:**
```json
{
  "success": true,
  "message": "Perfil creado exitosamente. Se ha enviado un email de verificación. Debes verificar tu email para completar el registro.",
  "data": {
    "persona_id": "uuid",
    "nombre": "Juan",
    "apellido": "Pérez",
    "email_verificado": false
  },
  "token": "token-para-testing" // Solo en desarrollo
}
```

**⚠️ Importante:** NO se crea registro en `financiera.clientes`

### **Paso 2: Verificar Email**

**Endpoint:** `POST /usuarios/verificar-email`

**Acciones:**
1. Validar token de verificación
2. Marcar email como verificado en `seguridad.usuarios`
3. **Crear registro en `financiera.clientes`**
4. Usuario completamente activo

**Respuesta:**
```json
{
  "success": true,
  "message": "Email verificado exitosamente. Tu cuenta está ahora completamente activa.",
  "data": {
    "email_verificado": true,
    "cliente_creado": true
  }
}
```

## 📊 **Estados del Usuario**

| Estado | Usuario | Persona | Cliente | Email Verificado | Puede Usar Plataforma |
|--------|---------|---------|---------|------------------|----------------------|
| **Registrado** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Perfil Creado** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Email Verificado** | ✅ | ✅ | ✅ | ✅ | ✅ |

## 🔧 **Configuración Requerida**

### **Variables de Entorno:**
```env
SENDGRID_API_KEY=tu_api_key_aqui
FROM_EMAIL=noreply@zaga.com.ar
FROM_NAME=Zaga
FRONTEND_URL=https://zaga.com.ar
```

### **Verificar Configuración:**
```bash
node scripts/check-sendgrid-config.js
```

## 🧪 **Scripts de Prueba**

### **Probar Flujo Completo:**
```bash
node scripts/test-new-user-flow.js
```

**¿Qué hace?**
- ✅ Limpia datos de prueba anteriores
- ✅ Simula creación de perfil (sin cliente)
- ✅ Verifica que NO se creó cliente
- ✅ Simula verificación de email
- ✅ Verifica que SÍ se creó cliente
- ✅ Muestra estado final de todas las tablas

### **Limpiar Datos de Prueba:**
```bash
node scripts/cleanup-test-data.js
```

## 🚨 **Manejo de Errores**

### **Error en Envío de Email:**
```json
{
  "success": false,
  "message": "Error al enviar email de verificación. Por favor, intenta nuevamente.",
  "error": "SENDGRID_ERROR"
}
```

### **Token Inválido o Expirado:**
```json
{
  "success": false,
  "message": "Token inválido o expirado",
  "error": "INVALID_TOKEN"
}
```

### **Email Ya Verificado:**
```json
{
  "success": false,
  "message": "El email ya está verificado",
  "error": "ALREADY_VERIFIED"
}
```

## 📈 **Beneficios del Nuevo Flujo**

### **1. Seguridad Mejorada**
- ✅ Previene cuentas con emails inválidos
- ✅ Garantiza identidad verificada antes de datos financieros
- ✅ Reduce riesgo de fraude

### **2. Mejor Experiencia de Usuario**
- ✅ Mensajes claros sobre el estado del proceso
- ✅ Feedback inmediato si falla el email
- ✅ Flujo lógico y comprensible

### **3. Cumplimiento Legal**
- ✅ Verificación de identidad antes de servicios financieros
- ✅ Auditoría clara del proceso de verificación
- ✅ Datos personales protegidos

### **4. Mantenibilidad**
- ✅ Código más limpio y organizado
- ✅ Separación clara de responsabilidades
- ✅ Fácil testing y debugging

## 🔗 **Endpoints Relacionados**

- `POST /usuarios/crear-perfil` - Crear perfil (sin cliente)
- `POST /usuarios/verificar-email` - Verificar email y crear cliente
- `POST /usuarios/reenviar-verificacion` - Reenviar email de verificación
- `GET /usuarios/yo` - Obtener perfil del usuario

## 📝 **Notas de Implementación**

1. **En desarrollo:** El token se devuelve en la respuesta para testing
2. **En producción:** El token NO se devuelve por seguridad
3. **Tokens expiran:** En 24 horas por defecto
4. **Reenvío limitado:** Máximo 3 intentos por hora
5. **Logs detallados:** Todos los pasos se registran para auditoría

---

**Documento creado:** 2025-01-10  
**Versión:** 1.0  
**Autor:** Sistema Zaga - NextLab
