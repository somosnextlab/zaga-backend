# Autenticación en Swagger - Zaga

## 📋 **Resumen**

Guía para configurar y usar la autenticación JWT de Supabase en Swagger UI para probar los endpoints de la API.

## 🔧 **Configuración**

### **1. Obtener Token JWT**
```typescript
// Frontend - Login con Supabase
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'usuario@example.com',
  password: 'password123',
});

const jwt = data.session.access_token;
```

### **2. Configurar Swagger**
1. **Abrir Swagger UI**: `https://zaga-backend-production.up.railway.app/api`
2. **Hacer clic en "Authorize"** (botón verde)
3. **Pegar JWT** en el campo "Value"
4. **Hacer clic en "Authorize"**

## 🎯 **Roles y Permisos**

### **`admin`**
- ✅ Acceso completo a todos los endpoints
- ✅ Gestión de usuarios y clientes
- ✅ Operaciones administrativas

### **`usuario`**
- ✅ Consultar su perfil (`GET /usuarios/yo`)
- ✅ Actualizar su perfil (`PUT /usuarios/yo`)
- ✅ Consultar usuarios específicos (`GET /usuarios/:id`)

### **`cliente`**
- ✅ Todo lo de `usuario`
- ✅ Consultar clientes (`GET /clientes`)
- ✅ Consultar cliente específico (`GET /clientes/:id`)

## 📋 **Endpoints por Rol**

### **Autenticación**
```
POST /auth/login          - Público
GET  /auth/health         - Público
```

### **Usuarios**
```
GET    /usuarios          - admin
GET    /usuarios/:id      - admin, usuario
PUT    /usuarios/yo       - admin, usuario, cliente
DELETE /usuarios/:id      - admin, usuario
```

### **Clientes**
```
GET    /clientes          - admin, cliente
GET    /clientes/:id      - admin, cliente
DELETE /clientes/:id      - admin
```

## 🧪 **Testing en Swagger**

### **1. Login**
```json
POST /auth/login
{
  "email": "admin@zaga.com",
  "password": "password123"
}
```

### **2. Obtener Token**
```json
Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "user_id": "uuid",
    "email": "admin@zaga.com",
    "rol": "admin"
  }
}
```

### **3. Usar Token**
1. **Copiar** `access_token` de la respuesta
2. **Pegar** en Swagger "Authorize"
3. **Probar** endpoints protegidos

## 🛡️ **Seguridad**

### **Headers Requeridos**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

### **Validaciones**
- ✅ **JWT válido** - Verificado con Supabase
- ✅ **Token no expirado** - Verificación temporal
- ✅ **Rol correcto** - Permisos granulares
- ✅ **Email verificado** - `email_verified: true`

## 🚨 **Errores Comunes**

### **401 Unauthorized**
```json
{
  "message": "Token inválido o expirado",
  "error": "Unauthorized",
  "statusCode": 401
}
```
**Solución**: Obtener nuevo token de Supabase

### **403 Forbidden**
```json
{
  "message": "Acceso denegado - Se requiere rol de administrador",
  "error": "Forbidden",
  "statusCode": 403
}
```
**Solución**: Verificar rol del usuario

### **Token Expirado**
```json
{
  "message": "Token inválido o expirado",
  "error": "Unauthorized",
  "statusCode": 401
}
```
**Solución**: Hacer login nuevamente

## 🔄 **Flujo de Testing**

### **1. Preparación**
- Tener cuenta en Supabase
- Email verificado
- Usuario creado en backend

### **2. Autenticación**
- Hacer login en frontend
- Obtener JWT válido
- Configurar en Swagger

### **3. Testing**
- Probar endpoints según rol
- Verificar respuestas
- Validar permisos

## 📊 **Ejemplos de Uso**

### **Admin - Listar Usuarios**
```http
GET /usuarios?page=1&limit=10
Authorization: Bearer [JWT]
```

### **Usuario - Ver Perfil**
```http
GET /usuarios/yo
Authorization: Bearer [JWT]
```

### **Cliente - Listar Clientes**
```http
GET /clientes?page=1&limit=10
Authorization: Bearer [JWT]
```

## 🎯 **Mejores Prácticas**

### **1. Seguridad**
- ✅ **No compartir** tokens en logs
- ✅ **Renovar** tokens antes de expirar
- ✅ **Usar HTTPS** en producción

### **2. Testing**
- ✅ **Probar** todos los roles
- ✅ **Validar** respuestas de error
- ✅ **Verificar** permisos granulares

### **3. Desarrollo**
- ✅ **Usar** tokens de desarrollo
- ✅ **Limpiar** tokens después de testing
- ✅ **Documentar** cambios en permisos

---

**Documento actualizado:** 2025-01-15  
**Versión:** 3.0  
**Autor:** Sistema Zaga - NextLab