# Reglas del Sistema de Usuarios - Zaga

## 📋 **Resumen**

Reglas de negocio y validaciones para el sistema de usuarios con 3 roles granulares: admin, usuario y cliente.

## 🎯 **Roles del Sistema**

### **`admin`**
- **Creación**: Manual en Supabase Dashboard
- **Permisos**: Acceso completo al sistema
- **Operaciones**: Gestión de usuarios, clientes y configuración

### **`usuario`**
- **Creación**: Automática al registrarse
- **Permisos**: Perfil básico y consultas limitadas
- **Operaciones**: Ver/editar su perfil, consultar usuarios

### **`cliente`**
- **Creación**: Automática al cargar datos completos
- **Permisos**: Funcionalidades financieras completas
- **Operaciones**: Solicitar préstamos, ver historial

## 🔄 **Flujo de Progresión**

### **1. Registro**
```
Usuario se registra → Supabase Auth → email_verified: true
```

### **2. Creación de Perfil**
```
JWT válido → Backend → Crear usuario + persona + cliente
```

### **3. Progresión de Rol**
```
usuario (básico) → Carga datos → cliente (completo)
```

## 🛡️ **Reglas de Validación**

### **Datos Personales**
- ✅ **DNI único** por tipo de documento
- ✅ **Email único** en todo el sistema
- ✅ **Edad mínima** 18 años para clientes
- ✅ **Teléfono argentino** formato +549XXXXXXXX
- ✅ **Un perfil por usuario** prevención de duplicados

### **Autenticación**
- ✅ **Email verificado** antes de crear perfil
- ✅ **JWT válido** con clave secreta de Supabase
- ✅ **Token no expirado** verificación temporal
- ✅ **Rol válido** admin/usuario/cliente

### **Autorización**
- ✅ **Permisos granulares** por rol
- ✅ **Acceso restringido** a funcionalidades
- ✅ **Validación de contexto** en cada endpoint

## 📊 **Estados del Usuario**

### **Estado en Base de Datos**
```sql
-- seguridad.usuarios
estado: 'activo' | 'inactivo'

-- financiera.clientes  
estado: 'activo' | 'inactivo' | 'suspendido'
```

### **Transiciones de Estado**
- **`activo`** → **`inactivo`**: Desactivación por admin/usuario
- **`inactivo`** → **`activo`**: Reactivación por admin
- **`activo`** → **`suspendido`**: Suspensión por admin

## 🔒 **Reglas de Seguridad**

### **Acceso a Datos**
- **Admin**: Acceso completo a todos los datos
- **Usuario**: Solo sus propios datos
- **Cliente**: Sus datos + información de clientes

### **Operaciones Permitidas**

#### **Admin**
- ✅ Crear, leer, actualizar, eliminar usuarios
- ✅ Crear, leer, actualizar, eliminar clientes
- ✅ Cambiar roles y estados
- ✅ Acceso a reportes y analytics

#### **Usuario**
- ✅ Leer su propio perfil
- ✅ Actualizar su propio perfil
- ✅ Leer otros usuarios (consulta)
- ✅ Desactivar su propia cuenta

#### **Cliente**
- ✅ Todo lo de usuario
- ✅ Leer información de clientes
- ✅ Solicitar préstamos
- ✅ Ver historial de transacciones

## 🚨 **Reglas de Negocio**

### **Creación de Usuario**
1. **Registro en Supabase** con email/password
2. **Verificación de email** obligatoria
3. **Creación automática** de perfil en backend
4. **Rol inicial**: `usuario`

### **Progresión a Cliente**
1. **Usuario registrado** con perfil básico
2. **Carga de datos completos** (DNI, nombre, etc.)
3. **Actualización automática** de rol a `cliente`
4. **Habilitación** de funcionalidades financieras

### **Desactivación de Cuenta**
1. **Usuario puede** desactivar su propia cuenta
2. **Admin puede** desactivar cualquier cuenta
3. **Soft delete** - datos preservados
4. **Reactivación** solo por admin

## 📋 **Validaciones de Endpoints**

### **GET /usuarios**
- **Rol requerido**: `admin`
- **Validación**: Token válido + rol admin
- **Respuesta**: Lista paginada de usuarios

### **GET /usuarios/:id**
- **Rol requerido**: `admin`, `usuario`
- **Validación**: Token válido + rol correcto
- **Respuesta**: Datos del usuario específico

### **DELETE /usuarios/:id**
- **Rol requerido**: `admin`, `usuario`
- **Validación**: Token válido + rol correcto
- **Acción**: Desactivar usuario (soft delete)

### **GET /clientes**
- **Rol requerido**: `admin`, `cliente`
- **Validación**: Token válido + rol correcto
- **Respuesta**: Lista paginada de clientes

### **DELETE /clientes/:id**
- **Rol requerido**: `admin`
- **Validación**: Token válido + rol admin
- **Acción**: Desactivar cliente (soft delete)

## 🔄 **Flujo de Errores**

### **401 Unauthorized**
- Token inválido o expirado
- **Acción**: Renovar token

### **403 Forbidden**
- Rol insuficiente para la operación
- **Acción**: Verificar permisos

### **404 Not Found**
- Usuario/cliente no encontrado
- **Acción**: Verificar ID

### **409 Conflict**
- DNI o email duplicado
- **Acción**: Usar datos únicos

## 📈 **Métricas y Monitoreo**

### **KPIs del Sistema**
- **Usuarios activos** por rol
- **Tiempo de respuesta** de endpoints
- **Errores de autenticación** por hora
- **Conversión** usuario → cliente

### **Alertas**
- **Token expirado** frecuentemente
- **Errores 403** por permisos
- **Usuarios duplicados** detectados
- **Fallos de validación** masivos

---

**Documento actualizado:** 2025-01-15  
**Versión:** 3.0  
**Autor:** Sistema Zaga - NextLab