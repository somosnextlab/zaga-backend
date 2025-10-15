# Flujo de Autenticación con Supabase

## 📋 **Resumen**

Sistema de autenticación basado en Supabase Auth con 3 roles granulares. Verificación de email externa y creación automática de perfiles en el backend.

## 🔄 **Flujo Completo**

### **1. Registro de Usuario**
```typescript
// Frontend
const { data, error } = await supabase.auth.signUp({
  email: 'usuario@example.com',
  password: 'password123',
  options: {
    emailRedirectTo: 'https://zaga.com.ar/dashboard',
  },
});
```

**Resultado:**
- ✅ Supabase envía email de verificación
- ✅ Usuario hace click en link
- ✅ Email verificado por Supabase

### **2. Login y JWT**
```typescript
// Frontend
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@example.com',
  password: 'password123',
});

// JWT contiene:
// {
//   sub: "user-uuid",
//   email: "usuario@example.com",
//   email_verified: true,
//   user_metadata: { role: "usuario" }
// }
```

### **3. Crear Perfil (Backend)**
```typescript
// POST /usuarios/crear-perfil (con JWT en Authorization header)
const result = await fetch('/usuarios/crear-perfil', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tipo_doc: 'DNI',
    numero_doc: '12345678',
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'usuario@example.com',
    telefono: '+54911234567',
    fecha_nac: '1990-01-01',
  }),
});
```

**Backend crea automáticamente:**
- ✅ `seguridad.usuarios` (rol: 'usuario')
- ✅ `financiera.personas` (datos personales)
- ✅ `financiera.clientes` (relación comercial)

## 🎯 **Roles del Sistema**

### **`admin`**
- Gestión completa del sistema
- Acceso a todos los endpoints
- Creación manual en Supabase Dashboard

### **`usuario`**
- Usuario registrado con perfil básico
- Puede consultar y editar su perfil
- No puede solicitar préstamos

### **`cliente`**
- Usuario con datos completos
- Puede solicitar préstamos
- Acceso a funcionalidades financieras

## 🔧 **Configuración Requerida**

### **Variables de Entorno**
```env
SUPABASE_PROJECT_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your_jwt_secret_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **Configuración Supabase**
1. **Habilitar email verification** en Authentication settings
2. **Configurar redirect URLs** para verificación
3. **Configurar JWT settings** con expiración apropiada

## 🛡️ **Seguridad**

### **Fortalezas**
- ✅ **Verificación única** por Supabase
- ✅ **JWT con clave secreta** para validación
- ✅ **Roles granulares** para control fino
- ✅ **Email verificado** antes de crear perfil

### **Validaciones**
- ✅ **JWT válido** - Verificado con clave secreta
- ✅ **Email verificado** - `email_verified: true`
- ✅ **Rol válido** - admin/usuario/cliente
- ✅ **Token no expirado** - Verificación temporal

## 📊 **Estados del Usuario**

| Estado | Supabase | usuarios | personas | clientes | Operaciones |
|--------|----------|----------|----------|----------|-------------|
| **Registrado** | ✅ | ❌ | ❌ | ❌ | Solo login |
| **Usuario** | ✅ | ✅ | ✅ | ✅ | Perfil básico |
| **Cliente** | ✅ | ✅ | ✅ | ✅ | Préstamos |

## 🚨 **Manejo de Errores**

### **Errores Comunes**
1. **JWT inválido o expirado** (401)
2. **Email no verificado** (403)
3. **Perfil ya existe** (409)
4. **DNI duplicado** (409)

### **Respuestas de Error**
```json
{
  "statusCode": 401,
  "message": "Token inválido o expirado"
}
```

## 🧪 **Testing**

### **Flujo de Pruebas**
1. **Registro** en Supabase
2. **Verificar email** (manual o automático)
3. **Login** y obtener JWT
4. **Crear perfil** con JWT válido
5. **Verificar** creación en base de datos

## 📈 **Beneficios**

### **1. Simplicidad**
- Un solo sistema de verificación
- Flujo directo y comprensible
- Menos código que mantener

### **2. Seguridad**
- Verificación robusta por Supabase
- JWT con clave secreta
- Roles granulares

### **3. Escalabilidad**
- Supabase maneja escalabilidad de auth
- Backend se enfoca en lógica de negocio
- Fácil integración con otros servicios

---

**Documento actualizado:** 2025-01-15  
**Versión:** 3.0  
**Autor:** Sistema Zaga - NextLab